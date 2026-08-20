import type { FiltrosDto, VagaDto } from './job.dto';

/**
 * O que os dois motores de IA compartilham: a instrucao, o schema e a
 * normalizacao.
 *
 * Anthropic e OpenAI tem APIs diferentes (`messages.create` com
 * `output_config` contra `responses.create` com `text.format`), mas o que se
 * pede a elas e identico — e as defesas depois tambem precisam ser. Duplicar
 * isso seria garantir que uma das copias fica para tras.
 */

export const INSTRUCAO_BUSCA = `Voce procura vagas de emprego reais e abertas usando a busca na web.

REGRAS QUE NAO SE NEGOCIAM:

1. **Toda vaga vem de um resultado de busca.** Se voce nao buscou, nao existe.
   Nunca liste uma vaga de memoria: vaga abre e fecha em dias, e o que voce
   lembra do treino ja venceu.

2. **URL e copiada, nunca montada.** Se a busca nao devolveu a URL, a vaga
   nao entra. Montar "job-boards.greenhouse.io/<empresa>/jobs/<numero>" a
   partir do padrao produz link que da 404 e parece verdadeiro.

3. **Salario so com o trecho que o prova.** Sem o texto do anuncio, os campos
   de salario ficam null. Nao converta valor por hora em anual.

4. **Elegibilidade so com citacao.** Se a pagina nao fala de contratar no
   pais nenhum, paisesElegiveis e null — nunca lista vazia. Dizer a alguem
   que uma empresa nao o contrataria, sem base, e o pior erro possivel aqui.

5. **Pagina de listagem nao e vaga.** "140 results", "903 positions" e um
   indice, nao um anuncio: marque ehVaga: false.

Prefira greenhouse.io, lever.co e ashbyhq.com — nesses a URL indexada e o
proprio anuncio. Devolva ate 15 vagas. Menos vagas verdadeiras vale mais que
muitas duvidosas.`;

/** O mesmo formato de vaga do Firecrawl: a tela nao sabe qual motor rodou. */
export const SCHEMA_BUSCA = {
  type: 'object',
  properties: {
    vagas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          url: {
            type: 'string',
            description:
              'A URL EXATA que apareceu na busca. Nunca monte uma URL a ' +
              'partir de um padrao: id de vaga e opaco, e uma URL inventada ' +
              'parece valida e da 404.',
          },
          local: { type: ['string', 'null'] },
          skills: { type: 'array', items: { type: 'string' } },
          salaryMin: { type: ['integer', 'null'] },
          salaryMax: { type: ['integer', 'null'] },
          currency: { type: ['string', 'null'] },
          salaryTrecho: {
            type: ['string', 'null'],
            description:
              'O TEXTO EXATO do anuncio que mostra o salario. Sem ele, ' +
              'salaryMin e salaryMax ficam null.',
          },
          paisesElegiveis: {
            type: ['array', 'null'],
            items: { type: 'string' },
            description:
              'De ONDE a vaga aceita candidato, como o anuncio escreveu ' +
              '("Brazil", "LATAM", "United States"). null se a pagina nao ' +
              'disser — "nao disse" NAO e "nao aceita". Nunca lista vazia.',
          },
          elegivelGlobal: {
            type: 'boolean',
            description:
              'true so quando o anuncio diz que aceita de QUALQUER lugar ' +
              '("worldwide", "anywhere", "fully remote, global").',
          },
          elegibilidadeTrecho: {
            type: ['string', 'null'],
            description: 'O TEXTO EXATO que sustenta paisesElegiveis.',
          },
          ehVaga: {
            type: 'boolean',
            description:
              'false se for pagina de listagem/busca em vez de UM anuncio.',
          },
        },
        // A OpenAI EXIGE `additionalProperties: false` em todo objeto do
        // schema (400 sem isso, medido em 18/08/2026); a Anthropic aceita os
        // dois jeitos. Fechar o objeto serve aos dois e ainda evita campo
        // extra inventado.
        additionalProperties: false,
        // `strict` da OpenAI exige que TODA propriedade esteja em `required`;
        // o que pode faltar e declarado como `['tipo', 'null']` la em cima.
        required: [
          'title',
          'company',
          'url',
          'local',
          'skills',
          'salaryMin',
          'salaryMax',
          'currency',
          'salaryTrecho',
          'paisesElegiveis',
          'elegivelGlobal',
          'elegibilidadeTrecho',
          'ehVaga',
        ],
      },
    },
  },
  required: ['vagas'],
  additionalProperties: false,
} as const;

const INSTRUCAO = `Voce procura vagas de emprego reais e abertas usando a busca na web.

REGRAS QUE NAO SE NEGOCIAM:

1. **Toda vaga vem de um resultado de busca.** Se voce nao buscou, nao existe.
   Nunca liste uma vaga de memoria: vaga abre e fecha em dias, e o que voce
   lembra do treino ja venceu.

2. **URL e copiada, nunca montada.** Se a busca nao devolveu a URL, a vaga
   nao entra. Montar "job-boards.greenhouse.io/<empresa>/jobs/<numero>" a
   partir do padrao produz link que da 404 e parece verdadeiro.

3. **Salario so com o trecho que o prova.** Sem o texto do anuncio, os campos
   de salario ficam null. Nao converta valor por hora em anual.

4. **Elegibilidade so com citacao.** Se a pagina nao fala de contratar no
   pais nenhum, paisesElegiveis e null — nunca lista vazia. Dizer a alguem
   que uma empresa nao o contrataria, sem base, e o pior erro possivel aqui.

5. **Pagina de listagem nao e vaga.** "140 results", "903 positions" e um
   indice, nao um anuncio: marque ehVaga: false.

Prefira greenhouse.io, lever.co e ashbyhq.com — nesses a URL indexada e o
proprio anuncio. Devolva ate 15 vagas. Menos vagas verdadeiras vale mais que
muitas duvidosas.`;


/** O pedido em prosa, a partir dos mesmos filtros que a tela ja manda. */
export function descreverPedido(f: FiltrosDto, consulta: string): string {
  const linhas = [`Procure vagas para esta consulta: ${consulta}`, ''];
  if (f.job_titles?.length) linhas.push(`Cargos: ${f.job_titles.join(', ')}`);
  if (f.seniority) linhas.push(`Senioridade: ${f.seniority}`);
  if (f.technologies?.length) linhas.push(`Tecnologias: ${f.technologies.join(', ')}`);
  if (f.regiao === 'latam') {
    linhas.push(
      'Regiao: America Latina. Vale vaga que aceite candidato no Brasil, ' +
        'na LATAM, ou "Americas time zones".',
    );
  }
  if (f.locations?.length) linhas.push(`Locais: ${f.locations.join(', ')}`);
  if (f.remote === 'remoto') linhas.push('Somente remoto.');
  if (f.salary_min) linhas.push(`Salario minimo anual: ${f.salary_min}.`);
  return linhas.join('\n');
}

/**
 * A saida da IA vira `VagaDto`, com as mesmas defesas do motor do Firecrawl.
 *
 * Nao e paranoia duplicada: o schema obriga o formato, nao a verdade. Um
 * modelo pode devolver `ehVaga: true` numa pagina de listagem, ou salario sem
 * trecho — e ai a defesa aqui e a ultima que existe.
 */
export function normalizar(v: Record<string, unknown>): VagaDto | null {
  const url = texto(v.url);
  const title = texto(v.title);
  const company = texto(v.company);
  if (!url || !title || !company) return null;
  // URL tem de ser http(s) de verdade: o modelo as vezes devolve caminho solto.
  if (!/^https?:\/\/\S+$/i.test(url)) return null;
  if (v.ehVaga === false) return null;

  const trechoSal = texto(v.salaryTrecho);
  const comSal = trechoSal !== null;
  const trechoEleg = texto(v.elegibilidadeTrecho);

  return {
    id: url,
    title,
    company,
    url,
    fonte: dominio(url),
    local: texto(v.local),
    regime: null,
    skills: Array.isArray(v.skills) ? v.skills.filter((s): s is string => typeof s === 'string') : [],
    area: null,
    anosExp: null,
    benefits: [],
    degree: null,
    logoUrl: null,
    paisIso: null,
    // Sem trecho, sem numero — a mesma regra do JOB-09.
    salaryMin: comSal ? inteiro(v.salaryMin) : null,
    salaryMax: comSal ? inteiro(v.salaryMax) : null,
    currency: comSal ? (texto(v.currency)?.toUpperCase().slice(0, 3) ?? null) : null,
    salaryTrecho: trechoSal,
    // Afirmacao de elegibilidade exige citacao. "Nao disse" nao e "nao aceita".
    paisesElegiveis:
      trechoEleg && Array.isArray(v.paisesElegiveis) && v.paisesElegiveis.length > 0
        ? v.paisesElegiveis.filter((p): p is string => typeof p === 'string')
        : null,
    elegivelGlobal: trechoEleg ? v.elegivelGlobal === true : false,
    elegibilidadeTrecho: trechoEleg,
    postedAt: null,
    foundAt: new Date().toISOString(),
  };
}

function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function inteiro(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
