/**
 * O catalogo que o motor de ATS consulta: arquivo + colheita (JOB-40).
 *
 * O que este arquivo segura, e cada regra custou uma medicao:
 *
 * - **as duas fontes se juntam sem duplicar (ats, slug)** — a chave de
 *   identidade do catalogo. Medido em 01/10: 4 das 457 linhas confirmadas
 *   apontam para um par que outra linha ja aponta (`greenhouse:earnin` chegou
 *   por `job-boards.greenhouse.io` e pelo dominio proprio), e sem o `Set` a
 *   mesma empresa seria consultada duas vezes na mesma busca;
 * - **as confirmadas entram ANTES das curadas** — `escolher` corta em
 *   `TETO_EMPRESAS` por posicao, e anexar no fim nao mudou vaga nenhuma
 *   (medido: 447 vagas antes, 447 depois). A ordem e a feature, nao um
 *   detalhe;
 * - **so `confirmada` entra** — `nova` nunca foi verificada, `morta` e
 *   `desconhecida` mediram 404 ou zero vaga, e `ja_no_catalogo` ja esta no
 *   arquivo. Cada uma delas gastaria uma das 200 consultas da rodada num slug
 *   que ja se sabe que nao responde;
 * - **banco vazio e banco fora nao derrubam o motor** — o arquivo e a base, e
 *   perder o acrescimo e perder alcance, nao a busca.
 */
import type { PrismaClient } from '@prisma/client';
import { BuscaAtsService, juntar, type Empresa } from './busca-ats.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  limpar,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';

const SCHEMA = nomeDoSchema(__filename);

/** Uma empresa de arquivo, como `empresas.json` a guarda. */
function doArquivo(ats: string, slug: string, extra: Partial<Empresa> = {}): Empresa {
  return { nome: slug, ats, slug, contrataEm: [], ...extra };
}

describe('juntar (as duas fontes do catalogo)', () => {
  it('nao duplica (ats, slug) quando a confirmada ja esta no arquivo', () => {
    const r = juntar(
      [doArquivo('greenhouse', 'stripe'), doArquivo('lever', 'veeva')],
      [doArquivo('greenhouse', 'stripe'), doArquivo('greenhouse', 'spacex')],
    );
    const pares = r.map((e) => `${e.ats}:${e.slug}`);
    expect(pares).toHaveLength(3);
    expect(new Set(pares).size).toBe(3);
    expect(pares).toContain('greenhouse:spacex');
  });

  it('nao duplica quando DUAS confirmadas apontam para o mesmo par', () => {
    // O caso real: 4 pares repetidos entre as 457 linhas de 01/10, porque a
    // mesma empresa foi descoberta por dois hosts diferentes.
    const r = juntar(
      [doArquivo('greenhouse', 'stripe')],
      [
        { ...doArquivo('greenhouse', 'earnin'), nome: 'Earnin' },
        { ...doArquivo('greenhouse', 'earnin'), nome: 'earnin' },
      ],
    );
    expect(r.filter((e) => e.slug === 'earnin')).toHaveLength(1);
  });

  it('casa o par ignorando caixa — o catalogo tem "Adyen" com A maiusculo', () => {
    // `empresas.json` guarda `greenhouse:Adyen`. Uma confirmada `adyen` e a
    // MESMA empresa, e sem o `toLowerCase` o motor consultaria as duas.
    const r = juntar([doArquivo('greenhouse', 'Adyen')], [doArquivo('greenhouse', 'adyen')]);
    expect(r).toHaveLength(1);
    expect(r[0].slug).toBe('Adyen');
  });

  it('o arquivo ganha o empate: o dado curado nao e sobrescrito', () => {
    const curada = doArquivo('greenhouse', 'ciandt', {
      nome: 'CI&T',
      contrataEm: ['br', 'mx'],
      sede: 'br',
      porte: 'grande',
    });
    const colhida = doArquivo('greenhouse', 'ciandt', { nome: 'ciandt' });
    const r = juntar([curada], [colhida]);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe('CI&T');
    expect(r[0].contrataEm).toEqual(['br', 'mx']);
    expect(r[0].sede).toBe('br');
  });

  it('as confirmadas vem ANTES das curadas — e o que as torna alcancaveis', () => {
    // Sem isto o card nao entrega nada: medido em 01/10, com as 453
    // confirmadas anexadas no FIM, a busca ampla devolveu as mesmas 447 vagas
    // do baseline, porque `escolher` corta em 200 por posicao.
    const r = juntar(
      [doArquivo('greenhouse', 'canonical'), doArquivo('greenhouse', 'gitlab')],
      [doArquivo('greenhouse', 'spacex')],
    );
    expect(r[0].slug).toBe('spacex');
  });

  it('sem confirmada nenhuma, devolve o arquivo intacto', () => {
    const arquivo = [doArquivo('greenhouse', 'stripe'), doArquivo('lever', 'veeva')];
    expect(juntar(arquivo, [])).toEqual(arquivo);
  });

  it('sem arquivo nenhum, devolve so as confirmadas', () => {
    const r = juntar([], [doArquivo('greenhouse', 'spacex')]);
    expect(r.map((e) => e.slug)).toEqual(['spacex']);
  });
});

describe('BuscaAtsService: o catalogo da busca le as confirmadas (banco)', () => {
  let prisma: PrismaClient;
  let servico: BuscaAtsService;

  beforeAll(async () => {
    prepararSchema(SCHEMA);
    prisma = clientDeTeste(SCHEMA);
    await exigirSchemaDeTeste(prisma, SCHEMA);
    servico = new BuscaAtsService(prisma as unknown as PrismaService);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await limpar(prisma, SCHEMA);
    // O servico guarda o que leu; cada teste precisa da leitura nova.
    servico = new BuscaAtsService(prisma as unknown as PrismaService);
  });

  /** Uma linha na fila de descobertas, no estado pedido. */
  async function descoberta(opcoes: {
    host?: string;
    ats: string | null;
    slug: string;
    estado: string;
    vagas?: number | null;
    slugTestado?: string | null;
    empresa?: string;
  }): Promise<void> {
    await prisma.atsDiscovery.create({
      data: {
        host: opcoes.host ?? `${opcoes.slug}.exemplo.test`,
        ats: opcoes.ats,
        slug: opcoes.slug,
        empresa: opcoes.empresa ?? opcoes.slug,
        exemploUrl: `https://${opcoes.slug}.exemplo.test/vaga/1`,
        estado: opcoes.estado,
        vagas: opcoes.vagas ?? null,
        // `??` nao serve aqui: `slugTestado: null` e um caso que os testes
        // exercitam de proposito, e `null ?? slug` o trocaria pelo slug.
        slugTestado: 'slugTestado' in opcoes ? opcoes.slugTestado : opcoes.slug,
      },
      select: { id: true },
    });
  }

  /** Os pares (ats, slug) do catalogo que a busca consultaria. */
  async function pares(porte?: string): Promise<string[]> {
    const todas = await servico.catalogoDaBusca(porte);
    return todas.map((e) => `${e.ats}:${e.slug.toLowerCase()}`);
  }

  it('banco vazio: o motor continua com o catalogo de arquivo', async () => {
    const r = await pares();
    // O numero exato muda quando alguem curar mais empresa; o que este teste
    // segura e que a lista nao fica vazia nem explode sem a tabela.
    expect(r.length).toBeGreaterThan(500);
    expect(r).toContain('greenhouse:canonical');
  });

  it('uma confirmada entra no catalogo da busca', async () => {
    await descoberta({ ats: 'greenhouse', slug: 'spacex', estado: 'confirmada', vagas: 2564 });
    const r = await pares();
    expect(r).toContain('greenhouse:spacex');
  });

  it('a confirmada vem na frente, dentro do teto que o motor consulta', async () => {
    await descoberta({ ats: 'greenhouse', slug: 'spacex', estado: 'confirmada', vagas: 2564 });
    const r = await pares();
    // Posicao 0: e o que garante que o `escolher`, que corta em 200 por
    // posicao em cada fila de ATS, de fato a alcance.
    expect(r[0]).toBe('greenhouse:spacex');
  });

  it('ordena por vagas medidas: a mais produtiva primeiro', async () => {
    await descoberta({ ats: 'lever', slug: 'pequena', estado: 'confirmada', vagas: 3 });
    await descoberta({ ats: 'greenhouse', slug: 'grande', estado: 'confirmada', vagas: 900 });
    const r = await pares();
    expect(r.indexOf('greenhouse:grande')).toBeLessThan(r.indexOf('lever:pequena'));
  });

  // **`vagas` positivo em TODOS, e isso e o ponto do teste.**
  //
  // A primeira versao usava o `vagas` realista de cada estado (`nova` e
  // `desconhecida` com `null`, `morta` com 0) e tres dos quatro casos passavam
  // pelo motivo errado: quem os barrava era o `vagas: { gt: 0 }` da consulta,
  // nao o filtro de estado. Medido quebrando o filtro de estado de proposito:
  // 1 de 4 testes falhou. Com um numero positivo em todos, o estado e a unica
  // coisa que pode barrar a linha — e os 4 falham quando ele cai.
  it.each(['nova', 'morta', 'desconhecida', 'ja_no_catalogo'])(
    'estado %s NAO entra no catalogo da busca',
    async (estado) => {
      await descoberta({ ats: 'greenhouse', slug: 'naodeveentrar', estado, vagas: 500 });
      const r = await pares();
      expect(r).not.toContain('greenhouse:naodeveentrar');
    },
  );

  it('confirmada sem ATS conhecido nao entra — nao ha o que consultar', async () => {
    // Os 705 hosts com `ats: null` de 01/10 (workday, oraclecloud, icims,
    // gupy). `daEmpresa` cai no `default: return []`, entao a linha gastaria
    // uma das 200 consultas da rodada para devolver nada.
    await descoberta({ ats: null, slug: 'semats', estado: 'confirmada', vagas: 40 });
    const r = await pares();
    expect(r.some((p) => p.includes('semats'))).toBe(false);
  });

  it.each([
    ['nulo', null],
    // String vazia passa pelo `not: null` do Prisma, e o slug vazio montaria
    // `boards-api.greenhouse.io/v1/boards//jobs` — uma consulta gasta que
    // nenhum log denunciaria. Nao ocorre hoje (0 linhas em 1.297), e o filtro
    // existe para o dia em que ocorrer.
    ['vazio', ''],
    ['so espaco', '  '],
  ])('confirmada com slugTestado %s nao entra no catalogo', async (_, slugTestado) => {
    // A referencia e uma confirmada BOA, para o teste provar que a comparacao
    // mede o filtro de slug e nao a leitura inteira.
    await descoberta({ ats: 'lever', slug: 'boa', estado: 'confirmada', vagas: 10 });
    const soAboa = await pares();
    expect(soAboa).toContain('lever:boa');

    await descoberta({
      ats: 'greenhouse',
      slug: '',
      estado: 'confirmada',
      vagas: 80,
      slugTestado,
      host: 'careers.semslug.test',
    });
    // Servico novo: o de cima guardou a leitura por 5 minutos, e reusa-lo
    // faria este teste passar sem consultar o banco de novo.
    servico = new BuscaAtsService(prisma as unknown as PrismaService);
    expect(await pares()).toEqual(soAboa);
  });

  it('confirmada com zero vaga nao entra', async () => {
    await descoberta({ ats: 'greenhouse', slug: 'vazia', estado: 'confirmada', vagas: 0 });
    expect(await pares()).not.toContain('greenhouse:vazia');
  });

  it('usa o slugTestado, e nao o slug cru da URL', async () => {
    // O caso do dominio proprio: a URL nao carrega o slug, a verificacao o
    // adivinhou do host, e e o adivinhado que responde na API.
    await descoberta({
      ats: 'greenhouse',
      slug: '',
      estado: 'confirmada',
      vagas: 80,
      slugTestado: 'duolingo',
      host: 'careers.duolingo.test',
    });
    expect(await pares()).toContain('greenhouse:duolingo');
  });

  it('com porte escolhido, so o conjunto curado daquele porte', async () => {
    await descoberta({ ats: 'greenhouse', slug: 'spacex', estado: 'confirmada', vagas: 2564 });
    expect(await pares('startup')).not.toContain('greenhouse:spacex');
    expect(await pares('grande')).not.toContain('greenhouse:spacex');
    // E continua entrando quando ninguem escolheu porte.
    expect(await pares()).toContain('greenhouse:spacex');
  });

  it('banco fora do ar nao derruba o motor: o arquivo segura a busca', async () => {
    const quebrado = {
      atsDiscovery: {
        findMany: () => Promise.reject(new Error('ANDAIME: banco fora')),
      },
    } as unknown as PrismaService;
    const comBancoFora = new BuscaAtsService(quebrado);
    const r = await comBancoFora.catalogoDaBusca();
    expect(r.length).toBeGreaterThan(500);
    // E o motor continua se declarando disponivel.
    expect(await comBancoFora.disponivel()).toBe(true);
  });

  it('freehire desligado nao quebra a colheita do que ja foi aprendido', async () => {
    // Criterio explicito do JOB-40. O que ele cobra e que o deposito continue
    // servindo a busca quando o motor que o encheu sai do ar — e e o teste de
    // independencia inteiro: as confirmadas sao o que sobra se o freehire
    // fechar amanha.
    //
    // A prova e estrutural, e e mais forte que simular a flag: nada em
    // `aprendidas()` nem no `juntar()` le `freehireAtivo`. O unico interruptor
    // da colheita e `jobs.descobertas`, e ele governa o que SAI para a rede
    // (captura e cron), nao a leitura do que ja esta no banco.
    await descoberta({ ats: 'greenhouse', slug: 'spacex', estado: 'confirmada', vagas: 2564 });
    await descoberta({ ats: 'lever', slug: 'veeva', estado: 'confirmada', vagas: 908 });

    // O servico nao recebe `RecursosService` — nao ha flag de motor que ele
    // possa consultar, e por construcao a leitura nao pode depender dela.
    const r = await pares();
    expect(r).toContain('greenhouse:spacex');
    expect(r).toContain('lever:veeva');
    expect(await servico.disponivel()).toBe(true);
  });

  it('paresConhecidos ignora as confirmadas — senao a verificacao as perde', async () => {
    // A armadilha: se a confirmada contasse como "conhecida", a reverificacao
    // de 7 dias a marcaria `ja_no_catalogo`, estado que o catalogo da busca
    // NAO le. O motor perderia a empresa uma semana depois de ganha-la.
    await descoberta({ ats: 'greenhouse', slug: 'spacex', estado: 'confirmada', vagas: 2564 });
    const conhecidos = await servico.paresConhecidos();
    expect(conhecidos.has('greenhouse:spacex')).toBe(false);
    // E o que esta em arquivo continua conhecido.
    expect(conhecidos.has('greenhouse:canonical')).toBe(true);
  });
});
