import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
      buscaPossivel: (flagFirecrawl && temFirecrawl) || temChave,
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
    if (process.env.ANTHROPIC_API_KEY) return true;
    const token = await this.prisma.apiToken.findFirst({
      where: { provider: ApiProvider.ANTHROPIC },
      select: { id: true },
    });
    return token !== null;
  }
}
