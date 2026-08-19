import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lerElegibilidade } from './elegibilidade';
import type { FiltrosDto, VagaDto } from './job.dto';

/**
 * A busca direto na fonte: as APIs de ATS.
 *
 * **ATS e o sistema onde a EMPRESA publica a vaga** — Greenhouse, Lever,
 * Ashby. Quando alguem clica em "Apply" no site da Pinterest, vai parar em
 * `job-boards.greenhouse.io/pinterest/jobs/4902175`. E a fonte primaria: a
 * vaga nasce ali antes de ser agregada em qualquer lugar.
 *
 * Medido em 18/08/2026, e a diferenca nao e de eficiencia, e de ordem de
 * grandeza:
 *
 * | Motor     | Vagas  | Custo        |
 * | --------- | -----: | ------------ |
 * | Firecrawl |      7 | 42 creditos  |
 * | IA        |     15 | US$ 0,04     |
 * | **ATS**   | 27.725 | **R$ 0**     |
 *
 * As APIs sao publicas e sem chave. O que elas NAO tem e busca global — nao
 * existe `greenhouse.io/search?q=backend` (404, verificado). Por isso o
 * catalogo de `empresas.json` e indispensavel: sem o slug, a API e inutil.
 *
 * O que este motor **nao** faz e dizer se a vaga aceita quem mora no Brasil.
 * Isso e o JOB-21: 86% se resolve pelo campo `location`, e o resto precisa de
 * IA. Aqui a vaga sai com `elegivelBrasil: null` — ausencia honesta, que a
 * tela ja sabe mostrar como "not stated".
 */

/** Uma empresa do catalogo, como `empresas.json` guarda. */
interface Empresa {
  nome: string;
  ats: string;
  slug: string;
  /** Paises emergentes que a empresa alcanca. Vazio quando nao se sabe. */
  contrataEm: string[];
}

/**
 * Quantas empresas consultar ao mesmo tempo.
 *
 * Medido: 545 empresas com concorrencia 20 e 40 nao tomaram um 429 sequer em
 * ~700 requisicoes. Mas "nao achei o teto" nao e "nao existe teto", e estas
 * APIs sao um favor que os ATS fazem — 20 e educado e ja da 30 empresas em
 * 15s.
 */
const CONCORRENCIA = 25;

/** Quantas empresas no maximo por busca. Acima disso o tempo incomoda. */
const TETO_EMPRESAS = 200;

/**
 * Teto de vagas por empresa no resultado.
 *
 * Medido em 19/08: sem isto, a primeira busca voltou com 18 das 29 vagas na
 * GitLab, que tem 199 anuncios abertos. Uma tela dominada por uma empresa
 * parece catalogo dela, nao busca — e a segunda pagina de resultados de um
 * mesmo empregador raramente e o que a pessoa quer ver.
 */
const TETO_POR_EMPRESA = 4;

/** Uma empresa que demora mais que isso nao vale segurar a busca inteira. */
const TIMEOUT_MS = 12_000;

@Injectable()
export class BuscaAtsService {
  private readonly log = new Logger(BuscaAtsService.name);
  private catalogo: Empresa[] | null = null;

  /**
   * O motor existe se o catalogo existe.
   *
   * Nao ha chave a checar — estas APIs sao abertas. O unico jeito de este
   * motor nao funcionar e o arquivo faltar na imagem.
   */
  async disponivel(): Promise<boolean> {
    return (await this.empresas()).length > 0;
  }

  /**
   * Varre o catalogo e devolve as vagas que casam com os filtros.
   *
   * A filtragem e feita AQUI, e nao pela API: os ATS nao aceitam busca por
   * cargo ou tecnologia, so devolvem o board inteiro da empresa. Entao vem
   * tudo e a peneira e local — o que e barato, porque o custo ja foi pago no
   * request.
   */
  async buscar(filtros: FiltrosDto): Promise<VagaDto[]> {
    const todas = await this.empresas();
    if (todas.length === 0) {
      this.log.warn('catalogo de empresas vazio — o motor ATS nao roda');
      return [];
    }

    const alvo = this.escolher(todas, filtros);
    this.log.log(`consultando ${alvo.length} empresas de ${todas.length}`);

    const vagas: VagaDto[] = [];
    for (let i = 0; i < alvo.length; i += CONCORRENCIA) {
      const lote = alvo.slice(i, i + CONCORRENCIA);
      const prontas = await Promise.all(
        lote.map((e) =>
          this.daEmpresa(e).catch((err) => {
            // Slug morto e o caso NORMAL, nao erro: o catalogo e de julho, e
            // board fecha. Por isso `debug` e nao `warn` — um log por empresa
            // morta afogaria o que importa.
            this.log.debug(`${e.nome} (${e.ats}): ${String(err).slice(0, 90)}`);
            return [];
          }),
        ),
      );
      for (const lista of prontas) vagas.push(...lista);
    }

    return this.peneirar(vagas, filtros).map((v) => comElegibilidade(v));
  }

  /**
   * Quais empresas consultar.
   *
   * Prioriza quem contrata em pais emergente — e o publico do produto, e sem
   * isso as 60 primeiras seriam alfabeticas, o que nao quer dizer nada.
   */
  private escolher(todas: Empresa[], filtros: FiltrosDto): Empresa[] {
    const querLatam = filtros.regiao === 'latam';
    const ordenadas = querLatam
      ? [...todas].sort((a, b) => b.contrataEm.length - a.contrataEm.length)
      : todas;

    // Intercala os tres ATS em vez de cortar o topo da lista.
    //
    // O catalogo esta em ordem alfabetica, entao `slice(0, 60)` pegava quase
    // so greenhouse — foi o que a primeira busca mostrou: 19 das 29 vagas de
    // um ATS so. Intercalar da as tres fontes em qualquer teto.
    const porAts = new Map<string, Empresa[]>();
    for (const e of ordenadas) {
      const fila = porAts.get(e.ats);
      if (fila) fila.push(e);
      else porAts.set(e.ats, [e]);
    }

    const filas = [...porAts.values()];
    const escolhidas: Empresa[] = [];
    for (let i = 0; escolhidas.length < TETO_EMPRESAS; i++) {
      let achou = false;
      for (const fila of filas) {
        if (i >= fila.length) continue;
        escolhidas.push(fila[i]);
        achou = true;
        if (escolhidas.length >= TETO_EMPRESAS) break;
      }
      if (!achou) break;
    }
    return escolhidas;
  }

  private async daEmpresa(e: Empresa): Promise<VagaDto[]> {
    switch (e.ats) {
      case 'greenhouse':
        return this.greenhouse(e);
      case 'ashby':
        return this.ashby(e);
      case 'lever':
        return this.lever(e);
      default:
        return [];
    }
  }

  private async greenhouse(e: Empresa): Promise<VagaDto[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${e.slug}/jobs?content=true`;
    const dados = await this.pegar<{ jobs?: GreenhouseVaga[] }>(url);
    return (dados.jobs ?? []).map((j) => ({
      ...vagaVazia(),
      id: j.absolute_url ?? `gh:${e.slug}:${j.id}`,
      title: texto(j.title) ?? '',
      company: texto(j.company_name) ?? e.nome,
      url: texto(j.absolute_url) ?? '',
      local: texto(j.location?.name),
      fonte: 'greenhouse.io',
      // `first_published` e a data real de publicacao; `updated_at` muda a
      // cada edicao do anuncio e faria vaga antiga parecer nova.
      postedAt: iso(j.first_published ?? j.updated_at),
      foundAt: new Date().toISOString(),
    }));
  }

  private async ashby(e: Empresa): Promise<VagaDto[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${e.slug}?includeCompensation=true`;
    const dados = await this.pegar<{ jobs?: AshbyVaga[] }>(url);
    return (dados.jobs ?? [])
      // `isListed: false` e vaga que a empresa tirou do ar mas nao apagou.
      .filter((j) => j.isListed !== false)
      .map((j) => {
        const faixa = texto(j.compensation?.compensationTierSummary);
        return {
          ...vagaVazia(),
          id: texto(j.jobUrl) ?? `ashby:${e.slug}:${j.id}`,
          title: texto(j.title) ?? '',
          company: e.nome,
          url: texto(j.jobUrl) ?? texto(j.applyUrl) ?? '',
          local: texto(j.location),
          fonte: 'ashbyhq.com',
          regime: j.isRemote === true ? 'remoto' : null,
          // A faixa vem PRONTA da API ("$211.4K – $290.6K • Offers Equity").
          // E o oposto do JOB-09: aqui o salario e campo, nao uma citacao que
          // precisa ser conferida — por isso o trecho e a propria string.
          salaryTrecho: faixa,
          ...faixaSalarial(faixa),
          postedAt: iso(j.publishedAt),
          foundAt: new Date().toISOString(),
        };
      });
  }

  private async lever(e: Empresa): Promise<VagaDto[]> {
    const url = `https://api.lever.co/v0/postings/${e.slug}?mode=json`;
    const dados = await this.pegar<LeverVaga[]>(url);
    if (!Array.isArray(dados)) return [];
    return dados.map((j) => ({
      ...vagaVazia(),
      id: texto(j.hostedUrl) ?? `lever:${e.slug}:${j.id}`,
      title: texto(j.text) ?? '',
      company: e.nome,
      url: texto(j.hostedUrl) ?? '',
      local: texto(j.categories?.location),
      fonte: 'lever.co',
      regime: j.workplaceType === 'remote' ? 'remoto' : null,
      // Epoch em milissegundos, nao ISO.
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      foundAt: new Date().toISOString(),
    }));
  }

  /**
   * A peneira local.
   *
   * Os ATS devolvem o board inteiro — nao ha como pedir "so backend" na URL.
   * Filtrar aqui e barato: o request ja foi pago.
   */
  private peneirar(vagas: VagaDto[], f: FiltrosDto): VagaDto[] {
    const cargos = (f.job_titles ?? []).map((s) => s.toLowerCase());
    const techs = (f.technologies ?? []).map((s) => s.toLowerCase());
    const senioridade = f.seniority?.toLowerCase();

    const vistos = new Set<string>();
    const porEmpresa = new Map<string, number>();
    const aprovadas = vagas.filter((v) => {
      if (!v.title || !v.url) return false;
      // A mesma vaga pode vir duas vezes se a empresa estiver no catalogo com
      // dois ATS. `id` e a URL, entao serve de chave.
      if (vistos.has(v.id)) return false;

      const alvo = `${v.title} ${v.local ?? ''}`.toLowerCase();
      if (cargos.length && !cargos.some((c) => casaCargo(alvo, c))) return false;
      if (senioridade && !casaSenioridade(alvo, senioridade)) return false;

      // **Tecnologia NAO exclui.**
      //
      // Os ATS so devolvem titulo e local — a descricao viria em outro
      // request por vaga. E "Senior Backend Engineer" nao escreve "Java" no
      // titulo mesmo pedindo Spring Boot na descricao. Medido em 19/08:
      // filtrar por Java derrubava de 42 vagas para 5, jogando fora as
      // certas junto com as erradas.
      //
      // Entao a tecnologia so ORDENA: quem cita no titulo sobe. Vale mais
      // mostrar 42 com as de Java em cima que 5 e esconder o resto.
      //
      // MAS: sem nenhum filtro de cargo, "remoto" sozinho devolve o board
      // inteiro — 300 vagas de Account Executive e Accounting Manager. Se a
      // pessoa nao disse o cargo, a tecnologia passa a ser o unico sinal do
      // que ela procura, e ai ela precisa filtrar. Foi o que a busca de
      // 19/08 mostrou ao tirar o filtro sem por nada no lugar.
      if (cargos.length === 0 && techs.length > 0) {
        const ehTech = techs.some((t) => alvo.includes(t)) || AREA_TECH.test(alvo);
        if (!ehTech) return false;
      }

      // **Remoto exige saber de ONDE.**
      //
      // Medido em 19/08: a Binance marca `workplaceType: 'remote'` com
      // `location: 'Hong Kong'` — remoto de la, nao de qualquer lugar. Ler so
      // o booleano trazia vaga presencial em Budapeste para quem pediu
      // remoto. Agora o local precisa ser compativel com trabalho a
      // distancia de fora.
      if (f.remote === 'remoto' && !remotoDeVerdade(v)) return false;

      // Uma empresa grande nao pode ocupar a tela inteira.
      const quantas = porEmpresa.get(v.company) ?? 0;
      if (quantas >= TETO_POR_EMPRESA) return false;
      porEmpresa.set(v.company, quantas + 1);

      vistos.add(v.id);
      return true;
    });

    // Quem cita a tecnologia pedida no titulo vai para cima.
    if (techs.length === 0) return aprovadas;
    return [...aprovadas].sort((a, b) => {
      const pa = techs.some((t) => a.title.toLowerCase().includes(t)) ? 0 : 1;
      const pb = techs.some((t) => b.title.toLowerCase().includes(t)) ? 0 : 1;
      return pa - pb;
    });
  }

  private async pegar<T>(url: string): Promise<T> {
    const corte = AbortSignal.timeout(TIMEOUT_MS);
    const resp = await fetch(url, {
      signal: corte,
      headers: { accept: 'application/json' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as T;
  }

  /** O catalogo, lido do disco uma vez e guardado. */
  private async empresas(): Promise<Empresa[]> {
    if (this.catalogo) return this.catalogo;
    try {
      // `process.cwd()` e a raiz do backend tanto em dev quanto no contêiner.
      const caminho = join(process.cwd(), 'data', 'ats', 'empresas.json');
      const cru = await readFile(caminho, 'utf8');
      this.catalogo = JSON.parse(cru) as Empresa[];
      this.log.log(`catalogo carregado: ${this.catalogo.length} empresas`);
    } catch (e) {
      this.log.error(`nao consegui ler o catalogo: ${String(e).slice(0, 160)}`);
      this.catalogo = [];
    }
    return this.catalogo;
  }
}

// --- formas cruas de cada API -------------------------------------------

interface GreenhouseVaga {
  id?: number;
  title?: string;
  company_name?: string;
  absolute_url?: string;
  location?: { name?: string };
  updated_at?: string;
  first_published?: string;
}

interface AshbyVaga {
  id?: string;
  title?: string;
  jobUrl?: string;
  applyUrl?: string;
  location?: string;
  isRemote?: boolean;
  isListed?: boolean;
  publishedAt?: string;
  compensation?: { compensationTierSummary?: string };
}

interface LeverVaga {
  id?: string;
  text?: string;
  hostedUrl?: string;
  workplaceType?: string;
  createdAt?: number;
  categories?: { location?: string };
}

// --- ajudantes ------------------------------------------------------------

/**
 * O molde de uma vaga sem nada preenchido.
 *
 * Existe para o motor nao ter de repetir vinte `null` em cada mapeamento —
 * e, mais importante, para campo novo no DTO nao virar `undefined` silencioso
 * em tres lugares diferentes.
 */
function vagaVazia(): VagaDto {
  return {
    id: '',
    title: '',
    company: '',
    url: '',
    local: null,
    fonte: null,
    regime: null,
    skills: [],
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
    // A API nao diz se aceita quem mora no Brasil. `null` e a resposta
    // honesta, e a tela ja escreve "not stated" — ver JOB-21.
    elegivelBrasil: null,
    elegibilidadeTrecho: null,
    postedAt: null,
    foundAt: new Date().toISOString(),
  };
}

/**
 * "$211.4K – $290.6K • Offers Equity" vira 211400 e 290600.
 *
 * So aceita o que consegue ler inteiro: sem dois numeros, os dois campos ficam
 * `null`. A regra do JOB-09 continua valendo mesmo com o dado vindo de campo —
 * meio salario na tela e pior que nenhum.
 */
function faixaSalarial(resumo: string | null): {
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
} {
  const vazio = { salaryMin: null, salaryMax: null, currency: null };
  if (!resumo) return vazio;

  const numeros = [...resumo.matchAll(/\$?\s*([\d.,]+)\s*([KkMm])?/g)]
    .map((m) => {
      const base = Number(m[1].replace(/,/g, ''));
      if (!Number.isFinite(base)) return null;
      const escala = m[2]?.toLowerCase();
      if (escala === 'k') return Math.round(base * 1_000);
      if (escala === 'm') return Math.round(base * 1_000_000);
      return Math.round(base);
    })
    .filter((n): n is number => n !== null && n > 1_000);

  if (numeros.length < 2) return vazio;
  const [min, max] = [numeros[0], numeros[1]];
  if (min > max) return vazio;
  return {
    salaryMin: min,
    salaryMax: max,
    currency: resumo.includes('€') ? 'EUR' : resumo.includes('£') ? 'GBP' : 'USD',
  };
}

/**
 * O cargo pedido aparece no titulo?
 *
 * Compara palavra a palavra em vez de substring: "Backend Engineer" tem de
 * casar com "Senior Backend Engineer, Payments", e `includes` nao casaria.
 */
function casaCargo(alvo: string, cargo: string): boolean {
  const palavras = cargo.split(/\s+/).filter((p) => p.length > 2);
  if (palavras.length === 0) return false;
  return palavras.every((p) => alvo.includes(p));
}

/**
 * Cargos de tecnologia, para quando a pessoa so escolheu a stack.
 *
 * Sem isto, pedir "Java + remoto" sem dizer o cargo devolve o board inteiro
 * da empresa — vendas, financeiro, design. A lista e larga de proposito: o
 * objetivo e separar tecnologia do resto, nao adivinhar a especialidade.
 */
const AREA_TECH =
  /\b(engineer|engineering|developer|dev\b|programmer|architect|sre|devops|data scien|machine learning|ml\b|backend|back-end|frontend|front-end|full.?stack|mobile|ios|android|qa\b|tester|security|infrastructure|platform|technical lead|tech lead|cto)\b/i;

/** Os sinonimos que os anuncios usam para cada nivel. */
const SENIORIDADE: Record<string, string[]> = {
  estagio: ['intern', 'internship', 'estagio'],
  junior: ['junior', 'jr.', 'entry level', 'i)', ' i '],
  pleno: ['mid', 'pleno', 'ii)', ' ii '],
  senior: ['senior', 'sr.', 'sr '],
  staff: ['staff'],
  principal: ['principal', 'lead', 'head of'],
};

function casaSenioridade(alvo: string, nivel: string): boolean {
  const termos = SENIORIDADE[nivel];
  if (!termos) return true;
  return termos.some((t) => alvo.includes(t));
}

/**
 * A vaga e remota PARA QUEM ESTA FORA?
 *
 * Nao basta o campo dizer "remote". Medido em 19/08: a Binance marca
 * `workplaceType: 'remote'` com `location: 'Hong Kong'`, e a Hawkeye com
 * `'Hungary, Budapest'` — e remoto para quem ja mora la, nao para o mundo.
 * Ler so o booleano enchia a lista de vaga presencial em resposta a "remoto".
 *
 * A regra: o campo diz remoto **e** o local nao amarra a uma cidade. Cidade
 * nomeada e endereco de escritorio; pais ou regiao ainda pode ser remoto de
 * dentro daquele pais, e o JOB-22 vai deixar a pessoa escolher.
 */
function remotoDeVerdade(v: VagaDto): boolean {
  const local = (v.local ?? '').trim();
  const dizRemoto = v.regime === 'remoto' || /\bremote|remoto\b/i.test(local);
  if (!dizRemoto) return false;
  if (!local) return true;
  // Cidade no local = escritorio. "Hungary, Budapest" e "Hong Kong" caem
  // aqui; "Remote, Canada" e "Remote" nao.
  return !temCidade(local);
}

/**
 * O local nomeia uma cidade?
 *
 * Heuristica deliberadamente simples: se sobra algo depois de tirar as
 * palavras de regime e o local tem virgula com duas partes, ou casa com uma
 * cidade conhecida, e endereco. Errar para o lado de excluir e melhor —
 * mostrar vaga presencial para quem pediu remoto e o que incomodou.
 */
const CIDADES = /\b(budapest|basingstoke|hong kong|taipei|singapore|london|berlin|paris|amsterdam|dublin|madrid|barcelona|lisbon|warsaw|bucharest|belgrade|tel aviv|bangalore|mumbai|delhi|tokyo|seoul|sydney|melbourne|toronto|vancouver|new york|san francisco|seattle|austin|chicago|boston|denver|atlanta|miami|los angeles|sao paulo|são paulo|rio de janeiro|mexico city|bogota|buenos aires|santiago)\b/i;

function temCidade(local: string): boolean {
  if (CIDADES.test(local)) return true;
  // "Hungary, Budapest" — duas partes com virgula, sem a palavra remote na
  // segunda, e endereco.
  const partes = local.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  if (partes.length >= 2 && !partes.some((p) => /remote|remoto/i.test(p))) {
    return true;
  }
  return false;
}

/**
 * Preenche a elegibilidade a partir do que a vaga ja traz.
 *
 * Medido em 19/08 sobre as 45 vagas reais: **95,6% se resolve pelo campo**, e
 * so 4,4% precisam de IA. E o que torna o custo viavel — ler as 45 com IA
 * custaria 20x mais para acertar o mesmo.
 *
 * O trecho e o proprio `location`: aqui a afirmacao vem de um campo que a
 * empresa preencheu, e nao de uma frase interpretada no meio da descricao. A
 * regra do JOB-09 continua valendo — sem trecho, sem afirmacao.
 */
function comElegibilidade(v: VagaDto): VagaDto {
  const e = lerElegibilidade(v);
  if (e.precisaLer) return v;
  return {
    ...v,
    // `paisesElegiveis` ainda nao existe no DTO (e o JOB-22). Ate la, o
    // booleano responde a pergunta de hoje: aceita quem mora no Brasil?
    elegivelBrasil: e.global
      ? true
      : e.paises?.some((p) => /brazil|brasil|latam|latin america|south america/i.test(p)) ?? null,
    elegibilidadeTrecho: e.trecho,
  };
}

function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function iso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
