/**
 * Camada 3 — **nenhuma rota nasce aberta.**
 *
 * Este e o teste mais valioso do projeto, e a razao e o tipo de defeito que ele
 * pega: uma rota nova que alguem marcou `@Public()` "so para testar" e esqueceu
 * de tirar nao quebra tela nenhuma, nao aparece no log, e nao da erro. Ela so
 * responde — para qualquer um que alcance a porta.
 *
 * O `AuthGuard` entra por `APP_GUARD` e e *fail closed*: rota sem decorador
 * nasce protegida (CLAUDE.md). Isso e verdade hoje. O que este arquivo garante
 * e que continue sendo amanha, quando o guard tiver sido mexido por outro
 * motivo.
 *
 * ## Duas perguntas diferentes, e o teste faz as duas
 *
 * 1. **A lista de rotas publicas e exatamente a esperada?** — por metadado.
 *    Pega a rota nova que nasceu `@Public()`.
 * 2. **Uma rota nao-publica REJEITA mesmo o anonimo?** — por requisicao de
 *    verdade, contra todas as rotas registradas.
 *
 * A segunda existe porque a primeira sozinha nao basta: se alguem quebrar o
 * `AuthGuard` (um `return true` no lugar errado), o metadado continuaria
 * dizendo "protegida" e toda rota responderia 200. Ler a intencao declarada nao
 * e o mesmo que observar o comportamento — e a regra da casa e o comportamento.
 */
import { INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import {
  CHAVE_ADMIN,
  CHAVE_GESTAO,
  CHAVE_OPCIONAL,
  CHAVE_PUBLICA,
} from './current-user';
import { nomeDoSchema } from '../../test/banco-de-teste';
import {
  exigirLoginLigado,
  subirAplicacao,
  type AplicacaoDeTeste,
} from '../../test/aplicacao-de-teste';

const SCHEMA = nomeDoSchema(__filename);

/**
 * A lista fechada das rotas publicas, escrita a mao.
 *
 * **E o ponto do teste que ela seja escrita a mao.** Deriva-la do codigo
 * (percorrer os decoradores e comparar consigo mesma) faria um teste que
 * concorda com qualquer coisa que o codigo diga — inclusive com a rota que
 * alguem abriu por engano.
 *
 * Cada linha aqui e uma decisao de produto com motivo registrado:
 *
 * - `GET /auth/config` — o front pergunta se ha login antes de desenhar o
 *   botao. **O healthcheck do compose bate aqui**: se deixar de ser publica, o
 *   container fica eternamente unhealthy (CLAUDE.md).
 * - `POST /auth/google` — e o proprio login; exigir sessao seria circular.
 * - `GET /perfil/paises` — conteudo estatico, igual para todo mundo, e nao diz
 *   nada sobre ninguem.
 * - `POST /email/sair`, `/email/contratado`, `/email/voltar-a-procurar` — o
 *   criterio do JOB-24 e "descadastrar em um clique, SEM login". O que as
 *   protege e o token de 32 bytes na query, nao o guard. Sao `POST` e nao
 *   `GET` porque o pre-carregador de link de alguns clientes de e-mail dispara
 *   `GET` sozinho, e a pessoa sairia sem clicar em nada.
 * - `POST /telegram/webhook` — quem chama e o Telegram, que nao tem sessao. A
 *   protecao e o `secret_token` no header, e a rota devolve 404 quando o bot
 *   nao esta configurado.
 *
 * **Acrescentar uma linha aqui e uma decisao de seguranca.** Se este teste
 * falhou por causa de uma rota nova, a pergunta nao e "como faco o teste
 * passar" — e "esta rota devia mesmo responder a quem nao entrou?".
 */
const PUBLICAS_ESPERADAS = [
  'GET /auth/config',
  'POST /auth/google',
  'GET /perfil/paises',
  'POST /email/sair',
  'POST /email/contratado',
  'POST /email/voltar-a-procurar',
  'POST /telegram/webhook',
].sort();

/**
 * As rotas de sessao opcional: o token, **se vier**, ainda e verificado.
 *
 * Nao sao publicas — a diferenca importa e esta em CLAUDE.md. Um token invalido
 * aqui continua dando 401, em vez de virar anonimo em silencio, porque isso
 * faria sessao expirada parecer trilha zerada e a pessoa acharia que perdeu o
 * progresso.
 *
 * As de `tracks` sao a vitrine (o conteudo e o produto); `jobs/facets` filtra,
 * e filtrar e anonimo como ler uma aula.
 */
const OPCIONAIS_ESPERADAS = [
  'GET /tracks',
  'GET /tracks/:slug',
  'GET /tracks/:slug/search',
  'GET /tracks/:trackSlug/lessons/:lessonSlug',
  'POST /jobs/facets',
].sort();

/** Os verbos do Nest, que guarda o metodo como numero do enum `RequestMethod`. */
const VERBOS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'];

interface Rota {
  controller: string;
  metodo: string;
  verbo: string;
  caminho: string;
  publica: boolean;
  opcional: boolean;
  admin: boolean;
  gestao: boolean;
}

/**
 * Percorre as rotas REGISTRADAS, e nao uma lista mantida a mao.
 *
 * A `DiscoveryService` devolve os controllers que o Nest de fato montou —
 * entao um controller novo entra aqui sozinho, no dia em que for escrito, sem
 * ninguem se lembrar de acrescentar nada. E o que faz este teste envelhecer
 * bem: a protecao vale para o codigo que ainda nao existe.
 */
function levantarRotas(app: INestApplication): Rota[] {
  const discovery = app.get(DiscoveryService);
  const reflector = new Reflector();
  const scanner = new MetadataScanner();
  const rotas: Rota[] = [];

  for (const wrapper of discovery.getControllers()) {
    if (!wrapper.metatype || !wrapper.instance) continue;
    const proto = Object.getPrototypeOf(wrapper.instance) as object;
    const base = String(Reflect.getMetadata(PATH_METADATA, wrapper.metatype) ?? '');

    for (const nome of scanner.getAllMethodNames(proto)) {
      const handler = (proto as Record<string, unknown>)[nome] as (...a: unknown[]) => unknown;
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      // Sem PATH_METADATA nao e handler de rota: e um metodo auxiliar da classe.
      if (sub === undefined) continue;
      const verboNum = Reflect.getMetadata(METHOD_METADATA, handler) as number;

      const alvos = [handler, wrapper.metatype];
      rotas.push({
        controller: wrapper.metatype.name,
        metodo: nome,
        verbo: VERBOS[verboNum] ?? String(verboNum),
        caminho: `/${base}/${sub}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1'),
        publica: reflector.getAllAndOverride<boolean>(CHAVE_PUBLICA, alvos) ?? false,
        opcional: reflector.getAllAndOverride<boolean>(CHAVE_OPCIONAL, alvos) ?? false,
        admin: reflector.getAllAndOverride<boolean>(CHAVE_ADMIN, alvos) ?? false,
        gestao: reflector.getAllAndOverride<boolean>(CHAVE_GESTAO, alvos) ?? false,
      });
    }
  }
  return rotas;
}

/** `GET /tracks/:slug` vira `/tracks/x` — o caminho precisa existir para bater. */
function comParametros(caminho: string): string {
  return caminho.replace(/:[^/]+/g, 'x');
}

/**
 * Uma requisicao pelo verbo que a rota declara.
 *
 * O `supertest` expoe um metodo por verbo (`.get()`, `.post()`, …) e nao um
 * `.request(verbo, caminho)`. Como aqui o verbo so se conhece em tempo de
 * execucao — ele veio do metadado da rota —, o despacho e por tabela.
 */
function pedir(verbo: string, caminho: string, servidor: unknown): request.Test {
  const agente = request(servidor as Parameters<typeof request>[0]);
  switch (verbo) {
    case 'GET':
      return agente.get(caminho);
    case 'POST':
      return agente.post(caminho);
    case 'PUT':
      return agente.put(caminho);
    case 'DELETE':
      return agente.delete(caminho);
    case 'PATCH':
      return agente.patch(caminho);
    default:
      // Nao cai para um verbo qualquer: uma rota com verbo que este helper nao
      // conhece precisa ser vista, e nao testada por engano com GET.
      throw new Error(`Verbo nao previsto no teste de rotas: "${verbo}"`);
  }
}

describe('fail closed — nenhuma rota nasce aberta (camada 3)', () => {
  let ctx: AplicacaoDeTeste;
  let prisma: PrismaClient;
  let rotas: Rota[];

  beforeAll(async () => {
    exigirLoginLigado();
    ctx = await subirAplicacao(SCHEMA);
    prisma = ctx.prisma;
    rotas = levantarRotas(ctx.app);
  }, 180_000);

  afterAll(async () => {
    await ctx?.app.close();
    await prisma?.$disconnect();
  });

  it('acha as rotas de verdade — senao o resto do arquivo mede o vazio', () => {
    // Sem isto, uma mudanca no Nest que quebrasse a descoberta deixaria todos
    // os testes abaixo passando sobre uma lista vazia. Um `for` sobre nada
    // passa sempre, e essa e a forma mais silenciosa de uma suite morrer.
    expect(rotas.length).toBeGreaterThan(50);
    // E toda rota tem verbo reconhecido: um numero cru aqui seria descoberta
    // funcionando pela metade.
    for (const r of rotas) {
      expect(VERBOS).toContain(r.verbo);
    }
  });

  describe('a lista de rotas publicas e exatamente esta', () => {
    it('nenhuma rota publica alem das sete decididas', () => {
      const publicas = rotas
        .filter((r) => r.publica)
        .map((r) => `${r.verbo} ${r.caminho}`)
        .sort();

      // A mensagem do `expect` importa tanto quanto a comparacao: quem quebrar
      // isto precisa ler a lista comentada acima, e nao so ver dois arrays
      // diferentes.
      expect(publicas).toEqual(PUBLICAS_ESPERADAS);
    });

    it('nenhuma rota de sessao opcional alem das cinco decididas', () => {
      const opcionais = rotas
        .filter((r) => r.opcional)
        .map((r) => `${r.verbo} ${r.caminho}`)
        .sort();

      expect(opcionais).toEqual(OPCIONAIS_ESPERADAS);
    });

    it('publica e opcional sao exclusivas — marcar as duas e engano', () => {
      // `@Public()` vence no guard (ele retorna antes de olhar o opcional),
      // entao marcar as duas abriria a rota achando que a fechou.
      const ambas = rotas.filter((r) => r.publica && r.opcional);
      expect(ambas.map((r) => `${r.verbo} ${r.caminho}`)).toEqual([]);
    });

    it('nenhuma rota publica exige papel — seria contradicao muda', () => {
      // `@Public()` faz o guard retornar antes de checar `@AdminOnly()`. Um
      // handler com os dois nao da erro: ele simplesmente ignora o papel, e
      // quem leu o codigo acharia que a rota e restrita.
      const contraditorias = rotas.filter((r) => r.publica && (r.admin || r.gestao));
      expect(contraditorias.map((r) => `${r.verbo} ${r.caminho}`)).toEqual([]);
    });
  });

  describe('e o comportamento confirma o metadado', () => {
    /**
     * O teste que pega o guard quebrado.
     *
     * Percorre TODA rota nao-publica e nao-opcional, faz a requisicao sem
     * token, e exige 401. Nao inspeciona decorador nenhum aqui de proposito: e
     * a unica forma de detectar um `AuthGuard` que passou a deixar passar.
     *
     * O corpo vai vazio, e isso e suficiente: o guard roda ANTES do
     * `ValidationPipe`, entao uma rota protegida responde 401 mesmo com corpo
     * invalido. Se alguma responder 400, e sinal de que o pipe correu antes do
     * guard — que seria a mesma falha por outro caminho.
     */
    it('TODA rota protegida responde 401 ao anonimo', async () => {
      const protegidas = rotas.filter((r) => !r.publica && !r.opcional);
      expect(protegidas.length).toBeGreaterThan(40);

      const vazaram: string[] = [];
      for (const r of protegidas) {
        const caminho = `/api${comParametros(r.caminho)}`;
        const resp = await pedir(r.verbo, caminho, ctx.servidor);

        if (resp.status !== 401) {
          vazaram.push(`${r.verbo} ${caminho} respondeu ${resp.status} (esperado 401)`);
        }
      }

      // Uma lista e nao um `expect` por rota: se o guard quebrar, quero ver as
      // 48 de uma vez, e nao a primeira.
      expect(vazaram).toEqual([]);
    }, 60_000);

    it('as rotas publicas NAO respondem 401 — elas existem para o anonimo', async () => {
      // O contrapositivo do teste acima. Sem ele, um guard que rejeitasse tudo
      // (fail closed levado longe demais) passaria no teste anterior e
      // derrubaria o login e o healthcheck do compose.
      const publicas = rotas.filter((r) => r.publica);
      const negadas: string[] = [];

      for (const r of publicas) {
        const caminho = `/api${comParametros(r.caminho)}`;
        const resp = await pedir(r.verbo, caminho, ctx.servidor);

        // 400/404 sao respostas legitimas aqui (corpo ausente, token de
        // e-mail invalido, webhook desligado). O que nao pode e 401: isso
        // seria o guard barrando quem a rota existe para atender.
        if (resp.status === 401) {
          negadas.push(`${r.verbo} ${caminho} respondeu 401`);
        }
      }

      expect(negadas).toEqual([]);
    }, 30_000);

    it('as rotas de sessao opcional atendem o anonimo, sem 401', async () => {
      const opcionais = rotas.filter((r) => r.opcional);
      const negadas: string[] = [];

      for (const r of opcionais) {
        const caminho = `/api${comParametros(r.caminho)}`;
        const resp = await pedir(r.verbo, caminho, ctx.servidor);
        if (resp.status === 401) {
          negadas.push(`${r.verbo} ${caminho} respondeu 401 sem token`);
        }
      }

      expect(negadas).toEqual([]);
    }, 30_000);

    it('token INVALIDO em rota opcional da 401, e nao vira anonimo', async () => {
      // A regra de CLAUDE.md que o `@SessaoOpcional()` existe para respeitar.
      // Aceitar o token podre em silencio faria a sessao expirada parecer
      // trilha zerada — e a pessoa acharia que perdeu o progresso.
      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .get('/api/tracks')
        .set('Authorization', 'Bearer abc.def.ghi');

      expect(resp.status).toBe(401);
    });

    it('token assinado com OUTRO segredo e recusado', async () => {
      // O segredo e o que separa um token nosso de um token que alguem montou.
      // Sem esta checagem, `jwt.decode` no lugar de `jwt.verify` passaria
      // despercebido — e qualquer um forjaria um admin.
      const forjado = jwt.sign(
        { sub: '00000000-0000-4000-8000-000000000000', email: 'x@y.z', role: 'ADMIN' },
        'um-segredo-que-nao-e-o-desta-aplicacao',
        { expiresIn: '1h' },
      );

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forjado}`);

      expect(resp.status).toBe(401);
    });

    it('token EXPIRADO e recusado', async () => {
      const usuario = await prisma.user.create({
        data: { email: `expirado.${Date.now()}@teste.local`, name: 'Exp', provider: 'DEV' },
        select: { id: true, email: true },
      });
      const vencido = jwt.sign(
        { sub: usuario.id, email: usuario.email, role: 'COMMON_USER' },
        process.env.JWT_SECRET as string,
        { expiresIn: '-1h' },
      );

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${vencido}`);

      expect(resp.status).toBe(401);
    });

    it('token de usuario que nao existe mais e recusado', async () => {
      // O guard rele o usuario do banco a cada request (CLAUDE.md). Uma conta
      // apagada tem de valer na requisicao seguinte, e nao daqui a 30 dias.
      const usuario = await prisma.user.create({
        data: { email: `sumiu.${Date.now()}@teste.local`, name: 'Sumiu', provider: 'DEV' },
        select: { id: true, email: true },
      });
      const token = jwt.sign(
        { sub: usuario.id, email: usuario.email, role: 'COMMON_USER' },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' },
      );
      await prisma.user.delete({ where: { id: usuario.id } });

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(resp.status).toBe(401);
    });

    it('conta DESATIVADA e recusada, mesmo com token valido', async () => {
      // A razao de o guard pagar um SELECT por request: desativar uma conta
      // abusiva vale na requisicao seguinte (PLT-11), sem esperar o token de
      // 30 dias expirar.
      const usuario = await prisma.user.create({
        data: {
          email: `desativado.${Date.now()}@teste.local`,
          name: 'Desativado',
          provider: 'DEV',
          active: false,
        },
        select: { id: true, email: true },
      });
      const token = jwt.sign(
        { sub: usuario.id, email: usuario.email, role: 'COMMON_USER' },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' },
      );

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(resp.status).toBe(401);
    });

    it('header Authorization malformado nao passa', async () => {
      // Sem o prefixo `Bearer ` o guard trata como ausencia de token. Vale
      // conferir que ausencia continua sendo 401, e nao um caminho que escapa.
      for (const header of ['', 'Bearer', 'Basic abc', 'abc.def.ghi', 'Bearer ']) {
        const resp = await request(ctx.servidor as Parameters<typeof request>[0])
          .get('/api/auth/me')
          .set('Authorization', header);
        expect([401]).toContain(resp.status);
      }
    });
  });
});
