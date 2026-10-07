/**
 * JOB-54 — a ordem da lista e a janela `Posted`, medidas sem rede e sem banco.
 *
 * O que esta suite prova, e por que cada bloco existe:
 *
 * 1. **A consulta que sai para o freehire**, opcao por opcao. O nome errado de
 *    parametro la nao da erro — e ignorado, e a lista volta na ordem padrao
 *    parecendo certa.
 * 2. **O anonimo continua com `posted_at asc`** (JOB-47), escolha o que
 *    escolher. E a restricao do card que mais custa se quebrar em silencio.
 * 3. **A ordem entra na chave do cache e chega a pagina 2.**
 * 4. **O DTO recusa ordem inventada** com 400, pelo `ValidationPipe` de verdade
 *    (as mesmas opcoes do `main.ts`).
 * 5. **O `Best match`** — a unica ordem que e codigo nosso.
 *
 * O alvo e o codigo de producao: `fetch` dublado no nivel da REDE (licao do
 * `limites-anonimos.spec.ts`) e o `BuscaService` real com os vizinhos em stub.
 */
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { BuscaFreehireService } from './busca-freehire.service';
import { BuscaService, type EventoBusca } from './busca.service';
import { chaveDoCache } from './cache-de-busca';
import { paraConsultaFreehire } from './freehire-consulta';
import { FiltrosDto, ORDENS, type VagaDto } from './job.dto';
import { LIMITES_ANONIMOS, LIMITES_COM_SESSAO } from './limites-anonimos';
import {
  ordemAplicada,
  ordemEfetiva,
  ordenarLote,
  ordenarPorAfinidade,
} from './ordenacao';
import { SessaoDeBuscaService } from './sessao-de-busca.service';

function diasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

function vaga(id: string, skills: string[], idadeEmDias: number | null): VagaDto {
  return {
    id,
    title: `Engineer ${id}`,
    company: `Empresa ${id}`,
    url: `https://job-boards.greenhouse.io/empresa/jobs/${id}`,
    local: 'Remote — LATAM',
    fonte: 'greenhouse.io',
    regime: 'remoto',
    skills,
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
    postedAt: idadeEmDias === null ? null : diasAtras(idadeEmDias),
    foundAt: new Date().toISOString(),
  };
}

const ids = (vs: VagaDto[]): string[] => vs.map((v) => v.id);

describe('a consulta do freehire, por ordem escolhida', () => {
  const base: FiltrosDto = { job_titles: ['backend engineer'] };
  const consulta = (f: FiltrosDto) => new URLSearchParams(paraConsultaFreehire(f));

  it('newest: posted_at desc, com o order explicito', () => {
    const p = consulta({ ...base, sort: 'newest' });
    expect(p.get('sort')).toBe('posted_at');
    expect(p.get('order')).toBe('desc');
  });

  it('views: view_count desc', () => {
    const p = consulta({ ...base, sort: 'views' });
    expect(p.get('sort')).toBe('view_count');
    expect(p.get('order')).toBe('desc');
  });

  it('relevance: nenhum sort — a ordem do texto e a da API', () => {
    const p = consulta({ ...base, sort: 'relevance' });
    expect(p.has('sort')).toBe(false);
    expect(p.has('order')).toBe(false);
  });

  it('match com tecnologia: nenhum sort — a reordenacao e local', () => {
    const p = consulta({ ...base, sort: 'match', technologies: ['React'] });
    expect(p.has('sort')).toBe(false);
  });

  it('match SEM tecnologia cai em newest, e nao em relevancia calada', () => {
    const p = consulta({ ...base, sort: 'match' });
    expect(p.get('sort')).toBe('posted_at');
    expect(p.get('order')).toBe('desc');
    expect(ordemEfetiva({ sort: 'match' })).toBe('newest');
    expect(ordemEfetiva({ sort: 'match', technologies: ['  '] })).toBe('newest');
  });

  it('sem sort (busca agendada, alerta): a consulta nao muda', () => {
    const p = consulta(base);
    expect(p.has('sort')).toBe(false);
    expect(p.has('order')).toBe(false);
  });

  it.each([1, 3, 7, 14, 30])('a janela de %i dia(s) vai inteira para a API', (dias) => {
    const p = consulta({ ...base, sort: 'newest', posted_within_days: dias });
    expect(p.get('posted_within_days')).toBe(String(dias));
  });

  it.each([20, 90])('a janela antiga de %i dias (busca salva) continua indo', (dias) => {
    expect(consulta({ ...base, posted_within_days: dias }).get('posted_within_days')).toBe(
      String(dias),
    );
  });
});

describe('o anonimo continua com posted_at asc, escolha o que escolher (JOB-47)', () => {
  it.each(ORDENS)('sort=%s nao fura o corte', (sort) => {
    const p = new URLSearchParams(
      paraConsultaFreehire(
        { job_titles: ['backend'], sort, technologies: ['React'] },
        LIMITES_ANONIMOS,
      ),
    );
    expect(p.get('sort')).toBe('posted_at');
    expect(p.get('order')).toBe('asc');
    expect(p.get('posted_within_days')).toBe('90');
    // Um so de cada: `append` no lugar de `set` deixaria os dois na URL.
    expect(p.getAll('sort')).toHaveLength(1);
    expect(p.getAll('order')).toHaveLength(1);
  });

  it('a ordem aplicada que a tela recebe e `oldest`, e o lote nao e reordenado', () => {
    const f: FiltrosDto = { sort: 'match', technologies: ['react'] };
    expect(ordemAplicada('freehire', f, LIMITES_ANONIMOS)).toBe('oldest');
    const lote = [vaga('a', [], 40), vaga('b', ['react'], 20)];
    expect(ids(ordenarLote(lote, f, LIMITES_ANONIMOS))).toEqual(['a', 'b']);
  });
});

describe('a ordem entra na chave do cache', () => {
  const base: FiltrosDto = { job_titles: ['backend'], regions: ['latam'] };

  it('cada ordem tem a propria chave', () => {
    const chaves = ORDENS.map((sort) => chaveDoCache({ ...base, sort }));
    expect(new Set(chaves).size).toBe(ORDENS.length);
  });

  it('com e sem ordem sao chaves diferentes', () => {
    expect(chaveDoCache({ ...base, sort: 'newest' })).not.toBe(chaveDoCache(base));
  });

  it('a janela tambem: Today e Last 3 days nao dividem cache', () => {
    expect(chaveDoCache({ ...base, posted_within_days: 1 })).not.toBe(
      chaveDoCache({ ...base, posted_within_days: 3 }),
    );
  });
});

describe('o DTO valida a ordem (o ValidationPipe do main.ts)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validar = (corpo: unknown) =>
    pipe.transform(corpo, { type: 'body', metatype: FiltrosDto });

  it.each(ORDENS)('aceita %s', async (sort) => {
    await expect(validar({ sort })).resolves.toMatchObject({ sort });
  });

  it.each(['view_count', 'posted_at', 'NEWEST', '', 7])(
    'recusa %p com 400',
    async (sort) => {
      await expect(validar({ sort })).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('recusa o nome errado do campo, em vez de ignorar', async () => {
    await expect(validar({ ordem: 'newest' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a janela continua exigindo inteiro >= 1', async () => {
    await expect(validar({ posted_within_days: 1 })).resolves.toMatchObject({
      posted_within_days: 1,
    });
    await expect(validar({ posted_within_days: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validar({ posted_within_days: '3' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('Best match — a reordenacao local', () => {
  it('mais tecnologias em comum primeiro', () => {
    const lote = [
      vaga('zero', ['php'], 1),
      vaga('duas', ['react', 'nodejs', 'aws'], 9),
      vaga('uma', ['react'], 5),
    ];
    expect(ids(ordenarPorAfinidade(lote, ['React', 'Node.js']))).toEqual(['duas', 'uma', 'zero']);
  });

  it('empate cai na mais recente, e sem data vai para o fim do empate', () => {
    const lote = [
      vaga('velha', ['react'], 30),
      vaga('sem-data', ['react'], null),
      vaga('nova', ['react'], 1),
    ];
    expect(ids(ordenarPorAfinidade(lote, ['react']))).toEqual(['nova', 'velha', 'sem-data']);
  });

  it('casa o que o curriculo escreve com o slug do freehire', () => {
    // Medido em 05/10: a API devolve `nodejs`, `csharp`, `dotnet`, `ci-cd`.
    const lote = [vaga('nada', ['java'], 1), vaga('tudo', ['nodejs', 'csharp', 'dotnet', 'ci-cd'], 9)];
    expect(ids(ordenarPorAfinidade(lote, ['Node.js', 'C#', '.NET', 'CI/CD']))).toEqual([
      'tudo',
      'nada',
    ]);
  });

  it('"Java" nao casa com `javascript` — igualdade, e nao conter', () => {
    const lote = [vaga('js', ['javascript'], 9), vaga('java', ['java'], 20)];
    expect(ids(ordenarPorAfinidade(lote, ['Java']))).toEqual(['java', 'js']);
  });

  it('nao muta o lote que recebeu', () => {
    const lote = [vaga('a', [], 1), vaga('b', ['react'], 2)];
    ordenarPorAfinidade(lote, ['react']);
    expect(ids(lote)).toEqual(['a', 'b']);
  });

  it('so reordena quando a ordem pedida e match', () => {
    const lote = [vaga('a', [], 1), vaga('b', ['react'], 2)];
    const f: FiltrosDto = { technologies: ['react'] };
    expect(ids(ordenarLote(lote, { ...f, sort: 'newest' }, LIMITES_COM_SESSAO))).toEqual(['a', 'b']);
    expect(ids(ordenarLote(lote, f, LIMITES_COM_SESSAO))).toEqual(['a', 'b']);
    expect(ids(ordenarLote(lote, { ...f, sort: 'match' }, LIMITES_COM_SESSAO))).toEqual(['b', 'a']);
  });
});

describe('a ordem que cada motor declara ter aplicado', () => {
  const tec = { technologies: ['react'] };

  it('freehire honra as quatro', () => {
    for (const sort of ORDENS) {
      expect(ordemAplicada('freehire', { ...tec, sort }, LIMITES_COM_SESSAO)).toBe(sort);
    }
  });

  it('ATS nao tem view_count nem relevancia: declara newest', () => {
    expect(ordemAplicada('ats', { sort: 'views' }, LIMITES_COM_SESSAO)).toBe('newest');
    expect(ordemAplicada('ats', { sort: 'relevance' }, LIMITES_COM_SESSAO)).toBe('newest');
    expect(ordemAplicada('ats', { sort: 'newest' }, LIMITES_COM_SESSAO)).toBe('newest');
    expect(ordemAplicada('ats', { ...tec, sort: 'match' }, LIMITES_COM_SESSAO)).toBe('match');
  });

  it('IA e Firecrawl nao garantem ordem nenhuma', () => {
    expect(ordemAplicada('ia', { sort: 'newest' }, LIMITES_COM_SESSAO)).toBeNull();
    expect(ordemAplicada('firecrawl', { sort: 'views' }, LIMITES_COM_SESSAO)).toBeNull();
  });
});

/**
 * A pagina 2, pelo motor real com a rede dublada: o que se afirma e a URL que
 * SAIU, e nao o que um duble do servico diria que saiu.
 */
describe('a pagina 2 sai com a mesma ordem da pagina 1', () => {
  let fetchOriginal: typeof global.fetch;
  let urls: string[];

  beforeEach(() => {
    fetchOriginal = global.fetch;
    urls = [];
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { total: 500 } }),
        headers: new Map(),
      };
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('views: offset 0 e offset 60 levam sort=view_count&order=desc', async () => {
    const motor = new BuscaFreehireService();
    const f: FiltrosDto = { job_titles: ['backend'], sort: 'views', posted_within_days: 3 };
    await motor.buscarPagina(f, 0);
    await motor.buscarPagina(f, 60);

    expect(urls).toHaveLength(2);
    for (const [i, offset] of [
      [0, '0'],
      [1, '60'],
    ] as const) {
      const p = new URL(urls[i]).searchParams;
      expect(p.get('sort')).toBe('view_count');
      expect(p.get('order')).toBe('desc');
      expect(p.get('posted_within_days')).toBe('3');
      expect(p.get('offset')).toBe(offset);
    }
  });
});

/**
 * O orquestrador de verdade, com os vizinhos em stub e a sessao REAL: e ela
 * que carrega a ordem ate a pagina 2, entao dubla-la seria medir o duble.
 */
describe('BuscaService — a ordem atravessa a busca e a paginacao', () => {
  function montar(opcoes: {
    paginas: VagaDto[][];
    freehireAtivo?: boolean;
    doAts?: VagaDto[];
  }) {
    const chamadas: Array<{ filtros: FiltrosDto; offset: number }> = [];
    const freehire = {
      buscarPagina: jest.fn(async (filtros: FiltrosDto, offset: number) => {
        chamadas.push({ filtros, offset });
        const vagas = opcoes.paginas[offset / 60] ?? [];
        return { vagas, lidasDaApi: vagas.length === 0 ? 0 : 60, totalNoFiltro: 500 };
      }),
    };
    const recursos = {
      obter: jest.fn(async () => ({
        firecrawlAtivo: false,
        ordemDaIa: [],
        atsAtivo: true,
        freehireAtivo: opcoes.freehireAtivo ?? true,
        paginacaoAtiva: true,
      })),
    };
    const ats = { buscar: jest.fn(async () => opcoes.doAts ?? []) };
    const descobertas = { anotar: jest.fn(async () => undefined) };
    const servico = new BuscaService(
      {} as never,
      {} as never,
      recursos as never,
      ats as never,
      freehire as never,
      descobertas as never,
      new SessaoDeBuscaService(),
      {} as never,
    );
    return { servico, chamadas };
  }

  async function colher(gerador: AsyncGenerator<EventoBusca>) {
    const vagas: VagaDto[] = [];
    let fim: EventoBusca | undefined;
    for await (const ev of gerador) {
      if (ev.tipo === 'vaga' && ev.vaga) vagas.push(ev.vaga);
      if (ev.tipo === 'fim') fim = ev;
    }
    return { vagas, fim };
  }

  it('match: reordena a pagina 1, e a pagina 2 herda a ordem pela sessao', async () => {
    const { servico, chamadas } = montar({
      paginas: [
        [vaga('p1-zero', [], 1), vaga('p1-react', ['react'], 9)],
        [vaga('p2-zero', [], 1), vaga('p2-react', ['react'], 9)],
      ],
    });
    const filtros: FiltrosDto = { sort: 'match', technologies: ['React'] };

    const { vagas, fim } = await colher(servico.buscar(filtros, LIMITES_COM_SESSAO));
    expect(ids(vagas)).toEqual(['p1-react', 'p1-zero']);
    expect(fim?.ordem).toBe('match');
    expect(fim?.temMais).toBe(true);

    // O corpo de `search/mais` e so o id: a ordem tem de vir da sessao.
    const mais = await servico.mais(fim!.sessao!);
    expect(ids(mais.vagas)).toEqual(['p2-react', 'p2-zero']);
    expect(chamadas[1]).toEqual({ filtros, offset: 60 });
  });

  it('newest: o lote sai como a API mandou, e o fim declara newest', async () => {
    const { servico, chamadas } = montar({
      paginas: [[vaga('a', [], 1), vaga('b', ['react'], 9)]],
    });
    const { vagas, fim } = await colher(
      servico.buscar({ sort: 'newest', technologies: ['react'] }, LIMITES_COM_SESSAO),
    );
    expect(ids(vagas)).toEqual(['a', 'b']);
    expect(fim?.ordem).toBe('newest');
    expect(chamadas[0].filtros.sort).toBe('newest');
  });

  it('anonimo com match: nao reordena, e o fim declara oldest', async () => {
    const { servico } = montar({
      paginas: [[vaga('a', [], 40), vaga('b', ['react'], 20)]],
    });
    const { vagas, fim } = await colher(
      servico.buscar({ sort: 'match', technologies: ['react'] }, LIMITES_ANONIMOS),
    );
    expect(ids(vagas)).toEqual(['a', 'b']);
    expect(fim?.ordem).toBe('oldest');
  });

  it('quando quem responde e o ATS, `views` e declarado como newest', async () => {
    const { servico } = montar({
      paginas: [],
      freehireAtivo: false,
      doAts: [vaga('a', [], 1), vaga('b', [], 9)],
    });
    const { vagas, fim } = await colher(servico.buscar({ sort: 'views' }, LIMITES_COM_SESSAO));
    expect(ids(vagas)).toEqual(['a', 'b']);
    expect(fim?.ordem).toBe('newest');
  });
});
