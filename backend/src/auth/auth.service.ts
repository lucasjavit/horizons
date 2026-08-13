import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './current-user';

/** Quanto tempo a sessao dura. */
const VALIDADE = '30d';

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
  }

  /** O front pergunta antes de desenhar o botao, para nao mostrar algo morto. */
  config(): { googleClientId: string | null; enabled: boolean } {
    const googleClientId = process.env.GOOGLE_CLIENT_ID ?? null;
    return { googleClientId, enabled: !!googleClientId };
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
        role: this.ehAdmin(email) ? 'ADMIN' : 'USER',
        lastLoginAt: new Date(),
      },
      update: {
        name: nome,
        avatarUrl: avatar,
        providerId: payload.sub,
        // `role` tambem no update, e nao so no create: sem isto, uma conta
        // criada pelo guard antigo (ou por um login anterior) nunca ganharia
        // o papel ao entrar em ADMIN_EMAILS, e sair da lista nao tiraria o
        // papel de ninguem. A variavel e a fonte da verdade a cada login.
        role: this.ehAdmin(email) ? 'ADMIN' : 'USER',
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
