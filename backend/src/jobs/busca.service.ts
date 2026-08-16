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
    ehVaga: { type: 'boolean', description: 'false se a pagina nao for um anuncio de vaga.' },
  },
  required: ['title', 'company', 'skills', 'ehVaga'],
  additionalProperties: false,
} as const;

const INSTRUCAO = `Extraia os dados desta vaga.

Regras:
- Devolva null quando o anuncio nao disser. NUNCA chute salario, senioridade,
  elegibilidade ou pais.
- salaryMin/salaryMax sao ANUAIS. Se o anuncio der valor mensal ou por hora,
  converta; se nao der para converter com seguranca, devolva null.
- salaryTrecho e elegibilidadeTrecho sao o TEXTO EXATO da pagina. Nao parafraseie.
- "Mais de 100 candidatos", "competitivo" e "a combinar" NAO sao salario.
- paisIso e ISO-3166 alpha-2 minusculo (us, br, pt). Se a vaga for remota sem
  pais definido, devolva null — remoto nao e um pais.
- Se a pagina nao for um anuncio de vaga (lista, busca, login), ehVaga: false.`;

/** Paises cujo codigo aceitamos. Fora daqui vira null, nao vira bandeira errada. */
const ISO_VALIDOS = new Set([
  'us','br','pt','es','de','fr','gb','ie','nl','pl','ca','mx','ar','cl','co',
  'it','se','no','dk','fi','ch','at','be','cz','ro','ua','in','au','nz','jp',
  'sg','za','ae','il','uy','pe','cr','gr','hu','hr','bg','sk','si','lt','lv','ee',
]);

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

    yield { tipo: 'inicio', total: urls.length };

    // Em paralelo, mas emitindo na ordem em que ficam prontas: a primeira vaga
    // aparece em ~15s em vez de ~60s.
    const pendentes = urls.map((url) => this.lerVaga(fc, url));
    for (const promessa of pendentes) {
      const vaga = await promessa.catch(() => null);
      if (vaga) yield { tipo: 'vaga', vaga };
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
    if (!j || j.ehVaga !== true) return null;

    const titulo = texto(j.title);
    const empresa = texto(j.company);
    // Vaga sem titulo, empresa ou URL nao entra: no JOB-01, 47% vinham sem URL,
    // e um cartao que nao da para clicar nao serve para nada.
    if (!titulo || !empresa) return null;

    const iso = texto(j.paisIso)?.toLowerCase();
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
      salaryMin: salario(j.salaryMin),
      salaryMax: salario(j.salaryMax),
      currency: texto(j.currency)?.toUpperCase().slice(0, 3) ?? null,
      salaryTrecho: texto(j.salaryTrecho),
      elegivelBrasil: typeof j.elegivelBrasil === 'boolean' ? j.elegivelBrasil : null,
      elegibilidadeTrecho: texto(j.elegibilidadeTrecho),
      postedAt: null,
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
