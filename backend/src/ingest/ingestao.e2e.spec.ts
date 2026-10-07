/**
 * JOB-50 — **o Horizons recebe vagas rastreadas, e so de quem tem o segredo.**
 *
 * O card tem duas metades que falham de formas diferentes, e esta suite cobre
 * as duas:
 *
 * 1. **O contrato do lote** — idempotencia, upsert que atualiza, confirmar que
 *    so mexe na data, fechar que apaga a linha e nao o que e do usuario. Falha
 *    visivel: a contagem nao bate.
 * 2. **A porta** — sem token, token errado, ou sem `INGEST_TOKEN` configurado.
 *    Falha INVISIVEL: a rota continua respondendo 201, o rastreador continua
 *    funcionando, e qualquer um que alcance a porta 3333 escreve no acervo.
 *
 * ## ⚠️ Esta suite RODA com `AUTH_DISABLED=true`, e e o ponto
 *
 * Todas as outras suites de camada 3 chamam `exigirLoginLigado()` e morrem no
 * modo aberto — com razao: elas medem papel, e com o login desligado o guard
 * retorna antes de olhar papel.
 *
 * Aqui e o contrario. O card pede que o 401 valha **inclusive com
 * `AUTH_DISABLED=true`**, porque e esse o estado atual do projeto e porque
 * esta rota ESCREVE no banco. Entao a suite:
 *
 * - **nao** chama `exigirLoginLigado()`;
 * - roda os dois modos no mesmo arquivo, trocando `process.env.AUTH_DISABLED`
 *   entre os testes — pode, porque `authDesligada()` le a variavel a cada
 *   chamada, e nao no boot;
 * - afirma o MESMO 401 nos dois.
 *
 * Sem isso, o teste passaria na maquina de quem tem `AUTH_DISABLED=false` e
 * nao diria nada sobre o servidor que esta no ar.
 *
 * ## Por que nao ha teste do decorador por metadado aqui
 *
 * Porque ele ja existe, e e melhor onde esta: o `fail-closed.e2e.spec.ts`
 * percorre as rotas REGISTRADAS e exige 401 do anonimo em toda rota que nao
 * esteja nas listas de publicas/opcionais. `POST /ingest/jobs` nao esta em
 * nenhuma das duas, entao ela cai nesse piso automaticamente — e se alguem,
 * amanha, trocar o `@TokenDeIngestao()` por `@Public()`, a lista fechada
 * daquele arquivo quebra. Nao houve excecao nomeada a acrescentar lá, e isso
 * foi deliberado no desenho.
 */
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { LIMITE_DO_CORPO } from '../limite-do-corpo';
import { PrismaService } from '../prisma/prisma.service';
import { IngestService } from './ingest.service';
import { ITENS_POR_LISTA } from './ingest.dto';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  limpar,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';
import { assinarToken } from '../../test/aplicacao-de-teste';

/** O client de dentro da transacao interativa, como o Prisma o entrega. */
type Transacao = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const SCHEMA = nomeDoSchema(__filename);

/** O segredo desta suite. 32+ caracteres, como o guard exige. */
const TOKEN = 'token-de-ingestao-de-teste-com-mais-de-32';

/** Uma vaga do lote, com o minimo e o que o teste quiser por cima. */
function vaga(idExterno: string, extras: Record<string, unknown> = {}) {
  return {
    fonte: 'greenhouse',
    idExterno,
    title: 'Backend Engineer',
    company: 'Acme',
    url: `https://job-boards.greenhouse.io/acme/jobs/${idExterno}`,
    local: 'Remote, Canada',
    regime: 'remoto',
    skills: ['node', 'typescript'],
    postedAt: '2026-09-20T12:00:00.000Z',
    ...extras,
  };
}

describe('JOB-50 — ingestao de vagas rastreadas (camada 3)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let servidor: Parameters<typeof request>[0];
  let ingest: IngestService;
  /** O valor que a maquina tinha, para a suite nao vazar o modo que escolheu. */
  let authOriginal: string | undefined;

  beforeAll(async () => {
    authOriginal = process.env.AUTH_DISABLED;
    process.env.INGEST_TOKEN = TOKEN;

    prepararSchema(SCHEMA);
    prisma = clientDeTeste(SCHEMA);
    await exigirSchemaDeTeste(prisma, SCHEMA);

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = modulo.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.useBodyParser('json', { limit: LIMITE_DO_CORPO });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
    ingest = app.get(IngestService);
  }, 180_000);

  afterAll(async () => {
    // O ambiente volta ao que era: uma suite que deixasse `AUTH_DISABLED`
    // ligada derrubaria as suites de papel que rodam depois dela.
    if (authOriginal === undefined) delete process.env.AUTH_DISABLED;
    else process.env.AUTH_DISABLED = authOriginal;
    delete process.env.INGEST_TOKEN;
    delete process.env.INGEST_DIAS_SEM_CONFIRMACAO;
    await app?.close();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await limpar(prisma, SCHEMA);
    process.env.INGEST_TOKEN = TOKEN;
    process.env.AUTH_DISABLED = 'false';
    delete process.env.INGEST_DIAS_SEM_CONFIRMACAO;
  });

  /** O POST do lote, com o token certo salvo contrario. */
  function enviar(corpo: unknown, token: string | null = TOKEN) {
    const r = request(servidor).post('/api/ingest/jobs');
    if (token !== null) r.set('Authorization', `Bearer ${token}`);
    return r.send(corpo as object);
  }

  // ------------------------------------------------------------------
  // A PORTA
  // ------------------------------------------------------------------
  describe('a porta — o segredo proprio, e nao o AuthGuard', () => {
    /**
     * O teste que o card pede com estas palavras: *"inclusive com
     * `AUTH_DISABLED=true`"*.
     *
     * `it.each` sobre os dois modos, e nao dois testes copiados: o que importa
     * e que a resposta seja a MESMA nos dois, e um `each` torna impossivel
     * corrigir um e esquecer o outro.
     */
    it.each(['false', 'true'])(
      'sem token nenhum responde 401 (AUTH_DISABLED=%s)',
      async (modo) => {
        process.env.AUTH_DISABLED = modo;
        const resp = await enviar({ upsert: [vaga('1')] }, null);
        expect(resp.status).toBe(401);
        // E nada foi gravado. O status sozinho nao basta: um handler que
        // gravasse e DEPOIS rejeitasse passaria no `expect` acima.
        expect(await prisma.trackedJob.count()).toBe(0);
      },
    );

    it.each(['false', 'true'])(
      'token ERRADO responde 401 (AUTH_DISABLED=%s)',
      async (modo) => {
        process.env.AUTH_DISABLED = modo;
        const resp = await enviar(
          { upsert: [vaga('1')] },
          'token-errado-mas-do-mesmo-tamanho-xxxxxx',
        );
        expect(resp.status).toBe(401);
        expect(await prisma.trackedJob.count()).toBe(0);
      },
    );

    it('token com o PREFIXO certo e o resto errado tambem e 401', async () => {
      // O caso que uma comparacao por `startsWith` deixaria passar.
      const resp = await enviar({ upsert: [vaga('1')] }, TOKEN.slice(0, 20));
      expect(resp.status).toBe(401);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('header sem o prefixo Bearer nao passa', async () => {
      const resp = await request(servidor)
        .post('/api/ingest/jobs')
        .set('Authorization', TOKEN)
        .send({ upsert: [vaga('1')] });
      expect(resp.status).toBe(401);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('um JWT de sessao valido NAO abre a rota de ingestao', async () => {
      // A confusao mais plausivel de quem mexer nisto amanha: "e token, entao
      // o AuthGuard resolve". Nao resolve — sao dois segredos com dois
      // propositos, e uma conta de usuario nao autoriza escrever no acervo.
      const usuario = await prisma.user.create({
        data: { email: `ingest.${Date.now()}@teste.local`, name: 'U', provider: 'DEV' },
        select: { id: true, email: true },
      });
      const jwtDeSessao = assinarToken({ ...usuario, role: 'ADMIN' });

      const resp = await enviar({ upsert: [vaga('1')] }, jwtDeSessao);
      expect(resp.status).toBe(401);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it.each(['false', 'true'])(
      'SEM INGEST_TOKEN configurado: 503, e nada e gravado (AUTH_DISABLED=%s)',
      async (modo) => {
        process.env.AUTH_DISABLED = modo;
        delete process.env.INGEST_TOKEN;

        // Com o token certo no header, para provar que o 503 nao e sobre quem
        // chamou: a configuracao esta faltando NO SERVIDOR.
        const resp = await enviar({ upsert: [vaga('1')] });
        expect(resp.status).toBe(503);
        // O criterio do card, por escrito: *"503, e nada e gravado"*. Confere
        // o BANCO, e nao so o status.
        expect(await prisma.trackedJob.count()).toBe(0);
      },
    );

    it('INGEST_TOKEN vazio tambem e 503 — e nao "qualquer token serve"', async () => {
      // A armadilha concreta: com `esperado = ''`, um `recebido === esperado`
      // casaria com header AUSENTE, e a rota de escrita atenderia todo mundo.
      process.env.INGEST_TOKEN = '';
      const resp = await enviar({ upsert: [vaga('1')] }, null);
      expect(resp.status).toBe(503);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('INGEST_TOKEN curto e 503 — segredo fraco e erro de configuracao', async () => {
      process.env.INGEST_TOKEN = 'curto';
      const resp = await enviar({ upsert: [vaga('1')] }, 'curto');
      expect(resp.status).toBe(503);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('com o token certo, atende — senao o resto da suite mede o vazio', async () => {
      const resp = await enviar({ upsert: [vaga('1')] });
      expect(resp.status).toBe(201);
    });
  });

  // ------------------------------------------------------------------
  // O CONTRATO DO LOTE
  // ------------------------------------------------------------------
  describe('o lote — upsert, confirmar, fechar', () => {
    it('o MESMO lote duas vezes deixa o banco identico', async () => {
      const lote = { upsert: [vaga('1'), vaga('2')], fechar: [{ fonte: 'lever', idExterno: 'x' }] };

      const primeira = await enviar(lote);
      expect(primeira.status).toBe(201);
      // O estado inteiro, e nao a contagem: o card pede *"deixa o banco
      // identico"*, e uma contagem igual esconderia conteudo sobrescrito.
      const depoisDaPrimeira = await estado(prisma);

      const segunda = await enviar(lote);
      expect(segunda.status).toBe(201);
      const depoisDaSegunda = await estado(prisma);

      expect(depoisDaSegunda).toEqual(depoisDaPrimeira);
      // A resposta tambem e a mesma: e com ela que o rastreador esvazia a fila.
      expect(segunda.body).toEqual(primeira.body);
      expect(primeira.body).toEqual({ gravadas: 2, confirmadas: 0, fechadas: 0 });
    });

    it('upsert de vaga EXISTENTE atualiza, nao duplica', async () => {
      await enviar({ upsert: [vaga('1', { title: 'Backend Engineer' })] });
      await enviar({
        upsert: [vaga('1', { title: 'Senior Backend Engineer', company: 'Acme Inc' })],
      });

      const linhas = await prisma.trackedJob.findMany({
        select: { fonte: true, idExterno: true, title: true, company: true },
      });
      expect(linhas).toHaveLength(1);
      expect(linhas[0].title).toBe('Senior Backend Engineer');
      expect(linhas[0].company).toBe('Acme Inc');
    });

    it('a chave e (fonte, idExterno) — o mesmo id em outra fonte e outra vaga', async () => {
      // Sem a fonte na chave, dois boards com o mesmo id numerico colidiriam e
      // uma vaga apagaria a outra.
      await enviar({
        upsert: [vaga('1'), vaga('1', { fonte: 'lever', company: 'Outra' })],
      });
      expect(await prisma.trackedJob.count()).toBe(2);
    });

    it('createdAt NAO e regravado no upsert — vaga antiga nao vira nova', async () => {
      await enviar({ upsert: [vaga('1')] });
      const antes = await prisma.trackedJob.findFirstOrThrow({
        select: { createdAt: true },
      });

      await esperar(25);
      await enviar({ upsert: [vaga('1', { title: 'Outro titulo' })] });
      const depois = await prisma.trackedJob.findFirstOrThrow({
        select: { createdAt: true, confirmadaEm: true },
      });

      expect(depois.createdAt.getTime()).toBe(antes.createdAt.getTime());
      // Mas a confirmacao avanca: toda mencao confirma.
      expect(depois.confirmadaEm.getTime()).toBeGreaterThan(antes.createdAt.getTime());
    });

    it('confirmar muda SO confirmadaEm', async () => {
      await enviar({ upsert: [vaga('1')] });
      const antes = await prisma.trackedJob.findFirstOrThrow();

      await esperar(25);
      const resp = await enviar({ confirmar: [{ fonte: 'greenhouse', idExterno: '1' }] });
      expect(resp.status).toBe(201);
      expect(resp.body).toEqual({ gravadas: 0, confirmadas: 1, fechadas: 0 });

      const depois = await prisma.trackedJob.findFirstOrThrow();
      expect(depois.confirmadaEm.getTime()).toBeGreaterThan(antes.confirmadaEm.getTime());
      // Todo o resto fica igual. Compara o registro INTEIRO menos as duas
      // colunas de tempo que devem mexer — assim um campo zerado por engano
      // aparece aqui, inclusive um que ainda nao existe hoje.
      const { confirmadaEm: _a, updatedAt: _b, ...restoAntes } = antes;
      const { confirmadaEm: _c, updatedAt: _d, ...restoDepois } = depois;
      expect(restoDepois).toEqual(restoAntes);
    });

    it('confirmar id INEXISTENTE e sucesso, e nao cria linha', async () => {
      const resp = await enviar({ confirmar: [{ fonte: 'greenhouse', idExterno: 'nunca-vi' }] });
      expect(resp.status).toBe(201);
      expect(resp.body.confirmadas).toBe(0);
      // O ponto: `confirmar` nao e um upsert disfarcado. Uma vaga que o
      // Horizons nunca recebeu nao pode nascer de uma reconfirmacao sem
      // conteudo — seria uma linha com titulo vazio na busca.
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('fechar APAGA a linha, e a SavedJob da mesma URL continua la', async () => {
      // O criterio de aceite mais importante do card: apagar vaga rastreada
      // nao mexe no que e do usuario.
      const usuario = await prisma.user.create({
        data: { email: `salvou.${Date.now()}@teste.local`, name: 'S', provider: 'DEV' },
        select: { id: true },
      });
      const v = vaga('1');
      await enviar({ upsert: [v] });
      const salva = await prisma.savedJob.create({
        data: {
          userId: usuario.id,
          title: v.title,
          company: v.company,
          url: v.url,
          skills: [],
          benefits: [],
          foundAt: new Date(),
        },
        select: { id: true },
      });
      await prisma.jobHistory.create({
        data: {
          userId: usuario.id,
          url: v.url,
          estado: 'visto',
          title: v.title,
          company: v.company,
        },
      });

      const resp = await enviar({ fechar: [{ fonte: 'greenhouse', idExterno: '1' }] });
      expect(resp.status).toBe(201);
      expect(resp.body).toEqual({ gravadas: 0, confirmadas: 0, fechadas: 1 });

      expect(await prisma.trackedJob.count()).toBe(0);
      // E o que e da pessoa NAO foi tocado.
      expect(await prisma.savedJob.count({ where: { id: salva.id } })).toBe(1);
      expect(await prisma.jobHistory.count({ where: { url: v.url } })).toBe(1);
    });

    it('fechar id INEXISTENTE e sucesso — reenvio de lote e o caso normal', async () => {
      const resp = await enviar({ fechar: [{ fonte: 'greenhouse', idExterno: 'nunca-existiu' }] });
      expect(resp.status).toBe(201);
      expect(resp.body.fechadas).toBe(0);
    });

    it('fechar duas vezes a mesma vaga: 1 e depois 0, as duas com 201', async () => {
      await enviar({ upsert: [vaga('1')] });
      const a = await enviar({ fechar: [{ fonte: 'greenhouse', idExterno: '1' }] });
      const b = await enviar({ fechar: [{ fonte: 'greenhouse', idExterno: '1' }] });
      expect([a.status, b.status]).toEqual([201, 201]);
      expect([a.body.fechadas, b.body.fechadas]).toEqual([1, 0]);
    });

    it('lote vazio e lote sem lista nenhuma sao aceitos, com zeros', async () => {
      // O rastreador pode ter uma rodada em que nada mudou. Um 400 aqui faria
      // ele tratar "nada a fazer" como erro e reenviar para sempre.
      for (const corpo of [{}, { upsert: [], confirmar: [], fechar: [] }]) {
        const resp = await enviar(corpo);
        expect(resp.status).toBe(201);
        expect(resp.body).toEqual({ gravadas: 0, confirmadas: 0, fechadas: 0 });
      }
    });

    it('a mesma vaga no upsert E no fechar termina FECHADA', async () => {
      // Lote incoerente nao e erro de validacao — e informacao contraditoria
      // vinda de duas passadas do rastreador. O desfecho seguro e a vaga sair
      // da busca, nao ficar servindo link que o ATS ja desmentiu.
      const resp = await enviar({
        upsert: [vaga('1')],
        fechar: [{ fonte: 'greenhouse', idExterno: '1' }],
      });
      expect(resp.status).toBe(201);
      expect(resp.body).toEqual({ gravadas: 1, confirmadas: 0, fechadas: 1 });
      expect(await prisma.trackedJob.count()).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // A VALIDACAO
  // ------------------------------------------------------------------
  describe('a validacao — @ValidateNested + @Type de verdade', () => {
    it('o item do lote E validado: idExterno vazio da 400', async () => {
      // **O teste que pega o `@ValidateNested` ausente.** Sem ele, os
      // decoradores de dentro de `VagaRastreadaDto` nunca rodam e isto
      // gravaria uma linha com chave vazia.
      const resp = await enviar({ upsert: [vaga('', {})] });
      expect(resp.status).toBe(400);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('o item do lote NAO e esvaziado pelo whitelist', async () => {
      // **O teste que pega o `@Type` ausente**, que e o pior caso do card:
      // sem ele o `class-transformer` nao sabe em que classe transformar o
      // item, o `whitelist` apaga todos os campos, e o lote passaria com 201
      // gravando vazio. Conferir o CONTEUDO e o unico jeito de ver isso.
      const resp = await enviar({ upsert: [vaga('1', { title: 'Platform Engineer' })] });
      expect(resp.status).toBe(201);
      const linha = await prisma.trackedJob.findFirstOrThrow();
      expect(linha.title).toBe('Platform Engineer');
      expect(linha.company).toBe('Acme');
      expect(linha.skills).toEqual(['node', 'typescript']);
    });

    it('campo desconhecido no item da 400 (forbidNonWhitelisted)', async () => {
      const resp = await enviar({ upsert: [vaga('1', { campoQueNaoExiste: 'x' })] });
      expect(resp.status).toBe(400);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('postedAt invalido da 400, e nao Invalid Date no banco', async () => {
      const resp = await enviar({ upsert: [vaga('1', { postedAt: 'banana' })] });
      expect(resp.status).toBe(400);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it(`mais de ${ITENS_POR_LISTA} itens numa lista da 400`, async () => {
      const demais = Array.from({ length: ITENS_POR_LISTA + 1 }, (_, i) => vaga(String(i)));
      const resp = await enviar({ upsert: demais });
      expect(resp.status).toBe(400);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it(`o lote CHEIO (${ITENS_POR_LISTA} em cada lista) passa — o teto cabe no corpo`, async () => {
      // A outra metade da armadilha do card: um teto que o limite de corpo nao
      // aceita e um teto que nunca se alcanca.
      //
      // ⚠️ **O tamanho do corpo e parte do teste, e e por isso que ele esta
      // afirmado aqui.** A primeira versao deste teste mandava 200 vagas
      // enxutas e dava 97,3 KB — passava RASPANDO nos 102.400 bytes do padrao
      // do Express, entao a mutacao que devolvia `LIMITE_DO_CORPO` para
      // '100kb' NAO era detectada. Um teste que nao falha com o codigo
      // quebrado nao testa nada.
      //
      // Agora o lote e o do card (as tres listas cheias, vaga realista) e o
      // `expect` sobre o tamanho garante que ele continue ACIMA do padrao: se
      // alguem enxugar o `vaga()` daqui, o teste reclama em vez de voltar a
      // passar por sorte.
      const completa = (i: number) =>
        vaga(String(i), {
          title: 'Senior Backend Engineer (Node.js / TypeScript)',
          company: 'Acme Corporation International',
          local: 'Remote — LATAM (Brazil, Argentina, Mexico)',
          area: 'Back-end Engineer',
          anosExp: 5,
          degree: "Bachelor's",
          logoUrl: 'https://logo.clearbit.com/acmecorp.com',
          paisIso: 'us',
          benefits: ['remote work', 'health insurance', 'equity', 'learning budget'],
          skills: ['node', 'typescript', 'postgres', 'docker', 'kubernetes', 'aws', 'graphql', 'react'],
          snapshot: {
            salaryMin: 90000,
            salaryMax: 140000,
            currency: 'USD',
            salaryTrecho:
              'We offer a salary range of $90,000 - $140,000 USD depending on experience and location.',
          },
        });
      const refs = Array.from({ length: ITENS_POR_LISTA }, (_, i) => ({
        fonte: 'lever',
        idExterno: `ref-${i}`,
      }));
      const lote = {
        upsert: Array.from({ length: ITENS_POR_LISTA }, (_, i) => completa(i)),
        confirmar: refs,
        fechar: refs,
      };

      // O corpo PASSA dos 102.400 bytes do padrao (`body-parser/lib/utils.js`).
      // Sem este piso o teste nao exerceria o limite nenhum.
      const bytes = Buffer.byteLength(JSON.stringify(lote));
      expect(bytes).toBeGreaterThan(102_400);

      const resp = await enviar(lote);
      expect(resp.status).toBe(201);
      expect(resp.body.gravadas).toBe(ITENS_POR_LISTA);
      expect(await prisma.trackedJob.count()).toBe(ITENS_POR_LISTA);
    }, 60_000);
  });

  // ------------------------------------------------------------------
  // A ELEGIBILIDADE
  // ------------------------------------------------------------------
  describe('a elegibilidade vem do Horizons, nunca do rastreador', () => {
    it('sai de lerElegibilidade sobre o `local` cru', async () => {
      await enviar({ upsert: [vaga('1', { local: 'Remote, Canada' })] });
      const linha = await prisma.trackedJob.findFirstOrThrow({ select: { snapshot: true } });
      const snap = linha.snapshot as Record<string, unknown>;
      expect(snap.paisesElegiveis).toEqual(['Canada']);
      expect(snap.elegivelGlobal).toBe(false);
      expect(snap.elegibilidadeTrecho).toBe('Remote, Canada');
    });

    it('"Worldwide" no local vira elegivelGlobal', async () => {
      await enviar({ upsert: [vaga('1', { local: 'Remote — Worldwide' })] });
      const linha = await prisma.trackedJob.findFirstOrThrow({ select: { snapshot: true } });
      const snap = linha.snapshot as Record<string, unknown>;
      expect(snap.elegivelGlobal).toBe(true);
      expect(snap.paisesElegiveis).toBeNull();
    });

    it('o rastreador NAO consegue afirmar elegibilidade por campo proprio', async () => {
      // `forbidNonWhitelisted` rejeita o campo que o DTO nao tem — e isso e a
      // resposta certa, nao um incomodo: quem decide quem a vaga aceita e o
      // Horizons (JOB-49, "quem e dono de que").
      const resp = await enviar({
        upsert: [vaga('1', { paisesElegiveis: ['Brazil'], elegivelGlobal: true })],
      });
      expect(resp.status).toBe(400);
    });

    it('elegibilidade enviada DENTRO do snapshot e sobrescrita, nao obedecida', async () => {
      // O caminho que escapa do `forbidNonWhitelisted`: `snapshot` e
      // `@IsObject()`, entao o rastreador pode por o que quiser dentro dele.
      // O servico sobrescreve os campos de elegibilidade de proposito — se a
      // ordem do spread fosse invertida, a mentira do terceiro venceria.
      await enviar({
        upsert: [
          vaga('1', {
            local: 'Remote, Canada',
            snapshot: {
              paisesElegiveis: ['Brazil'],
              elegivelGlobal: true,
              salaryMin: 100000,
            },
          }),
        ],
      });
      const linha = await prisma.trackedJob.findFirstOrThrow({ select: { snapshot: true } });
      const snap = linha.snapshot as Record<string, unknown>;
      expect(snap.paisesElegiveis).toEqual(['Canada']);
      expect(snap.elegivelGlobal).toBe(false);
      // E o que NAO e elegibilidade continua vindo do rastreador.
      expect(snap.salaryMin).toBe(100000);
    });
  });

  // ------------------------------------------------------------------
  // A LIMPEZA
  // ------------------------------------------------------------------
  describe('a limpeza por falta de confirmacao', () => {
    /** Grava uma vaga e empurra o `confirmadaEm` para N dias atras. */
    async function vagaConfirmadaHa(idExterno: string, dias: number): Promise<void> {
      await enviar({ upsert: [vaga(idExterno)] });
      await prisma.trackedJob.update({
        where: { fonte_idExterno: { fonte: 'greenhouse', idExterno } },
        data: { confirmadaEm: new Date(Date.now() - dias * 86_400_000) },
      });
    }

    it('apaga a vencida e POUPA a confirmada ontem', async () => {
      await vagaConfirmadaHa('vencida', 10);
      await vagaConfirmadaHa('ontem', 1);

      const { apagadas } = await ingest.limpar();
      expect(apagadas).toBe(1);

      const sobraram = await prisma.trackedJob.findMany({ select: { idExterno: true } });
      // Nominalmente, e nao por contagem: um `toBe(1)` passaria se a limpeza
      // apagasse a errada.
      expect(sobraram.map((s) => s.idExterno)).toEqual(['ontem']);
    });

    it('nao apaga a vaga confirmada exatamente no limite', async () => {
      // `lt` e nao `lte`: na fronteira, poupar e o lado certo de errar.
      await enviar({ upsert: [vaga('limite')] });
      const limite = new Date(Date.now() - 7 * 86_400_000);
      await prisma.trackedJob.update({
        where: { fonte_idExterno: { fonte: 'greenhouse', idExterno: 'limite' } },
        data: { confirmadaEm: limite },
      });

      const { apagadas } = await ingest.limpar(new Date(limite.getTime() + 7 * 86_400_000));
      expect(apagadas).toBe(0);
    });

    it('o prazo e configuravel por INGEST_DIAS_SEM_CONFIRMACAO', async () => {
      await vagaConfirmadaHa('tres-dias', 3);

      // Com o padrao de 7 dias, ela fica.
      expect((await ingest.limpar()).apagadas).toBe(0);

      // Com 2, ela sai.
      process.env.INGEST_DIAS_SEM_CONFIRMACAO = '2';
      expect((await ingest.limpar()).apagadas).toBe(1);
    });

    it('INGEST_DIAS_SEM_CONFIRMACAO absurda cai no padrao, e nao em zero', async () => {
      // Um `0` aceito apagaria o acervo inteiro na primeira limpeza, e
      // `Number('abc')` e NaN — os dois tem de cair no padrao de 7.
      await vagaConfirmadaHa('hoje', 0);
      for (const valor of ['0', '-5', 'abc', '']) {
        process.env.INGEST_DIAS_SEM_CONFIRMACAO = valor;
        expect((await ingest.limpar()).apagadas).toBe(0);
      }
      expect(await prisma.trackedJob.count()).toBe(1);
    });

    it('a limpeza nao toca em SavedJob nem em JobHistory', async () => {
      const usuario = await prisma.user.create({
        data: { email: `limpeza.${Date.now()}@teste.local`, name: 'L', provider: 'DEV' },
        select: { id: true },
      });
      const v = vaga('vencida');
      await vagaConfirmadaHa('vencida', 30);
      await prisma.savedJob.create({
        data: {
          userId: usuario.id,
          title: v.title,
          company: v.company,
          url: v.url,
          skills: [],
          benefits: [],
          foundAt: new Date(),
        },
      });

      expect((await ingest.limpar()).apagadas).toBe(1);
      expect(await prisma.savedJob.count()).toBe(1);
    });

    it('a limpeza nao toca em FoundJob — a copia local e outra tabela', async () => {
      // Tabelas separadas por desenho (ver o comentario do modelo). Uma
      // limpeza que varresse `found_jobs` apagaria o cache da busca junto.
      await prisma.foundJob.create({
        data: {
          grupo: 'g',
          title: 'T',
          company: 'C',
          url: 'https://exemplo.com/1',
          skills: [],
          benefits: [],
          expiresAt: new Date(Date.now() + 86_400_000),
          foundAt: new Date(Date.now() - 30 * 86_400_000),
        },
      });
      await vagaConfirmadaHa('vencida', 30);

      expect((await ingest.limpar()).apagadas).toBe(1);
      expect(await prisma.foundJob.count()).toBe(1);
    });
  });

  /**
   * Injeta uma falha DENTRO da transacao do servico, sem desfazer a transacao.
   *
   * ## Por que nao se espiona `prisma.trackedJob` direto
   *
   * Porque o servico (corrigido) chama `tx.trackedJob`, e o `tx` da transacao
   * interativa e **outro objeto** — um spy no client de fora nunca e
   * alcancado. A primeira versao destes dois testes fazia isso e passava com
   * **201**, nao 500: ela provava que o spy nao foi chamado, e nada sobre
   * atomicidade. O erro estava na expectativa, nao no codigo.
   *
   * ## O que este helper faz
   *
   * Embrulha o `$transaction` do client: a transacao de verdade continua sendo
   * aberta pelo Prisma — e e ela que faz o ROLLBACK, que e o que o teste mede
   * —, e o que muda e so o `tx` entregue ao callback, decorado com o metodo
   * que vai falhar. Assim as escritas anteriores a falha acontecem de verdade,
   * dentro da transacao, e e o banco que tem de voltar atras.
   */
  function espionarTransacao(
    decorar: (tx: Transacao) => Record<string, unknown>,
  ): jest.SpyInstance {
    type Callback = (tx: unknown) => Promise<unknown>;
    const original = prisma.$transaction.bind(prisma) as (
      cb: Callback,
      opcoes?: unknown,
    ) => Promise<unknown>;

    // Os `as` daqui sao de ANDAIME, e ficam contidos nestas tres linhas: os
    // tipos gerados do `tx` do Prisma sao profundos demais para um spread
    // satisfazer estruturalmente, e precisao de tipo num decorador de teste
    // nao compra nada — quem prova a correcao e o `count()` no banco. O
    // codigo de producao (`ingest.service.ts`) continua com o `tx` tipado de
    // verdade, e e la que confundir `tx` com `this.prisma` teria custo.
    return jest.spyOn(prisma, '$transaction').mockImplementation(((
      cb: Callback,
      opcoes?: unknown,
    ) =>
      original(
        (tx) => cb({ ...(tx as object), ...decorar(tx as Transacao) }),
        opcoes,
      )) as never);
  }

  // ------------------------------------------------------------------
  // JOB-54 — OS QUATRO DEFEITOS DO REVIEW ADVERSARIAL
  //
  // A suite original tinha 39 testes, todos passando, e **nao pegou nenhum
  // destes quatro**: `grep` por `u0000|nul|500|atomic|transacao|parcial|
  // content-type|02-31` dava zero ocorrencias. Ela era forte no que o JOB-50
  // previu e cega no que ele nao previu — e e por isso que cada defeito vira
  // teste aqui, junto da correcao.
  // ------------------------------------------------------------------
  describe('JOB-54.1 — caractere de controle da 400, nunca 500', () => {
    /**
     * O `curl` do card, ao pe da letra: valido, NUL, valido.
     *
     * ⚠️ **Este e tambem o teste da ATOMICIDADE pela porta da frente, e e o
     * mais facil de escrever errado.** Afirmar so o status provaria metade:
     * antes da correcao a resposta era 500 **e `ok-antes` ficava gravado**.
     * Entao o `expect` que importa e o do BANCO — `count() === 0`.
     */
    it('o lote [valido, NUL, valido] da 400 e NAO grava nada', async () => {
      const resp = await enviar({
        upsert: [vaga('ok-antes'), vaga('ruim\u0000'), vaga('ok-depois')],
      });

      expect(resp.status).toBe(400);
      // O que o defeito fazia: `ok-antes` entrava, `ok-depois` nao.
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    /**
     * O NUL em cada campo string, um por vez.
     *
     * `it.each` sobre a lista do card e nao um teste por campo: o que importa
     * e que NENHUM campo escape, e um `each` torna impossivel corrigir um e
     * esquecer outro — inclusive os dois que exigiram recursao (`skills`,
     * `snapshot`).
     */
    it.each([
      ['fonte', { fonte: 'green\u0000house' }],
      ['idExterno', { idExterno: 'id\u0000' }],
      ['title', { title: 'Back\u0000end' }],
      ['company', { company: 'Ac\u0000me' }],
      ['url', { url: 'https://e.com/\u0000' }],
      ['local', { local: 'Remote\u0000' }],
      ['regime', { regime: 'rem\u0000' }],
      ['area', { area: 'Back\u0000' }],
      ['degree', { degree: 'BSc\u0000' }],
      ['logoUrl', { logoUrl: 'https://l.com/\u0000.png' }],
      ['paisIso', { paisIso: 'u\u0000' }],
      ['dentro de skills', { skills: ['node', 'type\u0000script'] }],
      ['dentro de benefits', { benefits: ['equity\u0000'] }],
      ['no VALOR do snapshot', { snapshot: { salaryTrecho: 'USD\u0000' } }],
      ['na CHAVE do snapshot', { snapshot: { 'ru\u0000im': 'ok' } }],
      ['FUNDO no snapshot aninhado', { snapshot: { a: { b: { c: ['x\u0000'] } } } }],
    ])('NUL em %s da 400 e nada e gravado', async (_onde, extras) => {
      const resp = await enviar({ upsert: [vaga('1', extras)] });
      expect(resp.status).toBe(400);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('NUL em confirmar e em fechar tambem da 400, e nao 500', async () => {
      // O card mediu o 500 vindo tambem de `updateMany`/`deleteMany` — nao so
      // do `upsert`. As duas listas sao a mesma chave, e levam a mesma trava.
      for (const lista of ['confirmar', 'fechar'] as const) {
        const resp = await enviar({ [lista]: [{ fonte: 'qa', idExterno: 'x\u0000' }] });
        expect(resp.status).toBe(400);
      }
    });

    it('tab, LF, emoji e acento continuam PASSANDO', async () => {
      // A outra metade: uma correcao que recusasse `\n` quebraria descricao de
      // vaga copiada de HTML, que e o caso normal. O review do JOB-50 provou
      // que emoji e RTL sao gravados como dado literal — isso nao pode mudar.
      const resp = await enviar({
        upsert: [vaga('1', { title: 'Back\tend\nEngineer 🚀', company: 'Açaí Ltda' })],
      });
      expect(resp.status).toBe(201);
      const linha = await prisma.trackedJob.findFirstOrThrow({ select: { title: true } });
      expect(linha.title).toBe('Back\tend\nEngineer 🚀');
    });

    it('snapshot fundo demais da 400, e nao estoura a pilha com 500', async () => {
      // A arma nova que a correcao poderia ter criado: validacao recursiva sem
      // teto estoura com objeto fundo, trocando um 500 por outro.
      let fundo: unknown = 'folha';
      for (let i = 0; i < 2_000; i += 1) fundo = { dentro: fundo };
      const resp = await enviar({ upsert: [vaga('1', { snapshot: { fundo } })] });
      expect(resp.status).toBe(400);
      expect(await prisma.trackedJob.count()).toBe(0);
    });
  });

  describe('JOB-54.2 — o lote e atomico: ou entra inteiro, ou nao entra', () => {
    /**
     * ⚠️ **O teste mais importante do card, e o que precisa provar o BANCO.**
     *
     * O defeito nao era o 500 — era o banco pela metade COM resposta 500. O
     * rastreador tira os itens da fila pela resposta (JOB-49, decisao 9), e
     * num 500 ele nao sabe o que entrou.
     *
     * Depois da correcao do defeito 1 nao ha mais string que passe no DTO e
     * derrube o Postgres, entao a falha e **injetada** no client, na 3a
     * chamada do `upsert` — depois de duas vagas JA terem sido escritas dentro
     * da transacao. E o cenario exato do defeito: metade do lote aplicada,
     * erro no meio. Sem o `expect(chamadas).toBe(3)` o teste poderia passar
     * provando apenas que nada comecou, o que nao e rollback.
     */
    it('falha no MEIO do laco de upsert: nada fica gravado', async () => {
      let chamadas = 0;
      const espiao = espionarTransacao((tx) => ({
        trackedJob: {
          ...tx.trackedJob,
          // A 3a chamada falha: duas vagas JA foram escritas na transacao.
          upsert: (...args: unknown[]) => {
            chamadas += 1;
            if (chamadas === 3) {
              return Promise.reject(new Error('falha injetada no meio do lote (JOB-54)'));
            }
            return (tx.trackedJob.upsert as (...a: unknown[]) => unknown)(...args);
          },
        },
      }));

      try {
        const resp = await enviar({
          upsert: [vaga('a'), vaga('b'), vaga('c'), vaga('d')],
        });
        // 500 esta certo: a aplicacao falhou de verdade.
        expect(resp.status).toBe(500);
        // **O criterio do card.** Antes da transacao, `a` e `b` ficavam aqui.
        expect(await prisma.trackedJob.count()).toBe(0);
        // E a falha aconteceu DEPOIS de duas escritas.
        expect(chamadas).toBe(3);
      } finally {
        espiao.mockRestore();
      }
    });

    it('falha no fechar desfaz o upsert E o confirmar que vieram antes', async () => {
      // O card provou a nao-atomicidade com `upsert` valido + `confirmar`
      // valido + `fechar` que explode: a vaga nova ficou gravada E o
      // `confirmadaEm` avancou, com resposta 500. As tres etapas sao uma.
      await enviar({ upsert: [vaga('ja-existia')] });
      const antes = await prisma.trackedJob.findFirstOrThrow({
        select: { confirmadaEm: true },
      });
      await esperar(25);

      const espiao = espionarTransacao((tx) => ({
        trackedJob: {
          ...tx.trackedJob,
          deleteMany: () =>
            Promise.reject(new Error('falha injetada no fechar (JOB-54)')),
        },
      }));

      try {
        const resp = await enviar({
          upsert: [vaga('nova')],
          confirmar: [{ fonte: 'greenhouse', idExterno: 'ja-existia' }],
          fechar: [{ fonte: 'greenhouse', idExterno: 'nunca-vi' }],
        });
        expect(resp.status).toBe(500);

        // A vaga nova NAO entrou...
        const ids = await prisma.trackedJob.findMany({ select: { idExterno: true } });
        expect(ids.map((i) => i.idExterno)).toEqual(['ja-existia']);
        // ...e o `confirmadaEm` da antiga NAO avancou.
        const depois = await prisma.trackedJob.findFirstOrThrow({
          select: { confirmadaEm: true },
        });
        expect(depois.confirmadaEm.getTime()).toBe(antes.confirmadaEm.getTime());
      } finally {
        espiao.mockRestore();
      }
    });

    it('o lote CHEIO de 200 cabe no timeout da transacao', async () => {
      // O teto do lote DENTRO de uma transacao e o que o card manda medir, e
      // nao chutar: o `upsert` roda num laco, sao 200 idas ao banco numa
      // transacao aberta. Medido em 06/10: 773 ms para o lote cheio, e 1.608
      // ms no pior de 6 lotes de 200 em paralelo — contra os 30s de
      // `TEMPO_DA_TRANSACAO`.
      //
      // O teste nao afirma o tempo (seria fragil numa maquina carregada), e si
      // que o lote cheio PASSA: um timeout curto demais apareceria aqui como
      // 500.
      const lote = {
        upsert: Array.from({ length: ITENS_POR_LISTA }, (_, i) => vaga(`cheio-${i}`)),
      };
      const resp = await enviar(lote);
      expect(resp.status).toBe(201);
      expect(resp.body.gravadas).toBe(ITENS_POR_LISTA);
      expect(await prisma.trackedJob.count()).toBe(ITENS_POR_LISTA);
    }, 60_000);
  });

  describe('JOB-54.3 — Content-Type nao-JSON da 415', () => {
    /** O POST com `Content-Type` cru, sem o `.send()` do supertest adivinhar. */
    function enviarComTipo(tipo: string, corpo: string) {
      return request(servidor)
        .post('/api/ingest/jobs')
        .set('Authorization', `Bearer ${TOKEN}`)
        .set('Content-Type', tipo)
        .send(corpo);
    }

    const LOTE = JSON.stringify({
      upsert: [
        { fonte: 'qa', idExterno: 'ct1', title: 'T', company: 'C', url: 'https://e.com/ct1' },
      ],
    });

    it.each(['text/plain', 'text/json', 'application/octet-stream', 'application/xml'])(
      '%s com lote valido da 415, e nao 201 com zeros',
      async (tipo) => {
        // Antes: **201 {"gravadas":0,...}** e zero linhas — perda silenciosa.
        // Quem olha so o status tira os itens da fila e perde o lote.
        const resp = await enviarComTipo(tipo, LOTE);
        expect(resp.status).toBe(415);
        expect(await prisma.trackedJob.count()).toBe(0);
      },
    );

    it.each([
      'application/json',
      'application/json; charset=utf-8',
      'application/JSON',
      'Application/Json; Charset=UTF-8',
    ])('%s continua funcionando', async (tipo) => {
      // ⚠️ `application/json; charset=utf-8` e `application/JSON` foram
      // MEDIDOS funcionando antes da correcao, e o card exige que continuem: o
      // primeiro e o que `axios` e `curl -d` mandam, e um 415 nele quebraria
      // todo cliente real.
      await limpar(prisma, SCHEMA);
      const resp = await enviarComTipo(tipo, LOTE);
      expect(resp.status).toBe(201);
      expect(resp.body.gravadas).toBe(1);
      expect(await prisma.trackedJob.count()).toBe(1);
    });

    it('o 415 vem DEPOIS do 401 — sem o segredo, nao se descobre o formato', async () => {
      const resp = await request(servidor)
        .post('/api/ingest/jobs')
        .set('Content-Type', 'text/plain')
        .send(LOTE);
      expect(resp.status).toBe(401);
    });

    it('requisicao sem corpo e sem Content-Type e aceita com zeros', async () => {
      // "O rastreador pode ter uma rodada em que nada mudou" — o lote vazio e
      // caso normal, e um 415 aqui faria ele tratar "nada a fazer" como erro.
      const resp = await request(servidor)
        .post('/api/ingest/jobs')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send();
      expect(resp.status).toBe(201);
      expect(resp.body).toEqual({ gravadas: 0, confirmadas: 0, fechadas: 0 });
    });
  });

  describe('JOB-54.4 — data que nao existe da 400', () => {
    it.each(['2026-02-31', '2026-02-30', '2026-04-31', '2026-06-31', '2025-02-29'])(
      'postedAt %s da 400 e nao grava o mes seguinte',
      async (data) => {
        // Antes: **201**, e no banco `2026-03-03`. Corrupcao silenciosa — e
        // ninguem olha esta tabela, porque quem escreve nela e um processo.
        const resp = await enviar({ upsert: [vaga('1', { postedAt: `${data}T00:00:00Z` })] });
        expect(resp.status).toBe(400);
        expect(await prisma.trackedJob.count()).toBe(0);
      },
    );

    it.each(['banana', '01/08/2026', '2026-13-01', '2026-00-10', '12345-01-01', '1754000000'])(
      'o que JA dava 400 continua dando: %s',
      async (data) => {
        // O `strict: true` nao pode ter afrouxado nada. O card listou estes
        // como "o que resistiu, e nao precisa de mudanca".
        const resp = await enviar({ upsert: [vaga('1', { postedAt: data })] });
        expect(resp.status).toBe(400);
      },
    );

    it.each([
      '2026-02-28T00:00:00Z',
      '2028-02-29T00:00:00.000Z',
      '2026-09-20T12:00:00.000Z',
      '2026-09-20T12:00:00-03:00',
      '2026-09-20',
    ])('data VALIDA continua entrando: %s', async (data) => {
      // A metade que uma validacao estrita demais quebraria. `2028-02-29` e
      // bissexto de verdade e tem de passar; a data com fuso e o que o ATS
      // manda.
      await limpar(prisma, SCHEMA);
      const resp = await enviar({ upsert: [vaga('1', { postedAt: data })] });
      expect(resp.status).toBe(201);
      const linha = await prisma.trackedJob.findFirstOrThrow({ select: { postedAt: true } });
      expect(linha.postedAt).not.toBeNull();
    });
  });

  describe('JOB-54.5 — a chave de idempotencia e normalizada', () => {
    it('a mesma vaga com `fonte` em 5 caixas/espacos vira 1 linha', async () => {
      // O `curl` do card: 5 envios, e antes **5 linhas**. O unique do Postgres
      // e byte-exato, e nada normalizava.
      for (const f of ['greenhouse', 'Greenhouse', 'GREENHOUSE', ' greenhouse', 'greenhouse ']) {
        const resp = await enviar({ upsert: [{ ...vaga('norm1'), fonte: f }] });
        expect(resp.status).toBe(201);
      }

      const linhas = await prisma.trackedJob.findMany({ select: { fonte: true } });
      expect(linhas).toHaveLength(1);
      // E o que ficou gravado e a forma normalizada, nao a ultima recebida.
      expect(linhas[0].fonte).toBe('greenhouse');
    });

    it('`idExterno` leva trim mas NAO toLowerCase — a caixa dele e dado', async () => {
      // ⚠️ A decisao do card, e a razao esta no DTO: o `idExterno` e o id no
      // ATS de origem, e ha board que usa base64, onde `A` e `a` apontam para
      // vagas DIFERENTES. Dobrar a caixa fundiria duas vagas reais numa linha.
      await enviar({ upsert: [vaga('  ABC  '), vaga('abc')] });
      const ids = await prisma.trackedJob.findMany({
        select: { idExterno: true },
        orderBy: { idExterno: 'asc' },
      });
      // Duas linhas: o trim casou `"  ABC  "` com `ABC`, e `ABC` != `abc`.
      expect(ids.map((i) => i.idExterno)).toEqual(['ABC', 'abc']);
    });

    it('`idExterno` so de espaco da 400 — o trim roda ANTES do IsNotEmpty', async () => {
      // O card: `@IsNotEmpty()` rejeita `""` mas nao `"   "`, e aquela linha
      // entrava com chave em branco.
      const resp = await enviar({ upsert: [vaga('   ')] });
      expect(resp.status).toBe(400);
      expect(await prisma.trackedJob.count()).toBe(0);
    });

    it('confirmar e fechar normalizam IGUAL ao upsert', async () => {
      // ⚠️ O risco que a correcao poderia ter criado: se so o `upsert`
      // normalizasse, o rastreador gravaria `greenhouse` e confirmaria
      // `Greenhouse` — `updateMany` casaria ZERO linhas, devolveria
      // `confirmadas: 0`, e a vaga morreria no prazo de 7 dias enquanto o ATS
      // dizia que estava aberta. Falha silenciosa com uma semana de atraso.
      await enviar({ upsert: [vaga('k1')] });

      const conf = await enviar({ confirmar: [{ fonte: ' GREENHOUSE ', idExterno: ' k1 ' }] });
      expect(conf.body.confirmadas).toBe(1);

      const fech = await enviar({ fechar: [{ fonte: 'GreenHouse', idExterno: 'k1' }] });
      expect(fech.body.fechadas).toBe(1);
      expect(await prisma.trackedJob.count()).toBe(0);
    });
  });
});

/**
 * O estado observavel da tabela, para comparar "antes e depois" por inteiro.
 *
 * **Sem as colunas de tempo que mexem por desenho** (`confirmadaEm`,
 * `updatedAt`) e sem o `id`, que e um uuid novo a cada `create`. O que sobra e
 * o conteudo — e e sobre ele que o card diz *"deixa o banco identico"*.
 */
async function estado(prisma: PrismaClient) {
  const linhas = await prisma.trackedJob.findMany({
    orderBy: [{ fonte: 'asc' }, { idExterno: 'asc' }],
    select: {
      fonte: true,
      idExterno: true,
      title: true,
      company: true,
      url: true,
      local: true,
      regime: true,
      skills: true,
      area: true,
      anosExp: true,
      benefits: true,
      degree: true,
      logoUrl: true,
      paisIso: true,
      snapshot: true,
      postedAt: true,
    },
  });
  return linhas;
}

/** Espera alguns milissegundos, para dois carimbos de tempo diferirem. */
function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
