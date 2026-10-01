/**
 * PLT-13 — **as trilhas sairam, e nao voltam por descuido.**
 *
 * Remocao e a mudanca que mais facilmente se desfaz sozinha: alguem reverte um
 * arquivo, recupera um modulo do git para "aproveitar uma parte", ou um merge
 * traz de volta o registro em `app.module.ts`. Nada disso quebra tela nenhuma
 * — a rota simplesmente volta a responder, sobre tabelas que a migration
 * apagou, e o erro aparece como 500 em producao.
 *
 * Entao o teste afirma o NEGATIVO, que e o que o card pediu:
 *
 * 1. Nenhuma rota de trilha ou progresso existe — por requisicao de verdade,
 *    conferindo 404 (e nao 401, que seria rota viva e protegida).
 * 2. Nenhum controller registrado serve esses caminhos — por descoberta, que
 *    pega o modulo que voltou mesmo que o verbo mude.
 *
 * As duas perguntas sao diferentes, como no `fail-closed.e2e.spec.ts`: a
 * primeira observa o comportamento, a segunda le o que o Nest montou. Um
 * controller que volte com `@Public()` e outro verbo escapa da primeira e cai
 * na segunda.
 *
 * ⚠️ **404 e nao 401 e o ponto.** O guard global e *fail closed*, entao uma
 * rota de trilha que voltasse protegida responderia 401 ao anonimo — e um
 * teste que aceitasse "nao e 200" passaria com a feature de volta no ar.
 */
import { INestApplication } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { nomeDoSchema } from '../../test/banco-de-teste';
import {
  exigirLoginLigado,
  subirAplicacao,
  type AplicacaoDeTeste,
} from '../../test/aplicacao-de-teste';

const SCHEMA = nomeDoSchema(__filename);

/**
 * Os caminhos que a feature servia, como o card os lista.
 *
 * Escritos a mao de proposito, e nao derivados do codigo: derivar de um codigo
 * que nao existe mais daria uma lista vazia, e um `for` sobre nada passa
 * sempre. Cada linha e uma rota que respondia em 30/09.
 */
const ROTAS_QUE_SAIRAM = [
  'GET /api/tracks',
  'GET /api/tracks/system-design',
  'GET /api/tracks/system-design/search?q=cache',
  'GET /api/tracks/system-design/lessons/escalabilidade',
  'PUT /api/progress/alguma-aula',
  'PUT /api/progress/alguma-aula/note',
];

/** Os prefixos que nenhum controller registrado pode servir. */
const PREFIXOS_MORTOS = ['tracks', 'progress'];

describe('PLT-13 — a superficie de trilhas nao existe mais', () => {
  let ctx: AplicacaoDeTeste;
  let prisma: PrismaClient;

  beforeAll(async () => {
    exigirLoginLigado();
    ctx = await subirAplicacao(SCHEMA);
    prisma = ctx.prisma;
  }, 180_000);

  afterAll(async () => {
    await ctx?.app.close();
    await prisma?.$disconnect();
  });

  it.each(ROTAS_QUE_SAIRAM)('%s responde 404', async (linha) => {
    const [verbo, caminho] = linha.split(' ');
    const agente = request(ctx.servidor as Parameters<typeof request>[0]);
    const resp = await (verbo === 'PUT'
      ? agente.put(caminho).send({})
      : agente.get(caminho));

    // 404 e a unica resposta certa. 401 significaria rota viva atras do guard;
    // 200, feature de volta no ar; 500, rota viva sobre tabela apagada.
    expect(resp.status).toBe(404);
  });

  it('nenhum controller registrado serve /tracks ou /progress', () => {
    const caminhos = caminhosRegistrados(ctx.app);

    // O guard contra teste vacuo: se a descoberta parar de achar controller, a
    // lista abaixo fica vazia e o `filter` nao acha nada — passando sem medir.
    expect(caminhos.length).toBeGreaterThan(50);

    const vivos = caminhos.filter((c) =>
      PREFIXOS_MORTOS.some((p) => c === `/${p}` || c.startsWith(`/${p}/`)),
    );
    expect(vivos).toEqual([]);
  });

  it('o schema do Prisma nao tem mais os quatro modelos', () => {
    // A migration apaga as tabelas; isto confere o outro lado, o client.
    // Sem esta checagem, um `schema.prisma` revertido passaria desapercebido
    // ate alguem rodar `migrate dev` e gerar uma migration que as recria.
    const cliente = prisma as unknown as Record<string, unknown>;
    for (const modelo of ['track', 'module', 'lesson', 'progress']) {
      expect(cliente[modelo]).toBeUndefined();
    }
  });
});

/** Os caminhos completos que os controllers montados declaram. */
function caminhosRegistrados(app: INestApplication): string[] {
  const discovery = app.get(DiscoveryService);
  const scanner = new MetadataScanner();
  const caminhos: string[] = [];

  for (const wrapper of discovery.getControllers()) {
    if (!wrapper.metatype || !wrapper.instance) continue;
    const proto = Object.getPrototypeOf(wrapper.instance) as object;
    const base = String(Reflect.getMetadata(PATH_METADATA, wrapper.metatype) ?? '');

    for (const nome of scanner.getAllMethodNames(proto)) {
      const handler = (proto as Record<string, unknown>)[nome] as (
        ...a: unknown[]
      ) => unknown;
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (sub === undefined) continue;
      caminhos.push(`/${base}/${sub}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1'));
    }
  }
  return caminhos;
}
