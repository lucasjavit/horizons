import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { BuscaSalvaDto, SalvarBuscaDto } from './job.dto';

/**
 * As buscas guardadas do modal de filtros (JOB-41).
 *
 * **Salvar exige sessao, filtrar nao.** Filtrar e anonimo como ler uma aula
 * (PLT-07); guardar precisa de dono. Por isso o `SAVED / My filters` do modal
 * so aparece para quem entrou — mostrar o botao e devolver 401 no clique seria
 * pedir login depois de a pessoa ja ter montado o filtro.
 *
 * O alerta reusa os canais que ja existem: o e-mail do JOB-24 e o Telegram do
 * JOB-32. Uma busca salva e o mesmo envio daqueles cards, com o filtro que a
 * pessoa escolheu em vez do filtro unico de hoje.
 */

/**
 * Quantas buscas uma pessoa pode guardar.
 *
 * Nao e teto de armazenamento — cada linha e um punhado de bytes. E teto de
 * ALERTA: cada busca salva com canal ligado vira um envio periodico, e vinte
 * delas fariam a pessoa receber vinte mensagens e desligar tudo. Chegando no
 * teto, a tela pede para apagar uma.
 */
const TETO_POR_PESSOA = 20;

@Injectable()
export class BuscasSalvasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string): Promise<BuscaSalvaDto[]> {
    const linhas = await this.prisma.savedSearch.findMany({
      where: { userId },
      select: {
        id: true,
        nome: true,
        filtros: true,
        porEmail: true,
        porTelegram: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return linhas.map(paraDto);
  }

  /** Quantas ainda cabem. A tela usa para avisar ANTES de a pessoa montar. */
  async quantas(userId: string): Promise<{ usadas: number; teto: number }> {
    const usadas = await this.prisma.savedSearch.count({ where: { userId } });
    return { usadas, teto: TETO_POR_PESSOA };
  }

  async criar(userId: string, dto: SalvarBuscaDto): Promise<BuscaSalvaDto> {
    const usadas = await this.prisma.savedSearch.count({ where: { userId } });
    if (usadas >= TETO_POR_PESSOA) {
      throw new NotFoundException(
        `Voce ja tem ${TETO_POR_PESSOA} buscas salvas. Apague uma para guardar outra.`,
      );
    }
    const linha = await this.prisma.savedSearch.create({
      data: {
        userId,
        nome: dto.nome.trim(),
        // **`Prisma.DbNull`, nunca `null`** — coluna `Json?` trata os dois de
        // forma diferente, e `null` gravaria o JSON literal `null`.
        filtros: dto.filtros ? (dto.filtros as Prisma.InputJsonValue) : Prisma.DbNull,
        porEmail: dto.porEmail ?? false,
        porTelegram: dto.porTelegram ?? false,
      },
      select: {
        id: true,
        nome: true,
        filtros: true,
        porEmail: true,
        porTelegram: true,
        createdAt: true,
      },
    });
    return paraDto(linha);
  }

  /**
   * Apaga uma busca salva.
   *
   * O `where` leva `userId` junto do `id`: sem ele, um id adivinhado apagaria
   * a busca de outra pessoa. `deleteMany` em vez de `delete` porque aquele
   * aceita o filtro composto e nao lanca quando nada casa — o que permite
   * responder 404 com mensagem nossa.
   */
  async apagar(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.savedSearch.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Busca salva nao encontrada');
  }

  /** Liga ou desliga os canais de alerta de uma busca. */
  async definirCanais(
    userId: string,
    id: string,
    porEmail: boolean,
    porTelegram: boolean,
  ): Promise<BuscaSalvaDto> {
    const { count } = await this.prisma.savedSearch.updateMany({
      where: { id, userId },
      data: { porEmail, porTelegram },
    });
    if (count === 0) throw new NotFoundException('Busca salva nao encontrada');
    const linha = await this.prisma.savedSearch.findFirst({
      where: { id, userId },
      select: {
        id: true,
        nome: true,
        filtros: true,
        porEmail: true,
        porTelegram: true,
        createdAt: true,
      },
    });
    if (!linha) throw new NotFoundException('Busca salva nao encontrada');
    return paraDto(linha);
  }
}

interface Linha {
  id: string;
  nome: string;
  filtros: Prisma.JsonValue;
  porEmail: boolean;
  porTelegram: boolean;
  createdAt: Date;
}

/** Data cruza a API como string ISO, nunca `Date`. */
function paraDto(l: Linha): BuscaSalvaDto {
  return {
    id: l.id,
    nome: l.nome,
    filtros:
      l.filtros && typeof l.filtros === 'object' && !Array.isArray(l.filtros)
        ? (l.filtros as Record<string, unknown>)
        : {},
    porEmail: l.porEmail,
    porTelegram: l.porTelegram,
    createdAt: l.createdAt.toISOString(),
  };
}
