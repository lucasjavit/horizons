import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Chaves das flags na tabela de configuracao. */
const LEITURA_CV = 'jobs.leituraCv';
const BUSCA_VAGAS = 'jobs.buscaVagas';

export interface RecursosDto {
  /** A leitura de curriculo esta ligada e funcionando. */
  leituraCvAtiva: boolean;
  /** A busca de vagas esta ligada e funcionando. */
  buscaVagasAtiva: boolean;
  /** Ha token do Firecrawl cadastrado. Sem ele a busca nao pode ser ligada. */
  temChaveFirecrawl: boolean;
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
    const [flagCv, flagBusca, temChave, temFirecrawl] = await Promise.all([
      this.flag(LEITURA_CV),
      this.flag(BUSCA_VAGAS),
      this.temChaveDeIa(),
      this.temChaveFirecrawl(),
    ]);

    // A chave manda: se ela sumiu depois de o recurso ter sido ligado, o
    // recurso esta desligado de fato, e a tela precisa dizer isso — nao
    // mostrar "ligado" e falhar no uso.
    return {
      leituraCvAtiva: flagCv && temChave,
      temChaveDeIa: temChave,
      // Qualquer um dos dois motores serve: Firecrawl abre a pagina inteira,
      // a IA busca na web. Sem nenhum dos dois nao ha de onde tirar vaga.
      buscaVagasAtiva: flagBusca && (temFirecrawl || temChave),
      temChaveFirecrawl: temFirecrawl,
    };
  }

  async definirBuscaVagas(ativa: boolean): Promise<RecursosDto> {
    if (ativa && !(await this.temChaveFirecrawl()) && !(await this.temChaveDeIa())) {
      throw new BadRequestException(
        'Cadastre o token do Firecrawl ou a chave da Anthropic antes de ligar a busca de vagas.',
      );
    }
    await this.gravar(BUSCA_VAGAS, ativa);
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
