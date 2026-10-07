import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { AuthService, authDesligada } from './auth.service';
import {
  CHAVE_ADMIN,
  CHAVE_GESTAO,
  CHAVE_INGESTAO,
  CHAVE_OPCIONAL,
  CHAVE_PUBLICA,
  type RequestWithUser,
} from './current-user';

/**
 * O tamanho minimo do `INGEST_TOKEN`.
 *
 * Mesma filosofia do `JWT_SECRET` (16 caracteres, validado no boot): segredo
 * curto demais e erro de configuracao, e configuracao errada nao vira porta
 * aberta. Aqui 32 porque este token nao e digitado por ninguem — ele vive numa
 * variavel de ambiente dos dois lados, entao nao ha custo em ser longo.
 */
export const MINIMO_DO_INGEST_TOKEN = 32;

/**
 * Confere o segredo da ingestao, e **nunca cai para "aceita tudo"**.
 *
 * Os tres desfechos, e por que cada um e o que e:
 *
 * | Estado | Resposta | Por que |
 * | --- | --- | --- |
 * | `INGEST_TOKEN` ausente, vazio, ou curto | **503** | erro de configuracao do SERVIDOR. 401 diria "seu token esta errado" sobre um problema que nao e de quem chamou, e esconderia o defeito (a mesma razao do `JWT_SECRET` derrubar o boot). |
 * | token ausente ou diferente | **401** | isto sim e problema de quem chamou. |
 * | token igual | passa | |
 *
 * O 503 vem ANTES da comparacao de proposito: com a variavel vazia, um
 * `token === process.env.INGEST_TOKEN` casaria com header ausente, e a rota de
 * escrita atenderia qualquer um — exatamente o que o card proibe.
 */
function exigirTokenDeIngestao(request: RequestWithUser): boolean {
  const esperado = process.env.INGEST_TOKEN ?? '';
  if (esperado.length < MINIMO_DO_INGEST_TOKEN) {
    throw new ServiceUnavailableException(
      'A ingestao de vagas nao esta configurada neste servidor.',
    );
  }

  const header = String(request.headers.authorization ?? '');
  const recebido = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!igualEmTempoFixo(recebido, esperado)) {
    throw new UnauthorizedException('Token de ingestao invalido.');
  }
  return true;
}

/**
 * Comparacao de tempo constante.
 *
 * `===` em string vaza o tamanho do prefixo correto pelo tempo de resposta, e
 * aqui o atacante pode chamar a rota quantas vezes quiser. O
 * `timingSafeEqual` exige buffers do MESMO tamanho, entao o tamanho se compara
 * antes — isso vaza so o comprimento do segredo, que nao ajuda a adivinha-lo.
 */
function igualEmTempoFixo(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Guard global: toda rota exige sessao, a menos que marque @Public().
 *
 * O ponto do desenho e falhar fechado — rota nova que alguem esqueceu de
 * proteger nasce protegida. O guard anterior fazia o oposto: lia
 * `x-user-email`, criava a conta e nunca rejeitava, entao qualquer um virava
 * qualquer um mandando um header.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const alvos = [context.getHandler(), context.getClass()];
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // ⚠️ ANTES de tudo, inclusive de `@Public()` e de `AUTH_DISABLED` (JOB-50).
    //
    // A rota de ingestao e chamada por OUTRA APLICACAO, com segredo proprio, e
    // ESCREVE no banco. Se esta checagem viesse depois do desvio de
    // `AUTH_DISABLED`, ela nunca rodaria no estado atual do projeto — e um
    // endpoint de escrita ficaria aberto a quem alcancasse a porta 3333.
    //
    // Vem antes de `@Public()` pelo mesmo motivo da ordem admin → gestao mais
    // abaixo: um handler com os dois decoradores exige o MAIS restritivo, nao o
    // menos. Marcar os dois nao faz sentido, e aqui nao abre nada.
    const ingestao = this.reflector.getAllAndOverride<boolean>(CHAVE_INGESTAO, alvos);
    if (ingestao) return exigirTokenDeIngestao(request);

    const publica = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICA, alvos);
    if (publica) return true;

    // Login desligado (temporario): nenhuma rota exige token, e todo mundo
    // e a conta de desenvolvimento. Resolve o usuario do banco em vez de
    // deixar passar sem nada — os handlers usam @CurrentUser() e quebrariam.
    if (authDesligada()) {
      request.user = await this.auth.usuarioDeDesenvolvimento();
      // De proposito sem checar CHAVE_ADMIN: com o login desligado, exigir
      // papel deixaria a Configuracoes inacessivel justamente para quem
      // desligou o login para poder mexer nela.
      return true;
    }

    const opcional = this.reflector.getAllAndOverride<boolean>(CHAVE_OPCIONAL, [
      context.getHandler(),
      context.getClass(),
    ]);

    const header = String(request.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      // Sem token numa rota de sessao opcional: segue como anonimo. O handler
      // recebe `null` em @CurrentUser() e devolve a versao sem o dado de quem
      // entrou.
      if (opcional) return true;
      throw new UnauthorizedException('Entre para continuar.');
    }

    // Token presente e sempre verificado, inclusive em rota opcional: aceitar
    // um token invalido em silencio faria a sessao expirada parecer catalogo
    // vazio, e a pessoa acharia que o produto nao tem nada a mostrar.
    const user = await this.auth.verificar(token);
    request.user = user;

    const soAdmin = this.reflector.getAllAndOverride<boolean>(CHAVE_ADMIN, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (soAdmin && user.role !== 'ADMIN') {
      throw new ForbiddenException('Esta acao e restrita a administradores.');
    }

    // O terceiro nivel (PLT-11). Vem DEPOIS do admin de proposito: um handler
    // marcado com os dois decoradores exige o mais restritivo, e nao o menos.
    const gestao = this.reflector.getAllAndOverride<boolean>(CHAVE_GESTAO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (gestao && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      throw new ForbiddenException('Esta acao e restrita a quem gerencia a plataforma.');
    }

    return true;
  }
}
