/**
 * JOB-47 — **a busca funciona sem login, e sem alcancar o que custa.**
 *
 * O card tem duas metades, e esta suite cobre as duas porque elas falham de
 * formas diferentes:
 *
 * 1. **A rota abriu** — o anonimo busca e recebe vaga. Falha visivel: 401.
 * 2. **O anonimo nao alcanca motor pago nem o acervo novo.** Falha INVISIVEL:
 *    a busca continua funcionando, a tela continua bonita, e a conta do
 *    Firecrawl cresce — ou a vantagem competitiva de quem se cadastrou vaza.
 *
 * A segunda e a razao desta suite existir. O card pede, com estas palavras,
 * que ela seja *"provada por teste, nao por leitura"*: o criterio e espionar
 * os servicos pagos no container de DI de verdade e afirmar que **nao foram
 * chamados**.
 *
 * ## Por que espiao e nao mock de rede
 *
 * Um mock de `fetch` provaria que nenhuma requisicao saiu, mas nao diria por
 * que: um `fetch` que falha porque a URL esta errada passaria no teste pelo
 * motivo errado. O espiao no metodo do servico (`BuscaAtsService.buscar`,
 * `IaService.pedir`) afirma a coisa certa — **a cascata nao chegou ate aqui**
 * —, e e isso que a barreira do anonimo promete.
 *
 * ## O freehire e dublado, de proposito
 *
 * Ele e o unico motor que o anonimo PODE alcancar, e deixa-lo bater na API de
 * verdade faria a suite depender de um servico de terceiro sem SLA e de quantas
 * vagas de 14+ dias existem hoje. O duble devolve linhas com data controlada,
 * que e o unico jeito de afirmar o corte de idade sem esperar duas semanas.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { BuscaAtsService } from './busca-ats.service';
import { BuscaFreehireService, type PaginaFreehire } from './busca-freehire.service';
import { BuscaIaService } from './busca-ia.service';
import { IaService } from '../ia/ia.service';
import type { FiltrosDto, VagaDto } from './job.dto';
import type { LimitesDaBusca } from './limites-anonimos';
import { DIAS_PARA_O_ANONIMO } from './limites-anonimos';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';
import { assinarToken, exigirLoginLigado } from '../../test/aplicacao-de-teste';

const SCHEMA = nomeDoSchema(__filename);

/** Quantos dias atras, em ISO — a data que o duble do freehire devolve. */
function diasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

/**
 * Uma vaga do formato que o motor devolve, com a idade que o teste quer.
 *
 * **Sem `as VagaDto`**, e isso custou um ciclo de depuracao: a primeira versao
 * cast(e)ava um objeto com `salaryCurrency` e `remote` (nomes que o DTO nao
 * tem) e sem `id`/`fonte`/`regime`, e o cast calou o compilador. O tipo
 * explicito e o que faz o campo errado falhar no `tsc` em vez de virar
 * `undefined` numa assercao confusa.
 */
function vaga(id: string, idadeEmDias: number): VagaDto {
  return {
    id,
    title: `Backend Engineer ${id}`,
    company: `Empresa ${id}`,
    url: `https://job-boards.greenhouse.io/empresa/jobs/${id}`,
    local: 'Remote — LATAM',
    fonte: 'greenhouse.io',
    regime: 'remoto',
    skills: ['node'],
    area: null,
    anosExp: null,
    benefits: [],
    degree: null,
    logoUrl: null,
    paisIso: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    salaryTrecho: null,
    paisesElegiveis: null,
    elegivelGlobal: false,
    elegibilidadeTrecho: null,
    postedAt: diasAtras(idadeEmDias),
    foundAt: new Date().toISOString(),
  };
}

/**
 * O duble do freehire: o motor gratuito, com dado controlado.
 *
 * ## ⚠️ O duble aplica o corte, e isso e uma limitacao CONHECIDA deste arquivo
 *
 * Ele filtra por `limites.idadeMinimaEmDias` para que a resposta da rota seja
 * a que a tela receberia — mas isso significa que **esta suite nao prova o
 * corte do codigo de producao**: desligar o `peneirar` do motor real deixa as
 * 17 provas daqui passando (medido, por mutacao, em 01/10).
 *
 * Quem prova o corte de verdade e a `limites-anonimos.spec.ts`, que dubla o
 * `fetch` em vez do servico e roda o `peneirar` real. Os dois arquivos se
 * dividem assim de proposito:
 *
 * | arquivo                     | dubla   | prova                              |
 * | --------------------------- | ------- | ---------------------------------- |
 * | `busca-anonima.e2e.spec.ts` | serviço | a ROTA: 401, barreira, `total`     |
 * | `limites-anonimos.spec.ts`  | `fetch` | a REGRA: o corte, a consulta, sessao |
 *
 * O que esta suite prova e insubstituivel e nao se consegue no unitario: que a
 * cascata nao alcanca ATS/IA, que o decorador e o certo, e que o `total` que
 * sai no SSE bate com as linhas que sairam.
 */
class FreehireDublado {
  /** Toda chamada que chegou, com os limites que vieram junto. */
  chamadas: Array<{ offset: number; limites: LimitesDaBusca }> = [];
  /** O acervo do duble: duas novas, tres velhas. */
  acervo: VagaDto[] = [
    vaga('nova-1', 1),
    vaga('nova-2', 3),
    vaga('velha-1', 20),
    vaga('velha-2', 40),
    vaga('velha-3', 60),
  ];

  async buscarPagina(
    _filtros: FiltrosDto,
    offset: number,
    limites: LimitesDaBusca,
  ): Promise<PaginaFreehire> {
    this.chamadas.push({ offset, limites });
    const idade = limites.idadeMinimaEmDias;
    const visiveis =
      idade === null
        ? this.acervo
        : this.acervo.filter(
            (v) => (Date.now() - new Date(v.postedAt!).getTime()) / 86_400_000 >= idade,
          );
    return {
      vagas: visiveis,
      lidasDaApi: visiveis.length,
      totalNoFiltro: visiveis.length,
    };
  }

  async buscar(filtros: FiltrosDto): Promise<VagaDto[]> {
    return (await this.buscarPagina(filtros, 0, {
      somenteFreehire: false,
      idadeMinimaEmDias: null,
      janelaMaximaEmDias: null,
    })).vagas;
  }
}

/** Le o stream SSE da busca e devolve os eventos ja desempacotados. */
function eventos(corpo: string): Array<Record<string, unknown>> {
  return corpo
    .split('\n\n')
    .map((b) => b.replace(/^data: /, '').trim())
    .filter((b) => b.length > 0)
    .map((b) => JSON.parse(b) as Record<string, unknown>);
}

describe('JOB-47 — busca sem login', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let servidor: unknown;
  let freehire: FreehireDublado;
  let espiaoAts: jest.SpyInstance;
  let espiaoIaDeBusca: jest.SpyInstance;
  let espiaoCadeiaDeIa: jest.SpyInstance;
  let token: string;

  beforeAll(async () => {
    // Com `AUTH_DISABLED=true` toda rota passa e todo mundo e o usuario de
    // desenvolvimento: o anonimo receberia o acervo inteiro e os `expect` de
    // restricao falhariam por um motivo que nao e o do card. Morre aqui, com
    // a razao escrita, em vez de se pular.
    exigirLoginLigado();
    prepararSchema(SCHEMA);
    prisma = clientDeTeste(SCHEMA);
    await exigirSchemaDeTeste(prisma, SCHEMA);

    freehire = new FreehireDublado();

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      // O unico motor dublado e o gratuito. Os pagos continuam sendo as
      // instancias de VERDADE — e e isso que da sentido ao espiao: se a
      // cascata os alcancar, ela alcanca o codigo real, nao um duble.
      .overrideProvider(BuscaFreehireService)
      .useValue(freehire)
      .compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    servidor = app.getHttpServer();

    const usuario = await prisma.user.create({
      data: { email: 'quem-entrou@exemplo.com', name: 'Quem Entrou', provider: 'DEV' },
      select: { id: true, email: true },
    });
    token = assinarToken(usuario);
  }, 180_000);

  beforeEach(() => {
    freehire.chamadas = [];
    // **Os espioes vao nos servicos pagos, resolvidos do container.**
    //
    // `mockResolvedValue` e nao `mockRejectedValue`: se a barreira falhar, o
    // teste tem de falhar por "o motor pago foi chamado" e nao por uma
    // excecao que a cascata engoliria no `.catch()` — ela trata falha de motor
    // como "zero vaga" e segue, e o erro viraria silencio.
    espiaoAts = jest
      .spyOn(app.get(BuscaAtsService), 'buscar')
      .mockResolvedValue([] as VagaDto[]);
    espiaoIaDeBusca = jest
      .spyOn(app.get(BuscaIaService), 'buscar')
      .mockResolvedValue([] as VagaDto[]);
    espiaoCadeiaDeIa = jest
      .spyOn(app.get(IaService), 'pedir')
      .mockResolvedValue({} as never);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  function buscar(corpo: Record<string, unknown>, comToken?: string): request.Test {
    const req = request(servidor as Parameters<typeof request>[0])
      .post('/api/jobs/search')
      .send(corpo);
    return comToken ? req.set('Authorization', `Bearer ${comToken}`) : req;
  }

  describe('a rota abriu — mas pelo decorador certo', () => {
    it('sem nenhum token, a busca responde e devolve vaga', async () => {
      const resp = await buscar({ job_titles: ['Backend Engineer'] });

      // 201 e nao 200: e o default do `@Post()` no Nest, e a busca escreve o
      // stream com `@Res()` sem tocar no status. O que importa aqui e nao ser
      // 401 — mas a assercao e no numero exato de proposito, porque "qualquer
      // 2xx serve" esconderia a rota passando a responder outra coisa.
      expect(resp.status).toBe(201);
      const vagas = eventos(resp.text).filter((e) => e.tipo === 'vaga');
      // O criterio de aceite em uma linha: o anonimo VE vaga.
      expect(vagas.length).toBeGreaterThan(0);
    });

    /**
     * O teste que separa `@SessaoOpcional()` de `@Public()`.
     *
     * Com `@Public()` o guard retorna antes de olhar o token, e um token podre
     * viraria anonimo em silencio: a sessao expirada de quem estava logado
     * passaria a devolver a amostra de 14 dias, e a pessoa concluiria que o
     * produto encolheu em vez de que ela precisa entrar de novo.
     */
    it('token INVALIDO continua dando 401 — nao vira anonimo', async () => {
      const resp = await buscar({ job_titles: ['Backend'] }, 'nao.e.um.token');

      expect(resp.status).toBe(401);
      // E nao chegou a buscar nada: o guard barrou antes do handler.
      expect(freehire.chamadas).toHaveLength(0);
    });

    it('token assinado com outro segredo tambem da 401', async () => {
      const outro = require('jsonwebtoken').sign(
        { sub: 'alguem', email: 'a@b.c' },
        'um-segredo-que-nao-e-o-da-aplicacao',
        { expiresIn: '1h' },
      ) as string;

      const resp = await buscar({ job_titles: ['Backend'] }, outro);
      expect(resp.status).toBe(401);
    });

    it('"Load more" tambem atende o anonimo, sem 401', async () => {
      const resp = await request(servidor as Parameters<typeof request>[0])
        .post('/api/jobs/search/mais')
        .send({ sessao: 'uma-sessao-que-nao-existe' });

      // 201 (o default do `@Post()`) com `expirada: true` e a resposta certa
      // para sessao inexistente — o que nao pode e 401, que faria o botao do
      // anonimo quebrar.
      expect(resp.status).toBe(201);
      expect(resp.body.expirada).toBe(true);
    });
  });

  describe('o anonimo NAO alcanca o que custa', () => {
    /**
     * **O teste mais importante do card.**
     *
     * O risco que ele cobre esta escrito na tabela de riscos do JOB-47:
     * *"Anonimo escapa para o motor pago"*, com a mitigacao *"teste que falha
     * se a cadeia for alcancada sem sessao"*. E o unico defeito desta feature
     * que nao aparece na tela — so na fatura.
     */
    it('busca anonima nao chama ATS, nem IA de busca, nem a cadeia de IA', async () => {
      // Acervo vazio: e o pior caso: zero vaga do freehire e exatamente o que
      // faz a cascata procurar o proximo motor. Se a barreira nao existir, o
      // ATS e a IA sao chamados AQUI.
      freehire.acervo = [];

      const resp = await buscar({ job_titles: ['Backend Engineer'] });

      expect(resp.status).toBe(201);
      expect(espiaoAts).not.toHaveBeenCalled();
      expect(espiaoIaDeBusca).not.toHaveBeenCalled();
      expect(espiaoCadeiaDeIa).not.toHaveBeenCalled();
      // E o freehire FOI chamado: sem isto o teste passaria com a busca
      // inteira quebrada, que e a forma mais silenciosa de ele morrer.
      expect(freehire.chamadas).toHaveLength(1);

      freehire.acervo = [
        vaga('nova-1', 1),
        vaga('nova-2', 3),
        vaga('velha-1', 20),
        vaga('velha-2', 40),
        vaga('velha-3', 60),
      ];
    });

    it('a busca anonima sem resultado termina em `fim`, e nao em `erro`', async () => {
      freehire.acervo = [];

      const resp = await buscar({ job_titles: ['Backend Engineer'] });
      const tipos = eventos(resp.text).map((e) => e.tipo);

      // "Nao achei" nao e "falhei": um `erro` faria a tela dizer "Search
      // failed" para uma busca que funcionou, e a pessoa tentaria de novo.
      expect(tipos).toContain('fim');
      expect(tipos).not.toContain('erro');

      freehire.acervo = [
        vaga('nova-1', 1),
        vaga('nova-2', 3),
        vaga('velha-1', 20),
        vaga('velha-2', 40),
        vaga('velha-3', 60),
      ];
    });

    it('COM sessao, a cascata segue para os motores pagos', async () => {
      // O contrapositivo, e ele e obrigatorio: sem este teste, uma barreira
      // que bloqueasse TODO MUNDO passaria no teste de cima. O que se mede
      // aqui e que a restricao e do anonimo, e nao da feature.
      freehire.acervo = [];

      const resp = await buscar({ job_titles: ['Backend Engineer'] }, token);

      expect(resp.status).toBe(201);
      expect(espiaoAts).toHaveBeenCalled();

      freehire.acervo = [
        vaga('nova-1', 1),
        vaga('nova-2', 3),
        vaga('velha-1', 20),
        vaga('velha-2', 40),
        vaga('velha-3', 60),
      ];
    });
  });

  describe('o corte de 14 dias', () => {
    it('anonimo recebe SO vaga com 14+ dias', async () => {
      const resp = await buscar({ job_titles: ['Backend Engineer'] });

      const vagas = eventos(resp.text)
        .filter((e) => e.tipo === 'vaga')
        .map((e) => e.vaga as VagaDto);

      expect(vagas.length).toBe(3);
      for (const v of vagas) {
        const dias = (Date.now() - new Date(v.postedAt!).getTime()) / 86_400_000;
        expect(dias).toBeGreaterThanOrEqual(DIAS_PARA_O_ANONIMO);
      }
      // E as novas, nominalmente, nao estao la.
      expect(vagas.map((v) => v.url).join()).not.toContain('nova-');
    });

    it('com sessao, o acervo inteiro — inclusive a de ontem', async () => {
      const resp = await buscar({ job_titles: ['Backend Engineer'] }, token);

      const vagas = eventos(resp.text)
        .filter((e) => e.tipo === 'vaga')
        .map((e) => e.vaga as VagaDto);

      expect(vagas.length).toBe(5);
      expect(vagas.map((v) => v.url).join()).toContain('nova-1');
    });

    it('a politica chega ao motor: `idadeMinimaEmDias` so no anonimo', async () => {
      await buscar({ job_titles: ['Backend'] });
      expect(freehire.chamadas[0].limites.idadeMinimaEmDias).toBe(DIAS_PARA_O_ANONIMO);
      expect(freehire.chamadas[0].limites.somenteFreehire).toBe(true);

      freehire.chamadas = [];
      await buscar({ job_titles: ['Backend'] }, token);
      expect(freehire.chamadas[0].limites.idadeMinimaEmDias).toBeNull();
      expect(freehire.chamadas[0].limites.somenteFreehire).toBe(false);
    });
  });

  describe('o `total` e o "Load more" do anonimo batem com o que ele ve', () => {
    /**
     * O defeito que o JOB-45 corrigiu, e que o corte de data poderia
     * reintroduzir: um numero na tela que promete mais do que a lista entrega.
     */
    it('o `inicio.total` conta as visiveis, e nao o acervo', async () => {
      const resp = await buscar({ job_titles: ['Backend Engineer'] });
      const evs = eventos(resp.text);

      const inicio = evs.find((e) => e.tipo === 'inicio');
      const quantasVagas = evs.filter((e) => e.tipo === 'vaga').length;

      // 3 e nao 5: o anonimo nao pode ler "5 jobs found" e contar 3 linhas.
      expect(inicio?.total).toBe(quantasVagas);
      expect(inicio?.total).toBe(3);
    });

    it('o `totalNoFiltro` do anonimo nao vaza o tamanho do acervo', async () => {
      const resp = await buscar({ job_titles: ['Backend Engineer'] });
      const fim = eventos(resp.text).find((e) => e.tipo === 'fim');

      // O duble devolve `totalNoFiltro` ja recortado, como a API real faz
      // quando a janela vai na consulta. 5 aqui seria o acervo inteiro.
      expect(fim?.totalNoFiltro).toBe(3);
    });

    it('a pagina 2 do anonimo herda o corte, mesmo sem token no pedido', async () => {
      // A sessao e aberta pela busca anonima...
      const primeira = await buscar({ job_titles: ['Backend Engineer'] });
      const fim = eventos(primeira.text).find((e) => e.tipo === 'fim');
      const sessao = fim?.sessao as string | undefined;
      expect(typeof sessao).toBe('string');

      freehire.chamadas = [];
      // ...e a pagina 2 e pedida mandando SO o id, que e o que o DTO aceita.
      await request(servidor as Parameters<typeof request>[0])
        .post('/api/jobs/search/mais')
        .send({ sessao });

      // Se houve chamada, ela foi com o corte: e o que impede o anonimo de
      // receber o acervo novo na pagina 2 por nao ter como se declarar.
      for (const c of freehire.chamadas) {
        expect(c.limites.idadeMinimaEmDias).toBe(DIAS_PARA_O_ANONIMO);
        expect(c.limites.somenteFreehire).toBe(true);
      }
    });
  });

  describe('salvar, historico e CV continuam exigindo sessao', () => {
    it.each([
      ['POST', '/api/jobs/saved'],
      ['GET', '/api/jobs/saved'],
      ['GET', '/api/jobs/history'],
      ['POST', '/api/jobs/profile/cv'],
    ])('%s %s responde 401 ao anonimo', async (verbo, caminho) => {
      const agente = request(servidor as Parameters<typeof request>[0]);
      const resp = await (verbo === 'GET' ? agente.get(caminho) : agente.post(caminho));

      expect(resp.status).toBe(401);
    });
  });
});
