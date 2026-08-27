import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IaService } from '../ia/ia.service';
import { OrdemDaIaService } from '../ia/ordem.service';
import { SaudeDaIaService, type EstadoDoProvedor } from '../ia/saude.service';
import { PROVEDORES, provedor, type Capacidade } from '../ia/provedores';
import { explicacao, type StatusDaChave } from '../ia/verificacao';

/**
 * O provedor de IA preferido, como string.
 *
 * Era `'anthropic' | 'openai'` — uma uniao fechada escrita para exatamente
 * dois. Agora e o `ApiProvider` do Prisma, porque a lista cresce em
 * `src/ia/provedores.ts` e um tipo que precisa ser editado a cada provedor novo
 * e o mesmo problema que a cadeia veio resolver.
 */
export type IaDaBusca = ApiProvider;

/** Como um provedor aparece na tela de Configuracoes. */
export interface ProvedorDto {
  id: ApiProvider;
  nome: string;
  /** Ha chave cadastrada (no banco ou no ambiente). */
  temChave: boolean;
  /** Faz busca na web — logo, serve para a busca de vagas. */
  buscaWeb: boolean;
  /**
   * O provedor treina modelos com o que recebe no free tier.
   *
   * A tela mostra isto ao lado do nome. O texto do CV vai INTEIRO para o
   * provedor, com CPF, endereco e telefone (JOB-02), e a tela de vagas promete
   * que so guardamos stack, senioridade e anos. Guardar pouco nao e enviar
   * pouco, e quem liga a chave precisa saber a diferenca antes.
   */
  treinaComOsDados: boolean;
  /** Onde a pessoa cria a chave. */
  console: string;
  /**
   * Custa dinheiro? Duas etiquetas na tela, `Paid` e `Free tier`.
   *
   * Sem preco nem taxa por token de proposito: eles envelhecem, e a tela
   * passaria a mentir sem ninguem notar. Pago-contra-gratis e a entrada
   * inteira da decisao de ordenar a cadeia.
   */
  gratuito: boolean;
  /**
   * O estado da chave, da ultima verificacao guardada.
   *
   * **Nao e "ha chave cadastrada".** A tela antiga mostrava "stored" para duas
   * chaves mortas (Anthropic 401, OpenAI 429), que e a diferenca exata entre
   * ela e esta. Ver `src/ia/verificacao.ts`.
   */
  status: StatusDaChave;
  /** O codigo HTTP da ultima verificacao. `null` se nao houve resposta. */
  httpStatus: number | null;
  /**
   * A frase que explica o estado e diz o que fazer.
   *
   * Vazia quando nao ha o que explicar (funcionando, ou sem chave). E a metade
   * util do selo: "Key refused" nao diz o que fazer, "401 — API key is
   * invalid. Revoked or mistyped." diz.
   */
  motivo: string;
  /** Quando foi verificado, ISO. `null` se nunca foi. */
  checkedAt: string | null;
  /** Os quatro ultimos caracteres da chave guardada, se houver. */
  hint: string | null;
}

/**
 * Quem tem free tier SEM CARTAO.
 *
 * Vive aqui e nao no registro por ser fato comercial, e nao capacidade
 * tecnica: muda por decisao do provedor, sem que nada no codigo mude junto.
 * Duas etiquetas na tela, `Paid` e `Free tier` — sem preco nem taxa por
 * token, que envelhecem e fariam a tela mentir sem ninguem notar.
 */
const GRATUITOS = new Set<ApiProvider>([
  ApiProvider.GEMINI,
  ApiProvider.GROQ,
  ApiProvider.CEREBRAS,
  ApiProvider.MISTRAL,
]);

/** Chaves das flags na tabela de configuracao. */
const LEITURA_CV = 'jobs.leituraCv';
/**
 * O motor da busca, e nao um liga-desliga da busca.
 *
 * Ligada: o Firecrawl abre cada anuncio (fundo, caro, teto de 8 por causa do
 * rate limit). Desligada: a busca continua acontecendo, pela IA com
 * `web_search` — mais anuncio, menos profundidade em cada um.
 *
 * O nome da chave continua `jobs.buscaVagas` porque ja existe linha gravada no
 * banco com ele; renomear pediria migracao para nao perder a escolha de quem
 * ja mexeu no interruptor.
 */
const FIRECRAWL_ATIVO = 'jobs.buscaVagas';

/**
 * O motor de ATS, ligado por padrao.
 *
 * Diferente dos outros dois: nao depende de chave nenhuma, porque as APIs de
 * Greenhouse, Lever e Ashby sao publicas. Entao o default e LIGADO — nao ha
 * segredo a proteger nem credito a gastar, e desligado ele so priva a busca do
 * motor mais barato que existe.
 */
const ATS_ATIVO = 'jobs.ats';

/**
 * O motor do freehire (JOB-39), ligado por padrao.
 *
 * Mesma regra do ATS: a API e publica e sem chave, entao nao ha segredo a
 * proteger nem credito a gastar, e o default e LIGADO.
 *
 * O interruptor existe por outro motivo — **este motor e o unico que depende
 * de um servico de terceiro sem contrato**. Gratis, sem SLA: pode fechar,
 * cobrar ou mudar o schema sem aviso. Desligar precisa ser um gesto, e nao um
 * deploy.
 */
const FREEHIRE_ATIVO = 'jobs.freehire';

/**
 * A busca que roda sozinha a cada 50 min.
 *
 * Default DESLIGADO, ao contrario do ATS: ela gasta sem ninguem pedir, e o
 * que gasta sozinho so liga por decisao explicita. Ligar sem querer produz
 * conta no fim do mes que ninguem sabe de onde veio.
 */
const BUSCA_AGENDADA = 'jobs.buscaAgendada';

/**
 * O e-mail semanal de vagas (JOB-24).
 *
 * Default DESLIGADO, pelo mesmo motivo da busca agendada: ele age sozinho, e
 * o que age sozinho so liga por decisao explicita. Aqui o estrago de ligar sem
 * querer e pior que uma conta inesperada — e mandar e-mail nao solicitado, que
 * queima o dominio e nao tem desfazer.
 */
const EMAIL_SEMANAL = 'jobs.emailSemanal';

/**
 * O historico de vagas vistas e descartadas (JOB-26).
 *
 * Default LIGADO, como o ATS e ao contrario do e-mail: nao gasta credito, nao
 * manda nada para ninguem e nao depende de chave nenhuma — so grava a URL do
 * que a propria pessoa marcou. O que ele faz e ESCONDER vaga que ela pediu
 * para esconder, e nascer desligado deixaria o botao "Dismiss" sem efeito ate
 * alguem lembrar de ligar um interruptor.
 *
 * Desligado, o historico continua no banco e para de ser aplicado: nada e
 * apagado, e religar devolve as marcas. Apagar seria uma decisao que um
 * interruptor nao tem o direito de tomar.
 */
const HISTORICO = 'jobs.historico';

/**
 * A colheita do catalogo de ATS (JOB-37).
 *
 * Default LIGADO, como o ATS e o historico: nao gasta credito, nao chama
 * provedor pago e nao manda nada para ninguem. A captura e parsing de uma URL
 * que ja esta em memoria, e a verificacao bate em API publica e sem chave, a
 * uma consulta a cada 5s de madrugada.
 *
 * O que ele governa sao DUAS coisas ao mesmo tempo: a busca deixa de anotar e o
 * cron das 3h nao roda. Desligar um e nao o outro deixaria o cron mastigando
 * uma fila que ninguem mais alimenta.
 */
const DESCOBERTAS = 'jobs.descobertas';

/**
 * A paginacao sob demanda da busca (JOB-45).
 *
 * Default LIGADO, como o ATS, o historico e as descobertas: nao gasta credito
 * nem chama provedor pago. Uma pagina a mais e UMA requisicao a uma API publica
 * e gratuita, e so quando alguem clica em "Load more".
 *
 * Desligado, a busca volta a ser exatamente a de antes: uma chamada de 60
 * vagas, `temMais: false`, e a tela nao mostra o botao. E o que a casa manda —
 * desligar um motor nao derruba a feature.
 */
const PAGINACAO = 'jobs.paginacao';

export interface RecursosDto {
  /** A leitura de curriculo esta ligada e funcionando. */
  leituraCvAtiva: boolean;
  /**
   * O Firecrawl esta ligado E utilizavel.
   *
   * Desligado nao significa busca desligada: significa busca pela IA.
   */
  firecrawlAtivo: boolean;
  /** Ha token do Firecrawl cadastrado. Sem ele o interruptor nao liga. */
  temChaveFirecrawl: boolean;
  /**
   * Ha ao menos um motor utilizavel — Firecrawl ligado com chave, ou chave de
   * IA. Sem nenhum, a busca nao tem de onde tirar vaga, e a tela precisa
   * dizer isso ANTES de alguem clicar em Filter.
   */
  buscaPossivel: boolean;
  /**
   * O motor de ATS esta ligado.
   *
   * Custa zero e nao pede chave, entao o default e `true` — a ausencia da
   * linha no banco significa ligado, ao contrario das outras flags.
   */
  atsAtivo: boolean;
  /**
   * O motor do freehire esta ligado (JOB-39).
   *
   * Sem dependencia de chave, como o ATS — ausencia de linha significa LIGADO.
   * E o PRIMEIRO motor da cascata: 60 vagas em 2,6s contra 1-15 em 128s do
   * ATS (medido em 26/08), e os dois custam R$ 0. O ATS e que virou o
   * fallback dele.
   */
  freehireAtivo: boolean;
  /** A busca automatica esta ligada. Default `false` — ela gasta sozinha. */
  buscaAgendadaAtiva: boolean;
  /**
   * O e-mail semanal esta ligado E tem por onde sair.
   *
   * Mesma regra do Firecrawl: **a dependencia manda sobre a flag**. Sem
   * provedor que entregue, isto e `false` mesmo com o interruptor ligado — a
   * rodada montaria o e-mail e o jogaria no log, e mostrar "ligado" faria a
   * tela prometer entrega que nao acontece.
   */
  emailAtivo: boolean;
  /** O interruptor, como o admin o deixou — independente de haver provedor. */
  emailLigado: boolean;
  /** Ha provedor de e-mail que entrega de verdade? Hoje: nao, falta SMTP. */
  temProvedorDeEmail: boolean;
  /**
   * O historico esta ligado.
   *
   * Sem dependencia: nao ha chave que possa faltar, entao o valor da flag e a
   * resposta inteira. Ausencia de linha significa LIGADO.
   */
  historicoAtivo: boolean;
  /**
   * A colheita do catalogo esta ligada (JOB-37).
   *
   * Sem dependencia, como o ATS: as APIs de Greenhouse, Lever e Ashby sao
   * publicas. Ausencia de linha significa LIGADO.
   */
  descobertasAtivas: boolean;
  /**
   * A paginacao sob demanda esta ligada (JOB-45).
   *
   * Sem dependencia, como o ATS: nao ha chave que possa faltar. Ausencia de
   * linha significa LIGADO.
   */
  paginacaoAtiva: boolean;
  /**
   * A ordem COMPLETA da cadeia, como o admin a arrumou.
   *
   * **Substitui `iaPreferida`**, que era um provedor promovido ao topo. Com
   * seis provedores, a segunda e a terceira posicoes decidem quem atende
   * quando o topo cai, e uma preferencia unica nao as representa. Sempre traz
   * os seis; a cadeia de cada uso e esta lista filtrada por capacidade.
   */
  ordemDaIa: IaDaBusca[];
  /**
   * Quem de fato serve a busca de vagas AGORA.
   *
   * **Substitui `iaEfetiva`**, que era "o primeiro com chave" — e chave
   * cadastrada nao e chave que funciona. Este e o primeiro da cadeia cuja
   * ultima verificacao deu `funcionando`. `null` significa que a busca por IA
   * esta parada, e a tela diz isso em vez de deixar alguem descobrir clicando.
   */
  iaDaBusca: IaDaBusca | null;
  /** Quem serve a leitura de CV e a leitura de anuncio. Mesma regra. */
  iaDaExtracao: IaDaBusca | null;
  /**
   * Todos os provedores do registro, com o estado de cada um.
   *
   * Substitui os antigos `temChaveAnthropic` / `temChaveOpenAi`: um campo por
   * provedor obrigaria a mexer no DTO, no espelho do frontend e na tela a cada
   * provedor novo. Uma lista nao.
   */
  provedores: ProvedorDto[];
  /** Quantos provedores servem a busca de vagas (exige busca na web). */
  provedoresDeBusca: number;
  /** Quantos provedores servem a leitura de CV (basta saida estruturada). */
  provedoresDeExtracao: number;
  /**
   * Ha chave de IA cadastrada. Sem ela o toggle nao pode ser ligado — e a
   * tela precisa saber para explicar por que o controle esta bloqueado, em
   * vez de mostrar um interruptor que nao obedece.
   */
  temChaveDeIa: boolean;
}

/**
 * Recursos que o admin liga e desliga em tempo de execucao.
 *
 * Hoje so a leitura de curriculo. A regra que vale para qualquer recurso que
 * dependa de credencial: **ligar so e possivel se a dependencia existir**. Um
 * interruptor que liga sem a chave nao esta ligando nada — so movendo a falha
 * para o momento em que alguem sobe um CV e recebe erro.
 */
@Injectable()
export class RecursosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
    private readonly ordemDaIa: OrdemDaIaService,
    private readonly saude: SaudeDaIaService,
  ) {}

  async obter(): Promise<RecursosDto> {
    const [flagFirecrawl, temFirecrawl] = await Promise.all([
      this.flag(FIRECRAWL_ATIVO),
      this.temChaveFirecrawl(),
    ]);

    const [
      ordem,
      estados,
      hints,
      comChaveBusca,
      comChaveExtracao,
      ats,
      freehire,
      agendada,
      email,
      historico,
      descobertas,
      paginacao,
      flagCv,
    ] = await Promise.all([
      this.ordemDaIa.ordem(),
      this.saude.estado(),
      this.hints(),
      this.ia.comChave('buscaWeb'),
      this.ia.comChave('estruturada'),
      this.flagLigadaPorPadrao(ATS_ATIVO),
      this.flagLigadaPorPadrao(FREEHIRE_ATIVO),
      this.flag(BUSCA_AGENDADA),
      this.flag(EMAIL_SEMANAL),
      this.flagLigadaPorPadrao(HISTORICO),
      this.flagLigadaPorPadrao(DESCOBERTAS),
      this.flagLigadaPorPadrao(PAGINACAO),
      this.flag(LEITURA_CV),
    ]);

    // A leitura de CV so exige saida estruturada, e a busca exige tambem busca
    // na web. Sao conjuntos diferentes: Groq com chave torna a leitura de CV
    // possivel sem tornar a busca por IA possivel.
    const comChave = new Set([...comChaveBusca, ...comChaveExtracao]);
    const temChave = comChaveExtracao.length > 0;

    const porId = new Map(estados.map((e) => [e.provider, e]));

    // Na ORDEM da cadeia, e nao na ordem do registro: a lista da tela e a
    // cadeia, e mostra-la fora de ordem faria as setas mentirem.
    const provedores: ProvedorDto[] = ordem
      .map((id) => ({ p: provedor(id), e: porId.get(id) }))
      .filter((x): x is { p: NonNullable<typeof x.p>; e: EstadoDoProvedor | undefined } =>
        x.p !== undefined,
      )
      .map(({ p, e }) => {
        const status: StatusDaChave = e?.status ?? 'sem_chave';
        return {
          id: p.id,
          nome: p.nome,
          temChave: comChave.has(p.id),
          buscaWeb: p.capacidades.includes('buscaWeb'),
          treinaComOsDados: p.treinaComOsDados,
          console: p.console,
          gratuito: GRATUITOS.has(p.id),
          status,
          httpStatus: e?.httpStatus ?? null,
          motivo: explicacao(status, e?.httpStatus ?? null, e?.detalhe ?? ''),
          checkedAt: e?.checkedAt ?? null,
          hint: hints.get(p.id) ?? null,
        };
      });

    // **Quem SERVE, e nao quem tem chave.** A tela antiga dizia "stored" para
    // duas chaves mortas; esta pergunta ao estado verificado, e por isso o
    // painel de saude pode afirmar que a busca esta parada.
    const iaDaBusca = this.saude.quemServe('buscaWeb', ordem, estados);
    const iaDaExtracao = this.saude.quemServe('estruturada', ordem, estados);

    const temProvedorDeEmail = temSmtp();

    // A chave manda: se ela sumiu depois de o recurso ter sido ligado, o
    // recurso esta desligado de fato, e a tela precisa dizer isso — nao
    // mostrar "ligado" e falhar no uso.
    return {
      leituraCvAtiva: flagCv && temChave,
      temChaveDeIa: temChave,
      firecrawlAtivo: flagFirecrawl && temFirecrawl,
      temChaveFirecrawl: temFirecrawl,
      // Um motor OU o outro. Firecrawl desligado nao fecha a busca — passa a
      // vez para a IA.
      atsAtivo: ats,
      freehireAtivo: freehire,
      // So faz sentido ligada se houver motor: sem nenhum, a rodada gasta
      // tempo para nao achar nada.
      buscaAgendadaAtiva:
        agendada && (ats || freehire || (flagFirecrawl && temFirecrawl) || temChave),
      // O ATS entra na conta: com ele ligado ha busca mesmo sem chave nenhuma
      // cadastrada, que e o ponto de ele nao depender de credencial.
      buscaPossivel: ats || freehire || (flagFirecrawl && temFirecrawl) || temChave,
      // A dependencia manda sobre a flag: sem SMTP nao ha entrega, e dizer
      // "ligado" seria prometer o que nao acontece.
      emailAtivo: email && temProvedorDeEmail,
      emailLigado: email,
      temProvedorDeEmail,
      historicoAtivo: historico,
      descobertasAtivas: descobertas,
      paginacaoAtiva: paginacao,
      ordemDaIa: ordem,
      iaDaBusca,
      iaDaExtracao,
      provedores,
      provedoresDeBusca: comChaveBusca.length,
      provedoresDeExtracao: comChaveExtracao.length,
    };
  }

  async definirBuscaVagas(ativa: boolean): Promise<RecursosDto> {
    // So o Firecrawl importa aqui: e o motor que este interruptor liga.
    if (ativa && !(await this.temChaveFirecrawl())) {
      throw new BadRequestException(
        'Cadastre o token do Firecrawl antes de ligar o Firecrawl.',
      );
    }
    await this.gravar(FIRECRAWL_ATIVO, ativa);
    return this.obter();
  }

  async definirBuscaAgendada(ativa: boolean): Promise<RecursosDto> {
    await this.gravar(BUSCA_AGENDADA, ativa);
    return this.obter();
  }

  /**
   * Liga o e-mail semanal.
   *
   * **Deixa ligar sem SMTP, de proposito** — ao contrario do Firecrawl. Aqui a
   * flag ligada sem provedor tem um uso real: a rodada monta o e-mail de
   * verdade e o escreve no log, que e como se confere a feature enquanto o
   * SMTP nao existe. Bloquear deixaria o card sem nenhuma forma de verificacao.
   *
   * O que NAO pode e a tela dizer que esta entregando: por isso `emailAtivo`
   * continua `false` sem provedor, e `emailLigado` mostra a escolha do admin.
   */
  async definirEmailSemanal(ativa: boolean): Promise<RecursosDto> {
    await this.gravar(EMAIL_SEMANAL, ativa);
    return this.obter();
  }

  async definirHistorico(ativa: boolean): Promise<RecursosDto> {
    // Sem checagem de dependencia: o historico so grava a URL do que a pessoa
    // marcou, e nao chama servico nenhum de fora.
    await this.gravar(HISTORICO, ativa);
    return this.obter();
  }

  /**
   * Liga a colheita do catalogo.
   *
   * Sem checagem de dependencia, como o ATS: as APIs sao publicas e nao ha
   * chave que possa faltar. Desligada, a busca para de anotar e o cron das 3h
   * nao roda — a fila ja gravada continua no banco, intacta. Apagar seria uma
   * decisao que um interruptor nao tem o direito de tomar.
   */
  async definirDescobertas(ativa: boolean): Promise<RecursosDto> {
    await this.gravar(DESCOBERTAS, ativa);
    return this.obter();
  }

  /**
   * Liga o motor do freehire.
   *
   * Sem checagem de dependencia, como o ATS: a API e publica e nao ha chave que
   * possa faltar.
   */
  async definirFreehire(ativa: boolean): Promise<RecursosDto> {
    await this.gravar(FREEHIRE_ATIVO, ativa);
    return this.obter();
  }

  /**
   * Liga a paginacao sob demanda (JOB-45).
   *
   * Sem checagem de dependencia: e o mesmo motor do freehire, e ele ja tem o
   * interruptor dele. Desligar a paginacao nao desliga a busca — devolve as 60
   * de sempre.
   */
  async definirPaginacao(ativa: boolean): Promise<RecursosDto> {
    await this.gravar(PAGINACAO, ativa);
    return this.obter();
  }

  async definirAts(ativa: boolean): Promise<RecursosDto> {
    // Sem checagem de dependencia: as APIs de ATS sao publicas, nao ha chave
    // que possa faltar.
    await this.gravar(ATS_ATIVO, ativa);
    return this.obter();
  }

  /**
   * Flag cujo default e LIGADO.
   *
   * `flag()` trata linha ausente como `false`, que e o certo para recurso que
   * gasta credito ou expoe dado. O ATS e o contrario: nao custa nada, entao
   * ausencia de configuracao deve significar ligado.
   */
  private async flagLigadaPorPadrao(chave: string): Promise<boolean> {
    const linha = await this.prisma.appSetting.findUnique({
      where: { chave },
      select: { valor: true },
    });
    return linha === null ? true : linha.valor === 'true';
  }

  private async flag(chave: string): Promise<boolean> {
    const linha = await this.prisma.appSetting.findUnique({
      where: { chave },
      select: { valor: true },
    });
    return linha?.valor === 'true';
  }

  private async gravar(chave: string, ativa: boolean): Promise<void> {
    const valor = ativa ? 'true' : 'false';
    await this.prisma.appSetting.upsert({
      where: { chave },
      create: { chave, valor },
      update: { valor },
      select: { chave: true },
    });
  }

  private async temChaveFirecrawl(): Promise<boolean> {
    if (process.env.FIRECRAWL_API_KEY) return true;
    const token = await this.prisma.apiToken.findFirst({
      where: { provider: ApiProvider.FIRECRAWL },
      select: { id: true },
    });
    return token !== null;
  }

  async definirLeituraCv(ativa: boolean): Promise<RecursosDto> {
    if (ativa && !(await this.temChaveDeIa())) {
      throw new BadRequestException(
        'Cadastre a chave de algum provedor de IA antes de ligar a leitura de curriculo.',
      );
    }
    await this.gravar(LEITURA_CV, ativa);
    return this.obter();
  }

  /**
   * Existe token de algum provedor de IA que sirva para extracao?
   *
   * Extracao e o piso: todo provedor do registro atende `estruturada`, entao
   * este e o teste mais permissivo — e o certo para a leitura de CV, que e o
   * unico recurso que ele governa.
   */
  private async temChaveDeIa(): Promise<boolean> {
    return this.ia.disponivel('estruturada');
  }

  /**
   * Os quatro ultimos caracteres de cada chave guardada.
   *
   * Sem `userId`: a chave e da instalacao, e a tela de admin mostra a que a
   * cadeia de fato usa. Uma consulta so para os seis, em vez de uma por
   * cartao.
   */
  private async hints(): Promise<Map<ApiProvider, string>> {
    const linhas = await this.prisma.apiToken.findMany({
      select: { provider: true, hint: true },
      orderBy: { updatedAt: 'desc' },
    });
    const mapa = new Map<ApiProvider, string>();
    for (const l of linhas) {
      if (!mapa.has(l.provider)) mapa.set(l.provider, l.hint);
    }
    return mapa;
  }

  /**
   * Move um provedor uma posicao na cadeia.
   *
   * **Substitui `definirIaDaBusca`**, que gravava UM preferido. A tela agora
   * ordena a lista inteira com setas ↑↓, e a ordem completa e o que sobrevive
   * ao reload — ver `OrdemDaIaService`.
   */
  async moverProvedor(
    id: ApiProvider,
    direcao: 'cima' | 'baixo',
    cadeia?: Capacidade,
  ): Promise<RecursosDto> {
    if (!provedor(id)) {
      throw new BadRequestException('Provedor de IA desconhecido.');
    }
    await this.ordemDaIa.mover(id, direcao, cadeia);
    return this.obter();
  }

  /**
   * Verifica as seis chaves agora e devolve o estado novo.
   *
   * E o botao `Test all keys`. A verificacao na CARGA da tela nao existe de
   * proposito (decisao de 25/08/2026): seriam seis chamadas reais por visita,
   * e nas pagas isso custa dinheiro. Quem quer o valor de agora clica.
   */
  async verificarChaves(): Promise<RecursosDto> {
    await this.saude.verificarTodos();
    return this.obter();
  }
}

/**
 * Ha SMTP configurado?
 *
 * Uma funcao e nao um servico injetado para evitar dependencia circular:
 * `EmailModule` importa `SettingsModule` para ler as flags, entao
 * `RecursosService` nao pode depender do provedor de e-mail. O que ele precisa
 * saber e so isto — se existe credencial —, e isso esta no ambiente.
 *
 * O stakeholder nao tem SMTP e nao vai configurar agora (24/08), entao isto e
 * `false` hoje e o e-mail fica no log. Preencher `SMTP_HOST` e o unico gesto
 * que muda esta resposta.
 */
function temSmtp(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_HOST.trim());
}
