/**
 * JOB-47 — a politica do anonimo, medida sem rede e sem duble.
 *
 * ## Por que esta suite existe, ao lado da e2e
 *
 * Ela nasceu de uma falha de teste de mutacao, e vale registrar a falha: a
 * primeira versao da `busca-anonima.e2e.spec.ts` dublava o `BuscaFreehireService`
 * com um duble que **aplicava o corte de idade por conta propria**. O resultado
 * foi um conjunto verde que media o duble: desligar o corte de verdade no
 * `peneirar` do motor real deixava **17 de 17 testes passando**.
 *
 * Duas licoes, e as duas estao nestes arquivos:
 *
 * 1. Um duble que reimplementa a regra testa a si mesmo. O que o duble pode
 *    fazer e devolver dado cru — o corte tem de ser do codigo de producao.
 * 2. A protecao de permissao precisa de teste de UNIDADE sobre a funcao real,
 *    e nao so de teste de rota: a rota tem muitas camadas onde um corte pode
 *    acontecer, e o teste de rota nao diz qual delas funcionou.
 *
 * Aqui o alvo e o codigo de producao direto: `velhaOBastante`, o `peneirar`
 * (pelo metodo publico do motor, com o `fetch` dublado no nivel da REDE) e a
 * consulta que vai para a API.
 */
import {
  DIAS_PARA_O_ANONIMO,
  JANELA_DO_ANONIMO_EM_DIAS,
  LIMITES_ANONIMOS,
  LIMITES_COM_SESSAO,
  limitesDe,
  velhaOBastante,
} from './limites-anonimos';
import { paraConsultaFreehire } from './freehire-consulta';
import { BuscaFreehireService } from './busca-freehire.service';
import type { FiltrosDto } from './job.dto';
import { SessaoDeBuscaService } from './sessao-de-busca.service';
import type { LimitesDaBusca } from './limites-anonimos';

/** Uma data a N dias atras, em ISO. */
function diasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

describe('limitesDe — quem pode o que', () => {
  it('sem usuario: um motor gratuito e o corte de 14 dias', () => {
    expect(limitesDe(null)).toEqual(LIMITES_ANONIMOS);
    expect(limitesDe(undefined)).toEqual(LIMITES_ANONIMOS);
    expect(limitesDe(null).somenteFreehire).toBe(true);
    expect(limitesDe(null).idadeMinimaEmDias).toBe(DIAS_PARA_O_ANONIMO);
  });

  it('com usuario: a cadeia inteira e o acervo inteiro', () => {
    expect(limitesDe({ id: 'abc' })).toEqual(LIMITES_COM_SESSAO);
    expect(limitesDe({ id: 'abc' }).somenteFreehire).toBe(false);
    expect(limitesDe({ id: 'abc' }).idadeMinimaEmDias).toBeNull();
  });
});

describe('velhaOBastante — o corte de idade', () => {
  it('a vaga de 20 dias passa; a de ontem nao', () => {
    expect(velhaOBastante(diasAtras(20), 14)).toBe(true);
    expect(velhaOBastante(diasAtras(1), 14)).toBe(false);
  });

  it('a fronteira e inclusiva: exatamente 14 dias passa', () => {
    // `>=` e nao `>`: "14 dias ou mais", como o stakeholder escreveu. Um dia
    // de diferenca aqui muda o que a pessoa ve, e e o tipo de off-by-one que
    // ninguem nota sem um teste que o nomeie.
    expect(velhaOBastante(diasAtras(14.01), 14)).toBe(true);
    expect(velhaOBastante(diasAtras(13.9), 14)).toBe(false);
  });

  it('sem data, NAO passa — o desconhecido fica de fora', () => {
    // O lado seguro: deixar passar o que nao se sabe datar entregaria a vaga
    // de hoje ao anonimo, que e a unica coisa que esta regra evita.
    expect(velhaOBastante(null, 14)).toBe(false);
    expect(velhaOBastante(undefined, 14)).toBe(false);
    expect(velhaOBastante('', 14)).toBe(false);
  });

  it('data impronunciavel conta como data ausente', () => {
    expect(velhaOBastante('nao e uma data', 14)).toBe(false);
    expect(velhaOBastante('2026-13-45', 14)).toBe(false);
  });

  it('data no futuro nao passa — board com relogio errado', () => {
    expect(velhaOBastante(diasAtras(-5), 14)).toBe(false);
  });
});

describe('paraConsultaFreehire — o corte vira consulta', () => {
  /**
   * A medicao que define o desenho, de 01/10/2026 contra `freehire.me`.
   *
   * A API **nao tem** parametro de "mais velha que N dias": `posted_before_days`,
   * `posted_after_days`, `posted_min_days`, `posted_older_than_days`,
   * `posted_at_before` e `min_age_days` voltaram todos em `meta.ignored_params`
   * com o total intacto (58.782 em `regions=latam`). O corte sai da combinacao
   * de uma janela de novidade com a ordenacao invertida.
   */
  it('com sessao: nenhum parametro de data entra sozinho', () => {
    const q = paraConsultaFreehire({ job_titles: ['Backend'] } as FiltrosDto, LIMITES_COM_SESSAO);
    expect(q).not.toContain('sort=');
    expect(q).not.toContain('posted_within_days');
  });

  it('anonimo: janela de 90 dias, ordenada do mais VELHO para o mais novo', () => {
    const p = new URLSearchParams(
      paraConsultaFreehire({ job_titles: ['Backend'] } as FiltrosDto, LIMITES_ANONIMOS),
    );
    expect(p.get('posted_within_days')).toBe(String(JANELA_DO_ANONIMO_EM_DIAS));
    // **`order=asc` e o que faz a feature existir.** Sem ele a primeira pagina
    // do anonimo era ZERO de 60 (medido em 01/10): o default da API e o mais
    // novo primeiro, e o mais novo e exatamente o que ele nao pode ver.
    expect(p.get('sort')).toBe('posted_at');
    expect(p.get('order')).toBe('asc');
  });

  it('o pedido de recencia da pessoa vence quando e mais estreito', () => {
    // Anonimo que pede "ultimos 7 dias" recebe 7 e nao 90: a janela maior
    // devolveria vaga que o filtro DELA excluiu.
    const p = new URLSearchParams(
      paraConsultaFreehire(
        { job_titles: ['Backend'], posted_within_days: 7 } as FiltrosDto,
        LIMITES_ANONIMOS,
      ),
    );
    expect(p.get('posted_within_days')).toBe('7');
  });

  it('e a janela vence quando o pedido e mais largo', () => {
    const p = new URLSearchParams(
      paraConsultaFreehire(
        { job_titles: ['Backend'], posted_within_days: 365 } as FiltrosDto,
        LIMITES_ANONIMOS,
      ),
    );
    expect(p.get('posted_within_days')).toBe(String(JANELA_DO_ANONIMO_EM_DIAS));
  });

  it('um `posted_within_days` so sai na consulta — nao dois valores', () => {
    // `URLSearchParams.set` contra `append`: dois valores para o mesmo
    // parametro fariam a API escolher um, e nao se sabe qual.
    const q = paraConsultaFreehire(
      { job_titles: ['Backend'], posted_within_days: 7 } as FiltrosDto,
      LIMITES_ANONIMOS,
    );
    expect(new URLSearchParams(q).getAll('posted_within_days')).toHaveLength(1);
  });
});

/**
 * O `peneirar` do motor REAL, com o `fetch` dublado no nivel da rede.
 *
 * **O duble e do `fetch`, e nao do servico**, e e a correcao da falha que abriu
 * este arquivo: dublando a rede, todo o codigo de producao do motor roda —
 * `converter`, `peneirar`, `semRepetirUrl`, `comElegibilidade`. O que entra e
 * JSON cru como a API o devolveria, incluindo a vaga nova que a API deixou
 * escapar.
 */
describe('o motor corta a vaga nova que a API deixou passar', () => {
  const motor = new BuscaFreehireService();
  let fetchOriginal: typeof global.fetch;

  /** O JSON cru de uma vaga, no formato da API deles. */
  function linha(slug: string, idadeEmDias: number): Record<string, unknown> {
    return {
      public_slug: slug,
      title: `Backend Engineer ${slug}`,
      company: { name: `Empresa ${slug}` },
      url: `https://job-boards.greenhouse.io/empresa/jobs/${slug}`,
      location: 'Remote — LATAM',
      work_mode: 'remote',
      skills: ['node'],
      posted_at: diasAtras(idadeEmDias),
    };
  }

  /**
   * A resposta que a API daria, **com uma vaga nova no meio**.
   *
   * Este e o caso que a spec deles descreve e que a guarda local existe para
   * cobrir: *"Some boards restate this date on every crawl, so a posting that
   * has been open for months can satisfy a narrow bound here"*. A janela de 90
   * dias deixa passar; o `peneirar` corta.
   */
  beforeEach(() => {
    fetchOriginal = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [linha('velha-1', 30), linha('nova-1', 2), linha('velha-2', 50)],
        meta: { total: 3 },
      }),
      headers: new Map(),
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('anonimo: a vaga de 2 dias nao sai do motor', async () => {
    const pagina = await motor.buscarPagina(
      { job_titles: ['Backend'] } as FiltrosDto,
      0,
      LIMITES_ANONIMOS,
    );

    const slugs = pagina.vagas.map((v) => v.url).join();
    expect(slugs).toContain('velha-1');
    expect(slugs).toContain('velha-2');
    // A assercao do card: a vaga nova NAO chega ao anonimo, mesmo tendo vindo
    // da API dentro da janela.
    expect(slugs).not.toContain('nova-1');
    expect(pagina.vagas).toHaveLength(2);
  });

  it('com sessao: as tres saem, inclusive a de 2 dias', async () => {
    const pagina = await motor.buscarPagina(
      { job_titles: ['Backend'] } as FiltrosDto,
      0,
      LIMITES_COM_SESSAO,
    );

    expect(pagina.vagas).toHaveLength(3);
    expect(pagina.vagas.map((v) => v.url).join()).toContain('nova-1');
  });

  it('o `lidasDaApi` conta o que a API devolveu, e nao o que sobrou', async () => {
    // E o que faz o offset andar direito (JOB-45): 3 lidas e 2 entregues
    // significa que a pagina 2 comeca em 3, e nao em 2 — senao a paginacao
    // releria a linha descartada para descarta-la de novo.
    const pagina = await motor.buscarPagina(
      { job_titles: ['Backend'] } as FiltrosDto,
      0,
      LIMITES_ANONIMOS,
    );
    expect(pagina.lidasDaApi).toBe(3);
    expect(pagina.vagas).toHaveLength(2);
  });

  it('a consulta enviada leva a janela e a ordenacao do anonimo', async () => {
    await motor.buscarPagina({ job_titles: ['Backend'] } as FiltrosDto, 0, LIMITES_ANONIMOS);

    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('sort=posted_at');
    expect(url).toContain('order=asc');
    expect(url).toContain(`posted_within_days=${JANELA_DO_ANONIMO_EM_DIAS}`);
  });
});

/**
 * A sessao de paginacao guarda os limites, e a pagina 2 os herda.
 *
 * **O defeito que isto cobre nao tem sintoma na pagina 1.** O corpo de
 * `POST /jobs/search/mais` manda so o id da sessao (ver `MaisVagasPedidoDto`),
 * entao se a sessao nao guardasse a restricao, o servico teria de supor uma — e
 * supor "sem restricao" daria ao anonimo o acervo novo a partir do segundo
 * clique, com a primeira pagina parecendo correta.
 *
 * Este bloco nasceu de um teste de mutacao que SOBREVIVEU: trocar o
 * `limitesDe` da sessao por um retorno fixo sem restricao deixava as 17 provas
 * da e2e passando.
 */
describe('a sessao de busca herda os limites (JOB-47)', () => {
  const filtros = { job_titles: ['Backend'] } as FiltrosDto;

  function abrir(limites: LimitesDaBusca) {
    const sessoes = new SessaoDeBuscaService();
    const { id } = sessoes.abrir('freehire', filtros, [], 0, null, true, limites);
    return { sessoes, id };
  }

  it('devolve os limites do anonimo, e nao um default permissivo', () => {
    const { sessoes, id } = abrir(LIMITES_ANONIMOS);

    expect(sessoes.limitesDe(id)).toEqual(LIMITES_ANONIMOS);
    expect(sessoes.limitesDe(id)?.idadeMinimaEmDias).toBe(DIAS_PARA_O_ANONIMO);
    expect(sessoes.limitesDe(id)?.somenteFreehire).toBe(true);
  });

  it('e os de quem entrou, quando foi quem entrou que abriu', () => {
    const { sessoes, id } = abrir(LIMITES_COM_SESSAO);

    expect(sessoes.limitesDe(id)).toEqual(LIMITES_COM_SESSAO);
    expect(sessoes.limitesDe(id)?.idadeMinimaEmDias).toBeNull();
  });

  it('sessao que nao existe devolve `null`, e nao um limite inventado', () => {
    const { sessoes } = abrir(LIMITES_ANONIMOS);

    // `null` e o que faz o `mais()` responder `expirada: true`. Devolver um
    // objeto permissivo aqui seria dar o acervo inteiro a quem mandasse um id
    // qualquer.
    expect(sessoes.limitesDe('nao-existe')).toBeNull();
  });

  it('duas sessoes nao trocam limites entre si', () => {
    const anonima = abrir(LIMITES_ANONIMOS);
    const comSessao = abrir(LIMITES_COM_SESSAO);

    // O mesmo `Map` guarda as duas, e um `Sessao` compartilhado por referencia
    // faria a segunda sobrescrever a primeira.
    expect(anonima.sessoes.limitesDe(anonima.id)?.somenteFreehire).toBe(true);
    expect(comSessao.sessoes.limitesDe(comSessao.id)?.somenteFreehire).toBe(false);
  });
});
