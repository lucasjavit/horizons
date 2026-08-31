import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthConfigDto } from './auth.dto';
import type { AuthUser } from './current-user';

/** Quanto tempo a sessao dura. */
const VALIDADE = '30d';

/**
 * Login desligado (temporario).
 *
 * Com isto ligado **nenhuma rota exige token** — e o mesmo comportamento de
 * antes do PLT-02, com o mesmo risco: quem alcanca a porta 3333 le
 * `/api/settings/tokens`, onde vivem as chaves de IA. So vale enquanto a
 * aplicacao roda em rede local.
 *
 * A leitura e por funcao, e nao por campo lido no construtor, para o teste
 * conseguir ligar e desligar sem recriar o modulo.
 */
export function authDesligada(): boolean {
  return process.env.AUTH_DISABLED === 'true';
}

/** Campos que saem daqui. Nunca o registro inteiro do banco. */
const CAMPOS = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  active: true,
} as const;

/**
 * Sessao por Google Sign-In, portada do arguicao com tres correcoes:
 *
 * - o segredo e validado no BOOT, nao em tempo de request. O arguicao devolve
 *   401 quando falta JWT_SECRET, o que faz erro de configuracao do servidor
 *   parecer erro de autenticacao do usuario.
 * - nao ha e-mail de admin embutido no codigo. Se ADMIN_EMAILS nao estiver
 *   definida, ninguem vira admin — default de seguranca e "ninguem", nao "eu".
 * - nao ha adocao de dados orfaos rodando em todo login. A migracao das contas
 *   antigas e por e-mail e acontece uma vez (PLT-03).
 */
@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private readonly client: OAuth2Client | null;
  private readonly segredo: string;

  constructor(private readonly prisma: PrismaService) {
    const segredo = process.env.JWT_SECRET;
    if (!segredo || segredo.length < 16) {
      // Derruba o boot: subir sem segredo deixaria a aplicacao inteira aberta,
      // e um erro em tempo de request so apareceria quando alguem tentasse
      // entrar.
      throw new Error(
        'JWT_SECRET ausente ou curta demais (minimo 16 caracteres) — veja backend/.env.example',
      );
    }
    this.segredo = segredo;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    this.client = clientId ? new OAuth2Client(clientId) : null;
    if (!clientId) {
      this.log.warn('GOOGLE_CLIENT_ID nao definida — o login fica indisponivel');
    }

    // Grita no boot, e nao so uma vez: subir sem autenticacao e uma decisao,
    // nao um detalhe. A linha aparece toda vez que a API sobe justamente para
    // nao virar paisagem.
    if (authDesligada()) {
      this.log.warn(
        'AUTH_DISABLED=true — NENHUMA rota exige token. As chaves de IA em ' +
          '/api/settings/tokens ficam acessiveis a quem alcancar esta porta. ' +
          'So use em rede local; remova a variavel para religar o login.',
      );
    }
  }

  /** O front pergunta antes de desenhar o botao, para nao mostrar algo morto. */
  config(): AuthConfigDto {
    const googleClientId = process.env.GOOGLE_CLIENT_ID ?? null;
    return {
      googleClientId,
      enabled: !!googleClientId,
      authDisabled: authDesligada(),
    };
  }

  /**
   * A conta usada enquanto AUTH_DISABLED esta ligada.
   *
   * Resolve do banco em vez de inventar um objeto: os servicos gravam com
   * `userId`, e um id que nao existe quebraria a chave estrangeira na primeira
   * anotacao salva. Cria a conta se ainda nao houver — o banco pode estar
   * vazio numa maquina nova.
   */
  async usuarioDeDesenvolvimento(): Promise<AuthUser> {
    const email = (process.env.DEFAULT_USER_EMAIL ?? 'eu@horizons.local').toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: email.split('@')[0],
        provider: 'DEV',
        role: this.papelPara(email, null),
      },
      // Nao mexe em nada de quem ja existe: com o login desligado, esta conta
      // costuma ser a mesma que ja tem o progresso das trilhas.
      update: {},
      select: CAMPOS,
    });
    return this.toDto(user);
  }

  async loginComGoogle(
    idToken: string,
  ): Promise<{ user: AuthUser; accessToken: string }> {
    if (!this.client) {
      throw new UnauthorizedException('Login com Google nao esta configurado neste servidor.');
    }
    if (!idToken?.trim()) {
      throw new UnauthorizedException('Token do Google ausente.');
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        // O `audience` e o que impede reaproveitar um token emitido para
        // outro aplicativo.
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      this.log.warn(`Token do Google rejeitado: ${String(e)}`);
      throw new UnauthorizedException('Nao foi possivel validar sua conta Google.');
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('A conta Google nao retornou um e-mail valido.');
    }
    // `!== true` e nao `=== false`: payload sem a claim tambem nao passa.
    if (payload.email_verified !== true) {
      throw new UnauthorizedException('Confirme o e-mail da sua conta Google antes de entrar.');
    }

    const email = payload.email.toLowerCase();
    const nome = payload.name ?? email.split('@')[0];
    const avatar = payload.picture ?? null;

    // O papel que ESTA gravado, lido antes do upsert.
    //
    // O `update` abaixo precisa dele para decidir se ha um MANAGER a
    // preservar, e `upsert` nao da acesso ao registro anterior — a alternativa
    // seria uma expressao SQL crua no `data`, que o Prisma nao oferece aqui.
    // Custa um SELECT por login, no mesmo caminho que ja faz um SELECT dentro
    // do upsert; nao e o gargalo de um fluxo que acabou de falar com o Google.
    const anterior = await this.prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });

    // upsert por e-mail: se ja existe conta criada pelo guard antigo, ela e
    // adotada aqui, com o progresso das trilhas e os tokens de API (PLT-03).
    const user = await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: nome,
        avatarUrl: avatar,
        provider: 'GOOGLE',
        providerId: payload.sub,
        // Conta nova nasce COMMON_USER, a menos que o e-mail ja esteja em
        // ADMIN_EMAILS. Nao ha papel anterior a respeitar: `null`.
        role: this.papelPara(email, null),
        lastLoginAt: new Date(),
      },
      update: {
        name: nome,
        avatarUrl: avatar,
        providerId: payload.sub,
        // `role` tambem no update, e nao so no create: sem isto, uma conta
        // criada pelo guard antigo (ou por um login anterior) nunca ganharia
        // o papel ao entrar em ADMIN_EMAILS, e sair da lista nao tiraria o
        // papel de ninguem.
        //
        // ⚠️ **Mas nao e mais `ehAdmin ? ADMIN : USER`** (PLT-11). Aquela
        // forma apagava o MANAGER a cada entrada: o dono promovia pela tela, a
        // pessoa entrava, e voltava a ser comum sem erro nenhum no log. Ver
        // `papelPara`.
        role: this.papelPara(email, anterior?.role ?? null),
        lastLoginAt: new Date(),
      },
      select: CAMPOS,
    });

    if (!user.active) {
      throw new UnauthorizedException('Esta conta foi desativada.');
    }

    return { user: this.toDto(user), accessToken: this.assinar(user) };
  }

  /**
   * Resolve o token no usuario atual.
   *
   * Le o banco a cada request de proposito: assim desativar uma conta ou
   * mudar o papel vale na requisicao seguinte, em vez de esperar um token de
   * 30 dias expirar.
   */
  async verificar(token: string): Promise<AuthUser> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.segredo) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Sessao expirada. Entre novamente.');
    }

    const id = payload.sub ? String(payload.sub) : null;
    const user = id
      ? await this.prisma.user.findUnique({ where: { id }, select: CAMPOS })
      : null;

    if (!user || !user.active) {
      throw new UnauthorizedException('Sessao invalida. Entre novamente.');
    }
    return this.toDto(user);
  }

  /**
   * O papel que vale para esta entrada.
   *
   * ```
   * esta em ADMIN_EMAILS?      -> ADMIN        (a variavel ganha sempre)
   * senao, e MANAGER no banco?  -> MANAGER      (respeita a promocao)
   * senao                       -> COMMON_USER
   * ```
   *
   * As duas garantias que existiam antes continuam de pe:
   *
   * - **sair do ADMIN_EMAILS tira o papel** — e cai para `COMMON_USER`, nao
   *   para `MANAGER`: quem tirou o admin decide se quer dar outro papel;
   * - **ninguem vira admin promovendo-se no banco**, porque `ADMIN` gravado na
   *   coluna sem estar na variavel nao entra em nenhum dos ramos.
   *
   * O que muda e so o meio: `MANAGER` vem do banco, porque o dono promove pela
   * tela (PLT-11) e nao ha variavel de ambiente para consultar.
   *
   * @param papelAtual o que esta gravado hoje, ou `null` para conta nova.
   */
  private papelPara(email: string, papelAtual: string | null): string {
    if (this.ehAdmin(email)) return 'ADMIN';
    // So MANAGER e preservado. Um 'ADMIN' que sobrou na coluna de quem saiu da
    // variavel cai aqui de proposito, e vira COMMON_USER.
    if (papelAtual === 'MANAGER') return 'MANAGER';
    return 'COMMON_USER';
  }

  /** Sem ADMIN_EMAILS, ninguem e admin. */
  private ehAdmin(email: string): boolean {
    const lista = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return lista.includes(email);
  }

  private assinar(user: { id: string; email: string; role: string }): string {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, this.segredo, {
      expiresIn: VALIDADE,
    });
  }

  private toDto(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    role: string;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }
}
