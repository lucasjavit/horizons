import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Chave da flag na tabela de configuracao. */
const LEITURA_CV = 'jobs.leituraCv';

export interface RecursosDto {
  /** A leitura de curriculo esta ligada e funcionando. */
  leituraCvAtiva: boolean;
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
    const [flag, temChave] = await Promise.all([
      this.prisma.appSetting.findUnique({
        where: { chave: LEITURA_CV },
        select: { valor: true },
      }),
      this.temChaveDeIa(),
    ]);

    // A chave manda: se ela sumiu depois de o recurso ter sido ligado, o
    // recurso esta desligado de fato, e a tela precisa dizer isso — nao
    // mostrar "ligado" e falhar no upload.
    return {
      leituraCvAtiva: flag?.valor === 'true' && temChave,
      temChaveDeIa: temChave,
    };
  }

  async definirLeituraCv(ativa: boolean): Promise<RecursosDto> {
    if (ativa && !(await this.temChaveDeIa())) {
      throw new BadRequestException(
        'Cadastre uma chave da Anthropic ou da OpenAI antes de ligar a leitura de curriculo.',
      );
    }
    const valor = ativa ? 'true' : 'false';
    await this.prisma.appSetting.upsert({
      where: { chave: LEITURA_CV },
      create: { chave: LEITURA_CV, valor },
      update: { valor },
      select: { chave: true },
    });
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
