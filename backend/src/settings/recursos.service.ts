import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Provedores de IA que a busca sabe usar. */
export type IaDaBusca = 'anthropic' | 'openai';

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

/** Qual IA a busca prefere. Preferencia, nao exigencia — ver `iaDaBusca`. */
const IA_DA_BUSCA = 'jobs.iaDaBusca';

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
  /** A IA preferida para a busca, como o admin escolheu. */
  iaPreferida: IaDaBusca;
  /** A que vai ser usada de fato — cai na outra se a preferida nao tem chave. */
  iaEfetiva: IaDaBusca | null;
  temChaveAnthropic: boolean;
  temChaveOpenAi: boolean;
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
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<RecursosDto> {
    const [flagCv, flagFirecrawl, temChave, temFirecrawl] = await Promise.all([
      this.flag(LEITURA_CV),
      this.flag(FIRECRAWL_ATIVO),
      this.temChaveDeIa(),
      this.temChaveFirecrawl(),
    ]);

    const [pref, temAnthropic, temOpenAi, ats, agendada, email] = await Promise.all([
      this.iaPreferida(),
      this.temChaveDe(ApiProvider.ANTHROPIC),
      this.temChaveDe(ApiProvider.OPENAI),
      this.flagLigadaPorPadrao(ATS_ATIVO),
      this.flag(BUSCA_AGENDADA),
      this.flag(EMAIL_SEMANAL),
    ]);

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
      // So faz sentido ligada se houver motor: sem nenhum, a rodada gasta
      // tempo para nao achar nada.
      buscaAgendadaAtiva: agendada && (ats || (flagFirecrawl && temFirecrawl) || temChave),
      // O ATS entra na conta: com ele ligado ha busca mesmo sem chave nenhuma
      // cadastrada, que e o ponto de ele nao depender de credencial.
      buscaPossivel: ats || (flagFirecrawl && temFirecrawl) || temChave,
      // A dependencia manda sobre a flag: sem SMTP nao ha entrega, e dizer
      // "ligado" seria prometer o que nao acontece.
      emailAtivo: email && temProvedorDeEmail,
      emailLigado: email,
      temProvedorDeEmail,
      iaPreferida: pref,
      iaEfetiva: escolherIa(pref, temAnthropic, temOpenAi),
      temChaveAnthropic: temAnthropic,
      temChaveOpenAi: temOpenAi,
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
        'Cadastre uma chave da Anthropic ou da OpenAI antes de ligar a leitura de curriculo.',
      );
    }
    await this.gravar(LEITURA_CV, ativa);
    return this.obter();
  }

  /** Existe token de algum provedor de IA cadastrado? */
  private async temChaveDeIa(): Promise<boolean> {
    const [a, o] = await Promise.all([
      this.temChaveDe(ApiProvider.ANTHROPIC),
      this.temChaveDe(ApiProvider.OPENAI),
    ]);
    return a || o;
  }

  private async temChaveDe(provider: ApiProvider): Promise<boolean> {
    if (provider === ApiProvider.ANTHROPIC && process.env.ANTHROPIC_API_KEY) return true;
    if (provider === ApiProvider.OPENAI && process.env.OPENAI_API_KEY) return true;
    const token = await this.prisma.apiToken.findFirst({
      where: { provider },
      select: { id: true },
    });
    return token !== null;
  }

  /** A escolha gravada. `anthropic` e o default de quem nunca escolheu. */
  private async iaPreferida(): Promise<IaDaBusca> {
    const linha = await this.prisma.appSetting.findUnique({
      where: { chave: IA_DA_BUSCA },
      select: { valor: true },
    });
    return linha?.valor === 'openai' ? 'openai' : 'anthropic';
  }

  async definirIaDaBusca(ia: IaDaBusca): Promise<RecursosDto> {
    // Nao exige chave: e uma PREFERENCIA. Escolher a que ainda nao tem chave e
    // legitimo — a pessoa esta dizendo qual quer usar quando cadastrar, e ate
    // la a outra atende.
    await this.prisma.appSetting.upsert({
      where: { chave: IA_DA_BUSCA },
      create: { chave: IA_DA_BUSCA, valor: ia },
      update: { valor: ia },
      select: { chave: true },
    });
    return this.obter();
  }
}

/**
 * Qual IA vai rodar de fato.
 *
 * A escolha do admin e preferencia, e nao exigencia: se a preferida nao tem
 * chave, a outra atende. Uma busca que funciona vale mais que uma que respeita
 * a configuracao e nao devolve nada — e a tela mostra qual esta valendo, para
 * a divergencia nao virar surpresa.
 */
function escolherIa(
  preferida: IaDaBusca,
  temAnthropic: boolean,
  temOpenAi: boolean,
): IaDaBusca | null {
  if (preferida === 'anthropic') {
    if (temAnthropic) return 'anthropic';
    return temOpenAi ? 'openai' : null;
  }
  if (temOpenAi) return 'openai';
  return temAnthropic ? 'anthropic' : null;
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
