import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decifrar } from '../settings/crypto';
import type { FiltrosDto, VagaDto } from './job.dto';

/**
 * A busca de vagas pela IA, sem Firecrawl.
 *
 * **A IA nao sabe vaga de cabeca — ela precisa procurar.** Medido em
 * 18/08/2026: perguntado por vagas abertas sem acesso a web, o modelo acertou
 * as cinco empresas (Dash0, Oscilar, Kadmos, Moniepoint, Pinterest) e nao
 * soube UMA vaga. Nem titulo, nem salario, nem URL. As palavras dele: "IDs de
 * vaga em Greenhouse/Lever/Ashby sao opacos e nao memorizaveis; eu produziria
 * uma URL bem formada que da 404".
 *
 * Por isso este servico usa a ferramenta `web_search`: quem procura e a IA, e
 * o resultado vem da web de agora — nao da memoria do treino, que fecha em
 * maio/2026 e ja esta tres meses atras.
 *
 * A diferenca para o `BuscaService`: la o Firecrawl abre cada pagina (5
 * creditos e ~36s cada, teto de 8 por causa do rate limit); aqui a IA busca e
 * le em uma chamada so. Sai mais barato e mais rapido, e entra menos fundo em
 * cada anuncio — o `web_search` traz trecho, nao a pagina inteira.
 */

/** O mesmo formato de vaga do Firecrawl: a tela nao sabe qual motor rodou. */
const SCHEMA = {
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
          elegivelBrasil: {
            type: ['boolean', 'null'],
            description:
              'Contrata quem mora no Brasil? null se a pagina nao disser. ' +
              '"Nao disse" NAO e "nao aceita".',
          },
          elegibilidadeTrecho: {
            type: ['string', 'null'],
            description: 'O TEXTO EXATO que sustenta elegivelBrasil.',
          },
          ehVaga: {
            type: 'boolean',
            description:
              'false se for pagina de listagem/busca em vez de UM anuncio.',
          },
        },
        required: ['title', 'company', 'url', 'ehVaga'],
      },
    },
  },
  required: ['vagas'],
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
   Brasil, elegivelBrasil e null — nao false. Dizer a alguem que uma empresa
   nao o contrataria, sem base, e o pior erro possivel aqui.

5. **Pagina de listagem nao e vaga.** "140 results", "903 positions" e um
   indice, nao um anuncio: marque ehVaga: false.

Prefira greenhouse.io, lever.co e ashbyhq.com — nesses a URL indexada e o
proprio anuncio. Devolva ate 15 vagas. Menos vagas verdadeiras vale mais que
muitas duvidosas.`;

@Injectable()
export class BuscaIaService {
  private readonly log = new Logger(BuscaIaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ha chave da Anthropic cadastrada? E o que decide se este motor existe. */
  async disponivel(): Promise<boolean> {
    return (await this.chave()) !== null;
  }

  async buscar(filtros: FiltrosDto, consulta: string): Promise<VagaDto[]> {
    const chave = await this.chave();
    if (!chave) return [];

    const client = new Anthropic({ apiKey: chave });
    const pedido = descreverPedido(filtros, consulta);

    let bruto: string;
    try {
      const resposta = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 8000,
        system: INSTRUCAO,
        // A busca na web e o que separa este servico de um gerador de ficcao.
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: pedido }],
      });

      // Refusal e 200 com content vazio: ler content[0] direto quebraria aqui.
      if (resposta.stop_reason === 'refusal') {
        this.log.warn('busca por IA recusada pelo modelo');
        return [];
      }

      const bloco = resposta.content.find((b) => b.type === 'text');
      if (!bloco || bloco.type !== 'text') return [];
      bruto = bloco.text;
    } catch (e) {
      this.log.error(`busca por IA falhou: ${String(e).slice(0, 300)}`);
      return [];
    }

    const lido = JSON.parse(bruto) as { vagas: Record<string, unknown>[] };
    return (lido.vagas ?? []).map((v) => normalizar(v)).filter((v): v is VagaDto => v !== null);
  }

  private async chave(): Promise<string | null> {
    const guardado = await this.prisma.apiToken.findFirst({
      where: { provider: ApiProvider.ANTHROPIC },
      select: { secret: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!guardado) return null;
    try {
      return decifrar(guardado.secret);
    } catch {
      this.log.error('token da Anthropic nao pode ser decifrado');
      return null;
    }
  }
}

/** O pedido em prosa, a partir dos mesmos filtros que a tela ja manda. */
function descreverPedido(f: FiltrosDto, consulta: string): string {
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
function normalizar(v: Record<string, unknown>): VagaDto | null {
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
    elegivelBrasil: trechoEleg && typeof v.elegivelBrasil === 'boolean' ? v.elegivelBrasil : null,
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
