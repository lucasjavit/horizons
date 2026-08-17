import { Injectable, Logger } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { Firecrawl } from 'firecrawl';
import { PrismaService } from '../prisma/prisma.service';
import { decifrar } from '../settings/crypto';
import type { FiltrosDto, VagaDto } from './job.dto';

/**
 * O que a IA extrai de cada anuncio.
 *
 * `null` e resposta valida em tudo que o anuncio pode nao dizer. Campo ausente
 * permanece ausente: a tela escreve "not stated", e nunca um numero inventado.
 * Se a linha ficar feia com campo vazio, a pressao vira preencher — e o
 * desenho passa a causar a alucinacao.
 */
const SCHEMA_VAGA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    company: { type: 'string' },
    area: { type: ['string', 'null'], description: 'Familia do cargo. Do anuncio, nao deduzida do titulo.' },
    anosExp: { type: ['integer', 'null'], description: 'Anos de experiencia pedidos. null se nao disser.' },
    skills: { type: 'array', items: { type: 'string' } },
    benefits: { type: 'array', items: { type: 'string' } },
    degree: { type: ['string', 'null'] },
    local: { type: ['string', 'null'] },
    paisIso: { type: ['string', 'null'], description: 'ISO-3166 alpha-2 minusculo. null se nao der para dizer.' },
    regime: { type: ['string', 'null'], enum: ['remoto', 'hibrido', 'presencial', null] },
    salaryMin: { type: ['integer', 'null'], description: 'Salario ANUAL. null se nao publicado.' },
    salaryMax: { type: ['integer', 'null'] },
    currency: { type: ['string', 'null'] },
    salaryTrecho: { type: ['string', 'null'], description: 'O texto exato do anuncio de onde o salario saiu.' },
    elegivelBrasil: { type: ['boolean', 'null'], description: 'Contrata quem mora no Brasil? null se nao disser.' },
    elegibilidadeTrecho: { type: ['string', 'null'] },
    ehVaga: {
      type: 'boolean',
      description:
        'true se ESTA pagina descreve UMA vaga. Uma pagina de vaga hospedada ' +
        'num board (greenhouse, lever, getro) CONTINUA sendo uma vaga — ' +
        'classifique o conteudo, nao o site que hospeda.',
    },
    estaFechada: {
      type: 'boolean',
      description:
        'true so quando a pagina DIZ que a vaga fechou ("no longer accepting ' +
        'applications", "position filled", "this job is closed"). Na duvida, false.',
    },
    ehListagem: {
      type: 'boolean',
      description:
        'true se a pagina lista VARIAS vagas em vez de descrever uma. Nesse ' +
        'caso nao invente uma: marque true e deixe o resto vazio.',
    },
    applicationUrl: {
      type: ['string', 'null'],
      description: 'O link de candidatura, quando a pagina der um. null se nao houver.',
    },
    postedAt: {
      type: ['string', 'null'],
      description: 'Data de publicacao em ISO 8601 (2026-08-15). null se a pagina nao disser.',
    },
  },
  required: ['title', 'company', 'skills', 'ehVaga', 'estaFechada', 'ehListagem'],
  additionalProperties: false,
} as const;

const INSTRUCAO = `Extraia os dados desta vaga.

Regras:
- Devolva null quando o anuncio nao disser. NUNCA chute salario, senioridade,
  elegibilidade ou pais.
- salaryMin/salaryMax sao ANUAIS e so saem de valor ANUAL publicado. Se o
  anuncio der valor POR HORA, POR MES ou POR DIA, devolva null nos dois — nao
  converta. Medido em 17/08/2026: "$55 - 100.00 / Hourly" virou 286.000-936.000.
  Um salario errado na tela e pior que "not stated".
- salaryTrecho e elegibilidadeTrecho sao o TEXTO EXATO da pagina. Nao parafraseie.
- Os numeros de salaryMin/salaryMax TEM de aparecer em salaryTrecho. Se voce
  nao consegue citar a frase com o numero, o salario nao esta publicado: null.
- "Mais de 100 candidatos", "competitivo" e "a combinar" NAO sao salario.
- paisIso e ISO-3166 alpha-2 minusculo (us, br, pt). Se a vaga for remota sem
  pais definido, devolva null — remoto nao e um pais.
- Uma pagina de vaga hospedada num board (greenhouse, lever, ashby, getro)
  CONTINUA sendo uma vaga. Classifique o CONTEUDO, nao o site que hospeda.
- Se a pagina LISTA varias vagas, marque ehListagem: true e nao invente uma
  delas. Se for busca ou login, ehVaga: false.
- estaFechada so e true quando a pagina DIZ que fechou. Na duvida, false.`;

/** Paises cujo codigo aceitamos. Fora daqui vira null, nao vira bandeira errada. */
const ISO_VALIDOS = new Set([
  'us','br','pt','es','de','fr','gb','ie','nl','pl','ca','mx','ar','cl','co',
  'it','se','no','dk','fi','ch','at','be','cz','ro','ua','in','au','nz','jp',
  'sg','za','ae','il','uy','pe','cr','gr','hu','hr','bg','sk','si','lt','lv','ee',
]);

/**
 * Quantas paginas abrir por busca.
 *
 * O teto e do rate limit, nao do relogio: o plano gratuito do Firecrawl da 14
 * req/min, e o `search` ja consome uma.
 */
const TETO_PAGINAS = 8;

/** Quantas em paralelo. Acima disto, o 429 chega antes do resultado. */
const LOTE = 3;

export interface EventoBusca {
  tipo: 'inicio' | 'vaga' | 'fim' | 'erro';
  /** Em `inicio`: quantos anuncios a listagem devolveu. */
  total?: number;
  vaga?: VagaDto;
  mensagem?: string;
}

/**
 * A busca ao vivo, disparada pelo botao Filter.
 *
 * Duas fases, como o JOB-01 mediu: o `search` devolve agregadores em vez de
 * vagas, e abrir cada pagina individualmente custa 36s. Entao a listagem vem
 * primeiro (20 anuncios de uma vez), e so as paginas promissoras sao abertas.
 *
 * Emite evento a evento porque uma busca leva ~1 minuto: a vaga aparece na
 * tela quando fica pronta, em vez de a pessoa encarar tela parada ate o fim.
 */
@Injectable()
export class BuscaService {
  private readonly log = new Logger(BuscaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async *buscar(filtros: FiltrosDto): AsyncGenerator<EventoBusca> {
    const chave = await this.chave();
    if (!chave) {
      yield { tipo: 'erro', mensagem: 'Firecrawl token not configured.' };
      return;
    }

    const fc = new Firecrawl({ apiKey: chave });
    const consulta = montarConsulta(filtros);

    let urls: string[];
    try {
      const achados = await fc.search(consulta, { limit: 20 });
      // `search` devolve agregador (Indeed, LinkedIn) tanto quanto anuncio.
      // Filtrar dominio aqui e o que impede a fase 2 de gastar tempo abrindo
      // pagina de busca de outro site.
      urls = (achados.web ?? [])
        .map((r) => ('url' in r ? r.url : undefined))
        .filter((u): u is string => !!u && !ehAgregador(u));
    } catch (e) {
      this.log.error(`search falhou: ${String(e).slice(0, 200)}`);
      yield { tipo: 'erro', mensagem: 'Search failed. Try again in a moment.' };
      return;
    }

    if (urls.length === 0) {
      yield { tipo: 'fim' };
      return;
    }

    const alvo = urls.slice(0, TETO_PAGINAS);
    yield { tipo: 'inicio', total: alvo.length };

    // Em lotes, e nao tudo de uma vez.
    //
    // Medido em 17/08/2026 com token real: disparar 13 scrapes em paralelo
    // estourou o rate limit do Firecrawl (14 req/min no plano gratuito) e as
    // 13 falharam JUNTAS — a busca voltou em 6s com zero vaga. Paralelismo
    // sem teto nao e mais rapido: e mais rapido para levar 429.
    //
    // O lote preserva o streaming (a vaga aparece quando fica pronta) sem
    // gastar a cota inteira num piscar.
    for (let i = 0; i < alvo.length; i += LOTE) {
      const lote = alvo.slice(i, i + LOTE);
      const prontas = await Promise.all(
        lote.map((url) =>
          this.lerVaga(fc, url).catch((e) => {
            // Antes o erro morria num `.catch(() => null)` mudo, e a busca
            // voltava vazia sem nada no log — foi o que escondeu o rate limit.
            this.log.warn(`scrape falhou (${url}): ${String(e).slice(0, 160)}`);
            return null;
          }),
        ),
      );
      for (const vaga of prontas) {
        if (vaga) yield { tipo: 'vaga', vaga };
      }
    }

    yield { tipo: 'fim' };
  }

  /** Abre uma pagina e extrai a vaga. `null` quando nao da para aproveitar. */
  private async lerVaga(fc: Firecrawl, url: string): Promise<VagaDto | null> {
    const doc = await fc.scrape(url, {
      formats: [{ type: 'json', prompt: INSTRUCAO, schema: SCHEMA_VAGA }],
      onlyMainContent: true,
      timeout: 45_000,
    });

    const j = (doc as { json?: Record<string, unknown> }).json;
    if (!j) return null;

    // Pagina de listagem nao vira vaga. O schema e de UM objeto, entao sem
    // isto o modelo e forcado a inventar uma vaga a partir de N: medido pelo
    // QA, weworkremotely.com/remote-jobs voltou duas vezes com empresas
    // DIFERENTES ("Remote Talent Cloud", depois "Braze").
    if (j.ehListagem === true) return null;

    const titulo = texto(j.title);
    const empresa = texto(j.company);

    // O DESCARTE EXIGE EVIDENCIA, e nao ausencia de confirmacao.
    //
    // Antes era `if (j.ehVaga !== true) return null`, e isso jogava fora vaga
    // boa: medido pelo QA em 15/08/2026, a Easyship voltou `ehVaga: false` com
    // salario, 13 skills e a vaga ABERTA — o modelo classificou o site que
    // hospeda ("Search job openings across the network"), nao a vaga. Tres de
    // tres paginas no Getro morreram assim, justamente a classe
    // greenhouse/lever/ashby que queremos preferir.
    //
    // Agora `ehVaga: false` so descarta quando NAO ha os dados de uma vaga. Ter
    // titulo, empresa e a marca de um anuncio vale mais que um booleano que o
    // modelo errou.
    const pareceVaga =
      !!titulo && empresaValida(empresa) && (temSinalDeVaga(j) || j.ehVaga === true);
    if (!pareceVaga) return null;

    // Vaga fechada nao entra. A regra critica 10 do prompt do stakeholder
    // ("remove clearly closed jobs") nunca tinha sido transportada: uma vaga da
    // Reddit ja fechada ainda devolvia salaryMin 190800.
    if (j.estaFechada === true) return null;

    const iso = texto(j.paisIso)?.toLowerCase();

    // O salario so passa se o trecho de origem sustentar o numero.
    const trechoSal = texto(j.salaryTrecho);
    const min = salario(j.salaryMin);
    const max = salario(j.salaryMax);
    const minOk = salarioConfere(min, trechoSal);
    const maxOk = salarioConfere(max, trechoSal);
    if ((min !== null && !minOk) || (max !== null && !maxOk)) {
      this.log.warn(
        `salario descartado (${url}): ${min}-${max} nao confere com ${JSON.stringify(trechoSal)?.slice(0, 80)}`,
      );
    }

    return {
      // Id sintetico: esta vaga nao foi gravada, e a tela precisa de chave.
      id: url,
      title: titulo,
      company: empresa,
      url,
      local: texto(j.local),
      fonte: dominio(url),
      regime: texto(j.regime),
      skills: lista(j.skills),
      area: texto(j.area),
      anosExp: inteiro(j.anosExp),
      benefits: lista(j.benefits),
      degree: texto(j.degree),
      logoUrl: null,
      // ISO fora da lista vira null: melhor sem bandeira que com a errada.
      paisIso: iso && ISO_VALIDOS.has(iso) ? iso : null,
      salaryMin: minOk ? min : null,
      salaryMax: maxOk ? max : null,
      currency: texto(j.currency)?.toUpperCase().slice(0, 3) ?? null,
      // Sem numero valido, o trecho tambem nao vai: citar uma frase sob um
      // campo vazio confunde mais do que ajuda.
      salaryTrecho: minOk && maxOk ? trechoSal : null,
      elegivelBrasil: typeof j.elegivelBrasil === 'boolean' ? j.elegivelBrasil : null,
      elegibilidadeTrecho: texto(j.elegibilidadeTrecho),
      postedAt: dataIso(j.postedAt),
      foundAt: new Date().toISOString(),
    };
  }

  private async chave(): Promise<string | null> {
    const guardado = await this.prisma.apiToken.findFirst({
      where: { provider: ApiProvider.FIRECRAWL },
      select: { secret: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (guardado?.secret) {
      try {
        return decifrar(guardado.secret);
      } catch {
        this.log.warn('Token do Firecrawl nao pode ser decifrado');
      }
    }
    return process.env.FIRECRAWL_API_KEY ?? null;
  }
}

/** A consulta que vai para o `search`, montada dos filtros da tela. */
function montarConsulta(f: FiltrosDto): string {
  const partes: string[] = [];
  if (f.job_titles?.length) partes.push(f.job_titles.join(' OR '));
  else partes.push('software engineer');
  if (f.seniority) partes.push(f.seniority);
  if (f.technologies?.length) partes.push(f.technologies.slice(0, 4).join(' '));
  if (f.remote === 'remoto') partes.push('remote');
  if (f.locations?.length) partes.push(f.locations[0]);
  partes.push('jobs hiring');
  return partes.join(' ');
}

/**
 * Agregadores ficam de fora.
 *
 * Nao e so ToS (o look4job decidiu evitar Indeed e LinkedIn): a pagina deles e
 * uma BUSCA, nao um anuncio, e abrir custa os mesmos 5 creditos para extrair
 * nada aproveitavel.
 */
const AGREGADORES = [
  'indeed.', 'linkedin.', 'glassdoor.', 'ziprecruiter.', 'monster.',
  'simplyhired.', 'google.com/search', 'bing.com',
];
function ehAgregador(url: string): boolean {
  const u = url.toLowerCase();
  return AGREGADORES.some((a) => u.includes(a));
}

function dominio(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((s) => s.trim()))];
}

function inteiro(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * Salario com faixa de plausibilidade.
 *
 * Foi assim que "Mais de 100 candidatos" virou salario no teste do JOB-01: a
 * IA preencheu o campo com o numero que achou perto. Valor fora da faixa vira
 * "nao informado" em vez de virar promessa falsa na tela.
 */
function salario(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (v < 10_000 || v > 2_000_000) return null;
  return Math.round(v);
}

/**
 * O salario e confiavel?
 *
 * O trecho de origem deixou de ser so exibicao e virou VALIDACAO: se o numero
 * extraido nao aparece na frase citada, ele foi calculado — e calculo e onde a
 * IA erra. Medido em 17/08/2026: a Robert Half publicava "$55 - 100.00 /
 * Hourly" e a extracao devolveu 286.000-936.000 anuais.
 *
 * Isto e o padrao que o JOB-08 identificou funcionando: a regra que vira
 * verificacao em codigo segura; a que fica como prosa no prompt, nao.
 */
function salarioConfere(valor: number | null, trecho: string | null): boolean {
  if (valor === null) return true;
  if (!trecho) return false;
  const t = trecho.toLowerCase();
  // Por hora / mes / dia nao vira anual aqui — se o anuncio cita periodo curto,
  // qualquer numero anual saiu de conta, nao da pagina.
  if (/\/\s*(hour|hr|hora)|hourly|per hour|\/\s*(month|mes)|monthly|per month|\/\s*day|daily/.test(t)) {
    return false;
  }
  // Os digitos do valor precisam estar no texto. As tres formas que os
  // anuncios usam para o mesmo numero, medidas em buscas reais:
  //   190800  → "$190,800"   (cheio)
  //   190800  → "$190.8k"    (milhar com decimal)
  //   150000  → "$150k"      (milhar redondo)
  const so = t.replace(/[^0-9]/g, '');
  const cheio = String(valor);
  const milhar = String(Math.round(valor / 1000));
  // "190.8k" vira "1908" depois de tirar o nao-digito; o valor 190800 dividido
  // por 100 da 1908. Sem esta forma, "$190.8k / year" era rejeitado como se
  // fosse invencao — e e um anuncio legitimo.
  const decimal = String(Math.round(valor / 100));
  return so.includes(cheio) || so.includes(milhar) || so.includes(decimal);
}

/**
 * A pagina tem a cara de um anuncio?
 *
 * Serve de contrapeso ao `ehVaga`: um anuncio com requisitos, skills e
 * descricao continua sendo um anuncio mesmo que o modelo tenha olhado o
 * cabecalho do board e respondido `false`.
 */
function temSinalDeVaga(j: Record<string, unknown>): boolean {
  const skills = Array.isArray(j.skills) ? j.skills.length : 0;
  const temSalario = j.salaryMin != null || j.salaryTrecho != null;
  const temContexto = !!texto(j.area) || j.anosExp != null || !!texto(j.local);
  // Dois sinais independentes: um sozinho e fraco demais para sustentar uma
  // pagina que o modelo classificou como nao-vaga.
  return [skills >= 3, temSalario, temContexto].filter(Boolean).length >= 2;
}

/** Data em ISO, quando a pagina deu uma que faca sentido. */
function dataIso(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const agora = Date.now();
  // Data no futuro ou anterior a 2000 e dado ruim da origem, nao publicacao.
  if (d.getTime() > agora + 86_400_000 || d.getFullYear() < 2000) return null;
  return d.toISOString();
}

/**
 * A empresa e um nome, ou e o modelo dizendo que nao achou?
 *
 * Medido em 17/08/2026, numa busca real: voltaram `"."` e `"Not specified"`
 * como nome de empresa. Um cartao com empresa "." nao ajuda ninguem a decidir
 * se vale clicar, e passa a impressao de que o resto do dado tambem e lixo.
 */
const NAO_E_EMPRESA = new Set([
  'not specified', 'unknown', 'n/a', 'na', 'none', 'not stated',
  'not provided', 'company', 'confidential', '-', '.', '--',
]);
function empresaValida(nome: string | null): nome is string {
  if (!nome) return false;
  const limpo = nome.trim().toLowerCase();
  if (limpo.length < 2) return false;
  if (NAO_E_EMPRESA.has(limpo)) return false;
  // Precisa ter ao menos uma letra: "123" e "..." nao sao nome de empresa.
  return /\p{L}/u.test(nome);
}
