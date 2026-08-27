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
  porte?: Porte;
  /**
   * Pais-sede, quando conhecido.
   *
   * Mais confiavel que casar o nome da vaga contra `empresas-sede.yaml`: aqui
   * a associacao e com o SLUG, que e unico. O casamento por nome continua
   * como rede para empresa que nao esta no catalogo.
   */
  sede?: string;
}

/**
 * De que lado do mercado a empresa esta.
 *
 * Nao e sobre numero de funcionarios — e sobre COMO a empresa contrata, e a
 * diferenca foi medida em 19/08:
 *
 * | Origem                      | Vaga elegivel |
 * | --------------------------- | ------------: |
 * | curadoria (empresa conhecida) |  1 em 1.961 |
 * | slugs brutos do Ashby         |  144 em 1.229 |
 *
 * A empresa grande tem entidade legal em cada pais e contrata POR PAIS: a
 * Adyen tem escritorio em Sao Paulo e 222 vagas para Amsterdam. A startup
 * remote-first nao tem entidade em lugar nenhum e contrata de onde a pessoa
 * estiver — por isso o "Americas" da Aleph e o "LATAM" da Artsy.
 *
 * Os dois conjuntos sao DISJUNTOS: nenhuma das 407 startups aparece nas 512
 * curadas. Nao ha sobreposicao a resolver.
 */
export type Porte = 'grande' | 'startup';

/** Onde a empresa tem sede. Lista manual — ver `empresas-sede.yaml`. */
interface Sede {
  nome: string;
  sede: string;
  variantes: string[];
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
  private startups: Empresa[] | null = null;
  private sedes: Sede[] | null = null;

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
    const todas = await this.empresas(filtros.porte);
    if (todas.length === 0) {
      this.log.warn('catalogo de empresas vazio — o motor ATS nao roda');
      return [];
    }

    const alvo = this.escolher(todas, filtros);
    this.log.log(`consultando ${alvo.length} empresas de ${todas.length}`);

    const vagas: VagaDto[] = [];
    // A sede vem da EMPRESA que respondeu, e nao do texto da vaga: o slug e
    // unico, o nome nao. Guardado por id da vaga enquanto elas chegam.
    const sedePorVaga = new Map<string, string>();
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
      for (let k = 0; k < prontas.length; k++) {
        const daEmpresa = lote[k];
        for (const vaga of prontas[k]) {
          if (daEmpresa.sede) sedePorVaga.set(vaga.id, daEmpresa.sede);
          vagas.push(vaga);
        }
      }
    }

    // As sedes so sao lidas quando o filtro existe — carregar a lista para
    // toda busca seria I/O a toa.
    const sedes = filtros.sede_no_pais ? await this.lerSedes() : null;

    // **A elegibilidade e calculada ANTES da peneira, e a ordem e o bug.**
    //
    // Era o contrario: `peneirar(...).map(comElegibilidade)`. O filtro de
    // regiao le `v.elegivelGlobal` e `v.paisesElegiveis` — e os dois chegavam
    // como `false`/`null` em TODA vaga, porque quem os preenche rodava depois.
    //
    // Medido em 26/08: pedir "Worldwide" devolvia 15 vagas, entre elas Madison
    // (Wisconsin), New York e Prague, alem de nove sem local nenhum. O filtro
    // rodava, testava campos vazios e deixava passar — falha silenciosa, do
    // tipo que nao aparece em log nem em erro.
    return this.peneirar(vagas.map(comElegibilidade), filtros, sedes, sedePorVaga);
  }

  /**
   * Quais empresas consultar.
   *
   * Prioriza quem contrata em pais emergente — e o publico do produto, e sem
   * isso as 60 primeiras seriam alfabeticas, o que nao quer dizer nada.
   */
  private escolher(todas: Empresa[], filtros: FiltrosDto): Empresa[] {
    // **Filtro de sede escolhe as empresas, e nao so peneira as vagas.**
    //
    // Sem isto, pedir "empresa brasileira" consultava as 200 primeiras do
    // arquivo e descartava quase tudo depois — a CI&T entrou no catalogo na
    // posicao 512 e nunca era alcancada (medido em 21/08). Consultar quem
    // nao pode passar no filtro e trabalho jogado fora.
    if (filtros.sede_no_pais) {
      const daquele = todas.filter((e) => e.sede === filtros.sede_no_pais);
      if (daquele.length > 0) return daquele.slice(0, TETO_EMPRESAS);
    }

    const querLatam = regioesPedidas(filtros).includes('latam');
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

  /**
   * As vagas de um slug avulso, para a verificacao de descobertas (JOB-37).
   *
   * **Nao replica os tres dialetos** — chama o mesmo `daEmpresa` que a busca
   * usa. Verificar uma descoberta e exatamente "consultar este slug e olhar o
   * resultado", e uma segunda implementacao dos mesmos tres endpoints
   * divergiria da primeira no primeiro dia em que um deles mudasse.
   *
   * Propaga o erro em vez de engolir: quem verifica precisa distinguir 404
   * (slug morto) de timeout (tente de novo amanha), e um `[]` mudo esconde a
   * diferenca.
   */
  async vagasDoSlug(ats: string, slug: string): Promise<VagaDto[]> {
    return this.daEmpresa({ nome: slug, ats, slug, contrataEm: [] });
  }

  /**
   * Os pares `ats:slug` que o catalogo ja conhece, em minusculo.
   *
   * E contra este conjunto que a captura decide se uma vaga traz novidade.
   * Um `Set` e nao uma busca linear: a captura roda por vaga, e o catalogo tem
   * 926 empresas.
   */
  async paresConhecidos(): Promise<Set<string>> {
    const todas = await this.empresas();
    return new Set(todas.map((e) => `${e.ats}:${e.slug.toLowerCase()}`));
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
  private peneirar(
    vagas: VagaDto[],
    f: FiltrosDto,
    sedes: Sede[] | null,
    sedePorFonte: Map<string, string>,
  ): VagaDto[] {
    const cargos = (f.job_titles ?? []).map((s) => s.toLowerCase());
    const techs = (f.technologies ?? []).map((s) => s.toLowerCase());
    const senioridade = f.seniority?.toLowerCase();
    const locais = (f.locations ?? []).map((s) => s.toLowerCase());
    // O corte de idade em milissegundos, calculado UMA vez.
    const limite =
      f.posted_within_days != null
        ? Date.now() - f.posted_within_days * 24 * 60 * 60 * 1000
        : null;
    const excluir = (f.exclude_keywords ?? []).map((s) => s.toLowerCase());
    // **Todas as regioes pedidas, e nao a primeira.**
    //
    // `regions: ['global','latam']` pegava so `global`, que nao esta no mapa —
    // e o filtro inteiro virava `null`, ou seja, DESLIGADO. Pedir
    // "Worldwide + LATAM" devolvia Madison, Wisconsin (medido em 26/08).
    const pedidas = regioesPedidas(f);
    const comLugar = pedidas.filter((r) => !REGIAO_SEM_LUGAR.has(r));
    const regioes = comLugar
      .map((r) => TERMOS_DE_REGIAO[r])
      .filter((re): re is RegExp => re !== undefined);
    // `global` pedido sozinho ou junto: a vaga que aceita de qualquer lugar
    // serve, e e `elegivelGlobal` que diz isso.
    const aceitaGlobal = pedidas.some((r) => REGIAO_SEM_LUGAR.has(r));

    const vistos = new Set<string>();
    const porEmpresa = new Map<string, number>();
    const aprovadas = vagas.filter((v) => {
      if (!v.title || !v.url) return false;
      // A mesma vaga pode vir duas vezes se a empresa estiver no catalogo com
      // dois ATS. `id` e a URL, entao serve de chave.
      if (vistos.has(v.id)) return false;

      // Cargo e senioridade sao do TITULO. Incluir o local aqui fazia
      // "Backend Engineer" casar com uma vaga em "Backend, Nebraska".
      const titulo = v.title.toLowerCase();
      if (cargos.length && !cargos.some((c) => casaCargo(titulo, c))) return false;
      if (senioridade && !casaSenioridade(titulo, senioridade)) return false;

      // **Tecnologia filtra pelo titulo.**
      //
      // Foi ordenacao ate 21/08, e estava errado: pedir Java devolvia 166
      // vagas sem Java em 167, com o Java em cima. "Ordenar" nao e o que a
      // pessoa pede ao marcar uma skill — ela pede para NAO ver o resto.
      //
      // O preco esta medido e e real: os ATS so devolvem titulo e local, e
      // "Senior Backend Engineer" nao escreve Java no titulo mesmo exigindo
      // Spring Boot na descricao. Filtrar derruba de 42 para 5. Menos vagas
      // certas vale mais que muitas erradas — e ler a descricao para resgatar
      // as outras 37 e trabalho do motor de IA.
      //
      // MAS: sem nenhum filtro de cargo, "remoto" sozinho devolve o board
      // inteiro — 300 vagas de Account Executive e Accounting Manager. Se a
      // pessoa nao disse o cargo, a tecnologia passa a ser o unico sinal do
      // que ela procura, e ai ela precisa filtrar. Foi o que a busca de
      // 19/08 mostrou ao tirar o filtro sem por nada no lugar.
      // **Isto aqui e um buscador de vaga de TECNOLOGIA.**
      //
      // Sem cargo escolhido, a peneira anterior deixava passar o board
      // inteiro: 163 de 299 vagas eram "Account Executive", "Accounting
      // Manager", "Head of Support" (medido em 19/08). O filtro de area vale
      // SEMPRE que a pessoa nao nomeou o cargo — nao so quando ela escolheu
      // uma tecnologia.
      //
      // Quando ela nomeia o cargo, `casaCargo` ja e mais restritivo que isto
      // e a checagem seria redundante.
      if (techs.length > 0 && !techs.some((tc) => titulo.includes(tc))) return false;
      // Sem cargo E sem tecnologia, o filtro de area impede o board inteiro
      // de entrar — "Account Executive" nao e vaga de tecnologia.
      if (cargos.length === 0 && techs.length === 0 && !AREA_TECH.test(titulo)) {
        return false;
      }

      // **Remoto exige saber de ONDE.**
      //
      // Medido em 19/08: a Binance marca `workplaceType: 'remote'` com
      // `location: 'Hong Kong'` — remoto de la, nao de qualquer lugar. Ler so
      // o booleano trazia vaga presencial em Budapeste para quem pediu
      // remoto. Agora o local precisa ser compativel com trabalho a
      // distancia de fora.
      if (querRemoto(f) && !remotoDeVerdade(v)) return false;

      // **Idade da vaga.**
      //
      // Medido em 19/08: das 220 vagas de uma busca, **58 tinham mais de seis
      // meses** e havia anuncio de 2021. Board de ATS nao expira sozinho — a
      // empresa precisa arquivar, e muita nao arquiva. Vaga velha na lista
      // gasta o tempo de quem se candidata a processo que ja fechou.
      //
      // Vaga SEM data fica: `postedAt` nulo e o caso comum em alguns ATS, e
      // sumir com ela transformaria "postada nos ultimos 20 dias" em "que
      // dizem quando foram postadas", que e outro filtro.
      if (limite !== null && v.postedAt) {
        const quando = Date.parse(v.postedAt);
        if (Number.isFinite(quando) && quando < limite) return false;
      }

      // **Salario minimo.** So barra quem TEM salario publicado e abaixo do
      // pedido. Vaga sem salario continua — a maioria nao publica, e sumir
      // com elas transformaria "acima de 100k" em "so as que dizem quanto
      // pagam", que e outro filtro.
      if (f.salary_min != null && v.salaryMax != null && v.salaryMax < f.salary_min) {
        return false;
      }

      // **Empresa do meu pais contratando para FORA.**
      //
      // Pedido em 21/08: "uma Stefanini que esta oferecendo vagas para USA".
      // Duas condicoes: a empresa e do pais pedido, E a vaga nao e para o
      // proprio pais dela.
      //
      // **O que este filtro promete e cliente estrangeiro, nao moeda forte.**
      // Outsourcing brasileiro frequentemente contrata CLT ou PJ no Brasil,
      // em real, para alocar em cliente americano — o trabalho vai para fora,
      // o pagamento nao. So a descricao da vaga separa os dois, e a decisao
      // (21/08) foi deixar isso com quem le, em vez de prometer o que o dado
      // nao sustenta.
      if (sedes && f.sede_no_pais) {
        // O slug decide primeiro; o nome e a rede para quem veio de outro
        // motor ou nao esta no catalogo.
        const porSlug = sedePorFonte.get(v.id) ?? null;
        const daqui = (porSlug ?? sedeDe(v.company, sedes)) === f.sede_no_pais;
        if (!daqui) return false;
        const paraCasa = TERMOS_DE_PAIS[f.sede_no_pais];
        // Vaga para o proprio pais da empresa nao serve: a Stefanini
        // contratando em Sao Paulo e emprego local.
        if (paraCasa && !v.elegivelGlobal) {
          const onde = `${v.local ?? ''} ${(v.paisesElegiveis ?? []).join(' ')}`;
          if (paraCasa.test(onde)) return false;
        }
      }

      // **Regiao pedida.**
      //
      // No motor do Firecrawl a regiao entrava na CONSULTA, e aqui nao ha
      // consulta — as APIs de ATS devolvem o board inteiro. Sem esta peneira,
      // pedir LATAM devolvia 163 vagas nao-LATAM em 167 (medido em 21/08).
      //
      // Vaga que aceita de QUALQUER lugar entra em qualquer regiao: quem
      // contrata worldwide contrata na LATAM tambem.
      if (regioes.length > 0 || aceitaGlobal) {
        const onde = `${v.local ?? ''} ${(v.paisesElegiveis ?? []).join(' ')}`;
        // **Sem local nao passa.** Nove das quinze vagas do caso medido em
        // 26/08 vinham com `local` vazio e entravam por ausencia de dado —
        // "nao sei de onde e" nao pode virar "serve para o que voce pediu".
        const semLugar = onde.trim().length === 0;
        const casaAlguma = regioes.some((re) => re.test(onde));
        if (!(v.elegivelGlobal || casaAlguma) || (semLugar && !v.elegivelGlobal)) {
          return false;
        }
      }

      // **Local pedido.** Cruzado com o que a vaga diz aceitar. "Worldwide"
      // nao chega aqui — vira `remote: 'remoto'` no frontend.
      if (locais.length > 0) {
        const onde = (v.local ?? '').toLowerCase();
        if (!locais.some((l) => onde.includes(l))) return false;
      }

      // **Palavras a excluir.** O unico filtro que olha o titulo inteiro de
      // proposito: quem escreve "sem PHP" quer PHP fora do titulo.
      if (excluir.length > 0 && excluir.some((k) => titulo.includes(k))) {
        return false;
      }

      // Uma empresa grande nao pode ocupar a tela inteira.
      const quantas = porEmpresa.get(v.company) ?? 0;
      if (quantas >= TETO_POR_EMPRESA) return false;
      porEmpresa.set(v.company, quantas + 1);

      vistos.add(v.id);
      return true;
    });

    // **Mais recente primeiro.**
    //
    // Vaga de ontem vale mais que vaga de tres meses, e a ordem de chegada
    // e a das empresas no catalogo — que nao diz nada. Quem cita a tecnologia
    // pedida no titulo desempata dentro do mesmo dia.
    //
    // Sem data vai para o fim: `postedAt` nulo nao e "antiga", mas tambem nao
    // pode competir com uma vaga que provou ser de ontem.
    return [...aprovadas].sort((a, b) => {
      const qa = a.postedAt ? Date.parse(a.postedAt) : -Infinity;
      const qb = b.postedAt ? Date.parse(b.postedAt) : -Infinity;
      return qb - qa;
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

  /**
   * O catalogo do porte pedido, lido do disco uma vez e guardado.
   *
   * Sem porte escolhido, os dois entram — quem nao escolheu quer ver tudo.
   */
  private async empresas(porte?: string): Promise<Empresa[]> {
    const grandes = await this.ler('empresas.json', 'catalogo');
    const startups = await this.ler('empresas-startup.json', 'startups');
    if (porte === 'grande') return grandes;
    if (porte === 'startup') return startups;
    return [...startups, ...grandes];
  }

  /** As sedes conhecidas, lidas do disco uma vez. */
  private async lerSedes(): Promise<Sede[]> {
    if (this.sedes) return this.sedes;
    let lido: Sede[] = [];
    try {
      const cru = await readFile(
        join(process.cwd(), 'data', 'ats', 'empresas-sede.json'),
        'utf8',
      );
      lido = JSON.parse(cru) as Sede[];
      this.log.log(`empresas-sede.json: ${lido.length} empresas`);
    } catch (e) {
      this.log.error(`nao consegui ler as sedes: ${String(e).slice(0, 140)}`);
    }
    this.sedes = lido;
    return lido;
  }

  private async ler(arquivo: string, qual: 'catalogo' | 'startups'): Promise<Empresa[]> {
    const guardado = qual === 'catalogo' ? this.catalogo : this.startups;
    if (guardado) return guardado;
    let lido: Empresa[] = [];
    try {
      // `process.cwd()` e a raiz do backend tanto em dev quanto no contêiner.
      const cru = await readFile(join(process.cwd(), 'data', 'ats', arquivo), 'utf8');
      lido = JSON.parse(cru) as Empresa[];
      this.log.log(`${arquivo}: ${lido.length} empresas`);
    } catch (e) {
      this.log.error(`nao consegui ler ${arquivo}: ${String(e).slice(0, 140)}`);
    }
    if (qual === 'catalogo') this.catalogo = lido;
    else this.startups = lido;
    return lido;
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
    // A API nao diz de onde aceita candidato. `null` e a resposta honesta, e
    // a tela ja escreve "not stated" — ver JOB-21.
    paisesElegiveis: null,
    elegivelGlobal: false,
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
function casaCargo(titulo: string, cargo: string): boolean {
  // A frase inteira, na ordem. Exigir so que as palavras APARECAM fazia
  // "Tech Lead" casar com "Technical Accounting Lead" e "Executive Search
  // Lead - Technology" — 26 de 46 resultados errados, medido em 19/08.
  if (titulo.includes(cargo)) return true;

  // Variacoes que os anuncios usam para a mesma coisa.
  const sinonimos: Record<string, string[]> = {
    'backend engineer': ['back-end engineer', 'backend developer', 'back end engineer'],
    'frontend engineer': ['front-end engineer', 'frontend developer', 'front end engineer'],
    'full stack engineer': ['fullstack engineer', 'full-stack engineer', 'full stack developer'],
    'software engineer': ['software developer', 'sde'],
    'tech lead': ['technical lead', 'engineering lead', 'lead engineer'],
    'engineering manager': ['software engineering manager'],
    'data engineer': ['data platform engineer'],
    'devops engineer': ['devops', 'platform engineer', 'infrastructure engineer'],
    'site reliability engineer': ['sre'],
    'machine learning engineer': ['ml engineer', 'ai engineer'],
    'qa engineer': ['quality assurance engineer', 'test engineer', 'sdet'],
    'mobile engineer': ['ios engineer', 'android engineer', 'mobile developer'],
  };
  return (sinonimos[cargo] ?? []).some((s) => titulo.includes(s));
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

function casaSenioridade(titulo: string, nivel: string): boolean {
  const termos = SENIORIDADE[nivel];
  if (!termos) return true;
  // Fronteira de palavra: "intern" casava "Product Engineer, Internal Tools"
  // (medido em 19/08). `\b` resolve sem precisar listar cada falso positivo.
  return termos.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(titulo));
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
/**
 * Paises e cidades que, sozinhos no campo, sao ANCORA e nao alcance.
 *
 * "Serbia" com `isRemote: true` quer dizer "remoto de dentro da Servia" — a
 * Xsolla contrata assim. E verdade para quem mora la, e inutil para quem nao
 * mora: medido em 19/08, 56 das 299 vagas eram deste tipo.
 *
 * Um nome de lugar sozinho, sem "remote" junto, e restricao. As excecoes que
 * significam alcance amplo — "Worldwide", "Global", "Anywhere", "LATAM" —
 * ficam de fora desta regra por `SEM_FRONTEIRA` em `elegibilidade.ts`.
 */
const AMPLO = /\b(worldwide|global|anywhere|latam|latin america|south america|emea|apac|americas|europe|international)\b/i;

/**
 * O que conta como cada regiao no campo de local.
 *
 * Os anuncios escrevem a mesma coisa de varios jeitos — "LATAM", "Latin
 * America", "Americas timezones", ou o nome do pais. Uma regiao so casa se
 * algum desses aparecer.
 */
/**
 * Como cada pais aparece escrito num campo de local.
 *
 * Usado para descartar a vaga que a empresa abre PARA CASA: a Stefanini
 * contratando em Sao Paulo e emprego local, e nao o que este filtro procura.
 */
const TERMOS_DE_PAIS: Record<string, RegExp> = {
  // `\bsp\b` pega "Hybrid, SP" — a Fanatee escreve assim, e a sigla sozinha
  // e o unico sinal de que a vaga e para Sao Paulo (medido em 21/08).
  BR: /\b(brazil|brasil|sao paulo|são paulo|sp|rj|mg|rs|pr|sc|rio de janeiro|belo horizonte|curitiba|porto alegre|recife|campinas|florianopolis|florianópolis|remoto)\b/i,
  AR: /\b(argentina|buenos aires|cordoba|córdoba)\b/i,
  MX: /\b(mexico|méxico|guadalajara|monterrey)\b/i,
  CO: /\b(colombia|bogota|bogotá|medellin|medellín)\b/i,
  IN: /\b(india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai|noida|gurgaon|mohali)\b/i,
};

/**
 * De que pais e a empresa desta vaga, se estiver na lista.
 *
 * Casa por substring sem acento: os ATS escrevem "CI&T", "ci and t" e
 * "ciandt" para a mesma empresa.
 */
function sedeDe(company: string, sedes: Sede[]): string | null {
  const alvo = company
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  for (const s of sedes) {
    if (s.variantes.some((v) => casaNome(alvo, v))) return s.sede;
  }
  return null;
}

/**
 * O nome da empresa casa com a variante?
 *
 * **Nao e substring.** A primeira versao comparava nos dois sentidos
 * (`alvo.includes(v) || v.includes(alvo)`), e o segundo lado fazia
 * `"zup innovation".includes("ion")` casar — a Ion, irlandesa, virou
 * brasileira. E `"loft orbital"` casou com `loft` pela frente, marcando uma
 * empresa de San Francisco como daqui (medido em 21/08).
 *
 * A regra: o nome tem de COMECAR com a variante, e o que vier depois precisa
 * ser fim de palavra. "CI&T Brasil" casa com "ci&t"; "Loft Orbital" nao casa
 * com "loft", porque "orbital" e outra palavra que muda a empresa.
 */
function casaNome(alvo: string, variante: string): boolean {
  if (alvo === variante) return true;
  if (!alvo.startsWith(variante)) return false;
  // O caractere seguinte decide: "ci&t brasil" segue com espaco (mesma
  // empresa, sufixo geografico); "loft orbital" tambem — por isso so aceita
  // sufixo que seja pais ou forma societaria.
  const resto = alvo.slice(variante.length).trim();
  if (resto.length === 0) return true;
  return SUFIXO_NEUTRO.test(resto);
}

/**
 * Sufixos que nao mudam a identidade da empresa.
 *
 * "CI&T Brasil" e a CI&T; "Loft Orbital" nao e a Loft. A lista e curta de
 * proposito — no lugar de adivinhar, prefere-se nao casar.
 */
const SUFIXO_NEUTRO =
  /^(brasil|brazil|latam|inc\.?|ltda\.?|s\.?a\.?|llc|corp\.?|group|tecnologia|technologies|it|careers|jobs|global|do brasil)$/i;

const TERMOS_DE_REGIAO: Record<string, RegExp> = {
  latam:
    /\b(latam|latin america|latin & south america|south america|americas|brazil|brasil|mexico|argentina|colombia|chile|peru|uruguay|costa rica)\b/i,
  eu: /\b(europe|european|eu|emea|portugal|spain|germany|france|poland|netherlands|ireland|italy)\b/i,
  uk: /\b(uk|united kingdom|england|scotland|wales|london)\b/i,
  us: /\b(usa|u\.s\.|united states|us-based|americas)\b/i,
  north_america: /\b(usa|united states|canada|north america|americas)\b/i,
  apac: /\b(apac|asia|singapore|india|japan|australia|new zealand)\b/i,
  mena: /\b(mena|middle east|uae|dubai|egypt|morocco|saudi)\b/i,
  africa: /\b(africa|nigeria|kenya|south africa|egypt)\b/i,
  cis: /\b(cis|russia|ukraine|kazakhstan|georgia|armenia)\b/i,
};

/**
 * `global` NAO entra no mapa acima, e isso e deliberado.
 *
 * "Worldwide" nao e um lugar a casar por texto — e a AUSENCIA de restricao,
 * que `v.elegivelGlobal` ja representa. Uma regex para ele casaria a palavra
 * "global" no nome da empresa ("PlayStation Global") e aprovaria uma vaga de
 * Madison, Wisconsin (medido em 26/08).
 */
const REGIAO_SEM_LUGAR = new Set(['global']);

function remotoDeVerdade(v: VagaDto): boolean {
  const local = (v.local ?? '').trim();

  // Sem NENHUM sinal de remoto, e presencial. Medido em 19/08: "Portland,
  // Oregon, USA" com `regime: null` passava, porque a versao anterior so
  // barrava cidade de uma lista fixa — e o mundo tem mais cidades que a
  // lista. Agora a vaga precisa PROVAR que e remota, em vez de a lista
  // precisar provar que ela nao e.
  const dizRemoto = v.regime === 'remoto' || /\b(remote|remoto|anywhere|distributed)\b/i.test(local);
  if (!dizRemoto) return false;

  if (!local) return true;
  if (temEndereco(local)) return false;

  // Um lugar nomeado sozinho e ancora: "Serbia", "Bengaluru", "Montreal".
  // Deixa passar so o que descreve uma REGIAO ampla ou nao nomeia lugar.
  const semRuido = local
    .replace(/\b(remote|remoto|remote-first|hybrid)\b/gi, '')
    .replace(/[(),-]/g, ' ')
    .trim();
  if (!semRuido) return true;
  return AMPLO.test(local);
}

/**
 * O local aponta um endereco especifico?
 *
 * Regra por FORMA, e nao por lista de cidades: nomear duas partes
 * ("Portland, Oregon", "Hungary, Budapest") e dar endereco, mesmo que a
 * cidade nao esteja em lista nenhuma. Uma lista fixa sempre perde para o
 * mundo real — foi o que deixou "Portland, Oregon, USA" passar em 19/08.
 *
 * A excecao e quando uma das partes diz "remote": "Remote, Canada" e
 * "Remote - EMEA" sao remoto COM restricao de pais, nao endereco.
 */
const CIDADES = /\b(budapest|basingstoke|hong kong|taipei|singapore|london|berlin|paris|amsterdam|dublin|madrid|barcelona|lisbon|warsaw|bucharest|belgrade|tel aviv|bangalore|mumbai|delhi|tokyo|seoul|sydney|melbourne|toronto|vancouver|new york|san francisco|seattle|austin|chicago|boston|denver|atlanta|miami|los angeles|sao paulo|são paulo|rio de janeiro|mexico city|bogota|buenos aires|santiago)\b/i;

function temEndereco(local: string): boolean {
  const partes = local
    .split(/[,;|/]| - /)
    .map((p) => p.trim())
    .filter(Boolean);
  // Alguma parte diz "remote"? Entao a geografia e restricao, nao endereco.
  if (partes.some((p) => /^(remote|remoto|anywhere|distributed)/i.test(p))) {
    return false;
  }
  // Duas ou mais partes geograficas = cidade + estado/pais.
  if (partes.length >= 2) return true;
  // Uma parte so: cidade conhecida ainda barra ("Bangalore", "Sofia").
  return CIDADES.test(local);
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
    paisesElegiveis: e.paises,
    elegivelGlobal: e.global,
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


/**
 * As regioes pedidas, do campo antigo ou do novo.
 *
 * A tela passou a mandar `regions: ['latam']` (o vocabulario do freehire), e
 * este motor so lia `regiao: 'latam'`. O campo novo era **ignorado em
 * silencio**: pedir LATAM e receber Bangalore, medido em 26/08.
 */
function regioesPedidas(f: FiltrosDto): string[] {
  const doNovo = f.regions ?? [];
  return doNovo.length > 0 ? doNovo : f.regiao ? [f.regiao] : [];
}

/** O regime pedido, pelo campo novo ou pelo antigo. */
function querRemoto(f: FiltrosDto): boolean {
  return f.remote === 'remoto' || (f.work_modes?.includes('remote') ?? false);
}

/**
 * Os filtros que este motor **nao sabe honrar**.
 *
 * O ATS le titulo e local; nao ha de onde tirar nivel de ingles, patrocinio de
 * visto ou lista curada. Sem esta guarda ele respondia a um pedido que nao
 * cumpria — e como a cascata para no primeiro motor que acha algo, o resultado
 * ia para a tela como se fosse a resposta.
 *
 * Medido em 26/08: `work_modes: ['remoto']` (valor de vocabulario errado)
 * zerou o freehire, a cascata caiu para ca, e o ATS devolveu **487 vagas, 305
 * nao-remotas** para um pedido de vagas remotas.
 *
 * `regions` e `work_modes` NAO entram na lista: os dois acima os traduzem.
 */
const NAO_SEI_HONRAR: Array<keyof FiltrosDto> = [
  'roles',
  'english_levels',
  'seniorities',
  'collections',
  'company_sizes',
  'relocation',
  'reality',
  'visa_sponsorships',
  'posting_languages',
  'education_levels',
  'ai_archetypes',
  'domains',
  'cities',
];

/** Ha filtro que este motor ignoraria em silencio? */
export function atsIgnoraria(f: FiltrosDto): string[] {
  return NAO_SEI_HONRAR.filter((c) => {
    const v = f[c];
    return Array.isArray(v) && v.length > 0;
  }) as string[];
}
