import { Injectable, Logger } from '@nestjs/common';
import { lerElegibilidade } from './elegibilidade';
import {
  BASE_FREEHIRE,
  UA_FREEHIRE,
  paraConsultaFreehire,
} from './freehire-consulta';
import type { FiltrosDto, VagaDto } from './job.dto';

/**
 * A busca no agregador: a API publica do freehire.me.
 *
 * **O que este motor resolve e o teto do motor de ATS.** Aquele so enxerga
 * empresa que ja esta no `empresas.json` — sao 526, e empresa fora do catalogo
 * e invisivel por melhor que a vaga seja, porque nao existe
 * `greenhouse.io/search?q=backend` (404, verificado). O freehire ja rastreou os
 * career boards e publica o resultado com busca de verdade.
 *
 * Medido em 26/08/2026, sem chave e sem cadastro:
 *
 * | Consulta                          |     Vagas |
 * | --------------------------------- | --------: |
 * | `countries=br`                    |    16.891 |
 * | `regions=latam`                   |    49.772 |
 * | catalogo inteiro (controle)       | 1.358.282 |
 *
 * E o numero que decidiu o card: nas 100 primeiras vagas de `countries=br`
 * havia **63 empresas distintas, e 60 fora do nosso catalogo**. So `ciandt`,
 * `clara` e `quintoandar` coincidiam.
 *
 * **Nao e codigo nosso, e servico de terceiro.** Gratis, sem SLA, sem contrato
 * — pode fechar, cobrar ou mudar o schema sem aviso. Dai este motor ser
 * ADICIONAL e ter interruptor proprio: se ele sumir, o de ATS continua
 * entregando as 27.725 vagas do catalogo, e a busca fica pior sem morrer.
 *
 * O uso e o que o servico pede, e nao uma brecha: o `robots.txt` deles diz
 * "you do not have to scrape these pages... the whole catalogue is a public,
 * unauthenticated JSON API", e os termos proibem so o contrario disso
 * ("no scraping beyond our documented API, no attempting to bypass rate
 * limits"). O projeto e MIT (github.com/strelov1/freehire), sem clausula
 * nao-comercial.
 */

/** O que a API devolve, dos campos que lemos. A resposta carrega mais. */
interface VagaFreehire {
  public_slug?: unknown;
  url?: unknown;
  title?: unknown;
  company?: unknown;
  company_slug?: unknown;
  location?: unknown;
  description?: unknown;
  skills?: unknown;
  work_mode?: unknown;
  regions?: unknown;
  countries?: unknown;
  posted_at?: unknown;
  source?: unknown;
  enrichment?: {
    seniority?: unknown;
    category?: unknown;
    employment_type?: unknown;
    salary_min?: unknown;
    salary_max?: unknown;
    salary_currency?: unknown;
  };
}

/** O envelope de toda resposta: `{data, meta, error}`. */
interface Envelope {
  data?: unknown;
  meta?: {
    total?: unknown;
    /**
     * Os parametros que NENHUM filtro leu.
     *
     * O campo mais importante da resposta inteira — ver `checarIgnorados`.
     */
    ignored_params?: unknown;
  };
  error?: unknown;
}

/**
 * Quantas vagas pedir por chamada.
 *
 * O teto da API e maior, mas 60 e o que a tela consome sem rolar por minutos.
 * O `/agent/jobs/search` traz a descricao inteira junto, entao **uma chamada
 * basta** — nao ha um fetch por anuncio como no Firecrawl.
 */
const LIMITE = 60;

/** Quanto esperar por resposta antes de desistir e deixar os outros motores. */
const TIMEOUT_MS = 20_000;

@Injectable()
export class BuscaFreehireService {
  private readonly log = new Logger(BuscaFreehireService.name);

  async buscar(filtros: FiltrosDto): Promise<VagaDto[]> {
    const params = this.montar(filtros);

    // `/agent/jobs/search` e nao `/jobs/search`: o primeiro hidrata a
    // descricao INTEIRA de cada resultado, o segundo devolve o preview
    // truncado do indice. Uma listagem com corpos e uma requisicao so.
    const envelope = await this.pedir(`/api/v1/agent/jobs/search?${params}`);
    if (!envelope) return [];

    this.checarIgnorados(envelope, params);

    const linhas = Array.isArray(envelope.data) ? (envelope.data as VagaFreehire[]) : [];
    const total = numero(envelope.meta?.total);
    this.log.log(
      `freehire devolveu ${linhas.length} vagas` +
        (total === null ? '' : ` de ${total} no filtro`),
    );

    const vagas = linhas.map((l) => this.converter(l)).filter((v): v is VagaDto => v !== null);
    return this.peneirar(vagas, filtros).map(comElegibilidade);
  }

  /**
   * A consulta, montada pelo modulo compartilhado.
   *
   * **Nao ha traducao propria aqui, e isso e o ponto.** O `FacetasService`
   * usa a MESMA funcao para pedir as contagens do modal (JOB-41): se as duas
   * divergissem num parametro, o botao `Show 699 jobs` prometeria um numero
   * que esta lista nao entrega, e nenhum dos dois pareceria errado sozinho.
   */
  private montar(f: FiltrosDto): string {
    const p = new URLSearchParams(paraConsultaFreehire(f));
    p.set('limit', String(LIMITE));
    // Markdown preserva a estrutura do anuncio; `html` obrigaria a limpar tag
    // de novo do nosso lado. Valor nao reconhecido cai para `html` em SILENCIO
    // (documentado por eles), entao o valor aqui e literal e testado.
    p.set('description_format', 'markdown');
    return p.toString();
  }

  /**
   * A armadilha que o proprio servico documenta.
   *
   * > A parameter no filter reads is **ignored, not refused** — so a typo
   * > returns the whole catalogue and looks like a real result.
   *
   * Medido em 26/08: `paisinventado=xx` devolveu **1.358.310** vagas, o
   * catalogo inteiro, com status 200. Sem esta checagem, um filtro renomeado do
   * lado deles transformaria "vagas remotas na LATAM" em "todas as vagas do
   * mundo" — e a busca continuaria parecendo saudavel, so que mentindo.
   *
   * `warn` e nao excecao: a vaga que voltou ainda e vaga de verdade, e derrubar
   * a busca inteira seria pior que entregar resultado mais largo. O que nao
   * pode e passar despercebido.
   */
  private checarIgnorados(e: Envelope, enviado: string): void {
    const brutos = e.meta?.ignored_params;
    if (!Array.isArray(brutos) || brutos.length === 0) return;
    const nomes = brutos
      .map((x) =>
        typeof x === 'string'
          ? x
          : typeof (x as { param?: unknown })?.param === 'string'
            ? String((x as { param: string }).param)
            : null,
      )
      .filter((n): n is string => n !== null);
    if (nomes.length === 0) return;
    this.log.warn(
      `freehire IGNOROU o(s) filtro(s) [${nomes.join(', ')}] — o resultado e mais ` +
        `largo do que o pedido. Consulta enviada: ${enviado}`,
    );
  }

  /**
   * GET com backoff em 429/5xx.
   *
   * Falha de conexao **nao** repete: a API estar fora do ar nao e carga
   * transitoria, e insistir so penduraria a busca inteira. Degradar rapido
   * aqui e o que deixa os outros motores assumirem.
   */
  private async pedir(caminho: string): Promise<Envelope | null> {
    const url = `${BASE_FREEHIRE}${caminho}`;
    let espera = 500;

    for (let tentativa = 0; tentativa <= 3; tentativa++) {
      let r: Response;
      try {
        r = await fetch(url, {
          headers: { 'User-Agent': UA_FREEHIRE, Accept: 'application/json' },
          redirect: 'follow',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        this.log.warn(`freehire inalcancavel: ${String(e).slice(0, 120)}`);
        return null;
      }

      if (r.status === 429 || r.status >= 500) {
        if (tentativa === 3) {
          this.log.warn(`freehire respondeu ${r.status} apos 4 tentativas`);
          return null;
        }
        await pausa(espera + Math.floor(Math.random() * 300));
        espera = Math.min(espera * 2, 4000);
        continue;
      }

      // 404 aqui significa instancia sem o endpoint (um self-hosted antigo
      // atras de FREEHIRE_API_URL), e nao vaga inexistente.
      if (r.status === 404) {
        this.log.warn(`freehire nao tem o endpoint ${caminho} — instancia antiga?`);
        return null;
      }
      if (!r.ok) {
        this.log.warn(`freehire respondeu ${r.status}`);
        return null;
      }

      // O orcamento publicado e 300 req/min neste endpoint. Ler o header e a
      // regra deles ("read Remaining and pace yourself rather than waiting for
      // the 429"); uma busca gasta 1, entao so avisamos quando aperta.
      const resta = Number(r.headers.get('X-RateLimit-Remaining'));
      if (Number.isFinite(resta) && resta < 20) {
        this.log.warn(`freehire: restam ${resta} requisicoes na janela`);
      }

      const corpo = (await r.json().catch(() => null)) as Envelope | null;
      if (!corpo) {
        this.log.warn('freehire devolveu corpo ilegivel');
        return null;
      }
      return corpo;
    }
    return null;
  }

  /**
   * Converte uma vaga do freehire no nosso `VagaDto`.
   *
   * **`countries[]` NAO vira `paisesElegiveis`.** E a classificacao deles sobre
   * alcance de contratacao, feita por um pipeline que nao vemos, e o JOB-09
   * manda que a vaga so afirme o que cita. Medido em 26/08: das 40 primeiras de
   * `countries=br`, 7 listavam varios paises (`['ar','br','co','gt','mx']`) e
   * 6 nao tinham Brasil no `location` cru. Quem decide continua sendo o
   * `lerElegibilidade` sobre o campo que a empresa escreveu.
   */
  private converter(j: VagaFreehire): VagaDto | null {
    const title = texto(j.title);
    const url = texto(j.url);
    // Sem titulo ou sem link nao ha o que mostrar nem para onde mandar quem
    // clicar. Descartar e melhor que uma linha morta na tela.
    if (!title || !url) return null;

    const e = j.enrichment ?? {};
    const salaryMin = numero(e.salary_min);
    const salaryMax = numero(e.salary_max);

    return {
      id: texto(j.public_slug) ?? url,
      title,
      company: texto(j.company) ?? '(unknown)',
      url,
      local: texto(j.location),
      /**
       * O dominio de onde a vaga veio.
       *
       * **Nao e exibido na tela** (decisao de 26/08) — continua no DTO porque
       * o campo e do contrato e serve ao log e a quem depurar.
       *
       * O valor e o host da `url`, seja ele o board da empresa
       * (`jobs.lever.co`) ou um agregador (`br.whatjobs.com`), e nunca
       * "freehire.me".
       *
       * **Vaga de agregador ENTRA, e isso e deliberado.** Medido em 26/08: 36
       * das 60 vagas de uma busca vinham por `whatjobs.com`, e filtra-las
       * cortaria 60% do resultado. Elas nao sao piores — as 36 tinham skills,
       * local e elegibilidade completos, e 4 de 5 links abriram (200). O
       * controle e que decidiu: entre 4 links de ATS "direto", um deu 403 e
       * outro **404** (vaga morta no Lever). Link ruim nao e privilegio de
       * agregador, e descartar por origem trocaria 36 vagas boas por uma regra
       * que nem separa o que promete.
       */
      fonte: dominio(url),
      regime: regimeNosso(texto(j.work_mode)),
      skills: lista(j.skills),
      area: texto(e.category),
      // O nivel deles ("senior", "middle") nao e numero de anos, e converter
      // seria inventar. `anosExp` fica nulo — "not stated" na tela.
      anosExp: null,
      benefits: [],
      degree: null,
      logoUrl: null,
      paisIso: null,
      // **So passa salario com moeda.** Numero sem moeda na tela e pior que
      // "not stated": 90.000 pode ser BRL ou USD, e a diferenca e o produto
      // inteiro. Medido em 26/08: em LATAM a faixa vem quase sempre nula.
      salaryMin: e.salary_currency ? salaryMin : null,
      salaryMax: e.salary_currency ? salaryMax : null,
      currency: texto(e.salary_currency),
      // **Sem trecho, e de proposito.** O JOB-09 exige que o salario venha
      // acompanhado do texto exato de onde saiu; aqui ele vem de um campo
      // estruturado do agregador, nao de uma frase do anuncio. Preencher com
      // uma frase montada por nos seria exatamente a parafrase que o JOB-34
      // flagrou no Firecrawl.
      salaryTrecho: null,
      paisesElegiveis: null,
      elegivelGlobal: false,
      elegibilidadeTrecho: null,
      postedAt: iso(j.posted_at),
      foundAt: new Date().toISOString(),
    };
  }

  /**
   * O que a API nao filtrou, filtramos aqui.
   *
   * `exclude_keywords` e `locations` nao tem equivalente na consulta deles, e
   * mandar um nome parecido cairia na armadilha do `ignored_params`.
   */
  private peneirar(vagas: VagaDto[], f: FiltrosDto): VagaDto[] {
    const excluir = (f.exclude_keywords ?? [])
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);
    const locais = (f.locations ?? [])
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.length > 0);

    return vagas.filter((v) => {
      if (excluir.length > 0) {
        const texto = `${v.title} ${v.company} ${v.skills.join(' ')}`.toLowerCase();
        if (excluir.some((k) => texto.includes(k))) return false;
      }
      if (locais.length > 0) {
        const onde = (v.local ?? '').toLowerCase();
        if (!locais.some((l) => onde.includes(l))) return false;
      }
      return true;
    });
  }
}

/**
 * Preenche a elegibilidade pelo `location` cru, e nao pelo `countries[]`.
 *
 * A mesma funcao do motor de ATS, pelo mesmo motivo: a afirmacao tem de sair
 * de um campo que a EMPRESA preencheu. Ver a nota em `converter`.
 */
function comElegibilidade(v: VagaDto): VagaDto {
  const e = lerElegibilidade(v);
  if (e.precisaLer) return v;
  return {
    ...v,
    paisesElegiveis: e.paises,
    elegivelGlobal: e.global,
    elegibilidadeTrecho: e.trecho,
  };
}

/** O `work_mode` deles no vocabulario do nosso `VagaDto`. */
function regimeNosso(wm: string | null): string | null {
  switch (wm) {
    case 'remote':
      return 'remoto';
    case 'hybrid':
      return 'hibrido';
    case 'onsite':
      return 'presencial';
    default:
      return null;
  }
}

function dominio(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function iso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pausa(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
