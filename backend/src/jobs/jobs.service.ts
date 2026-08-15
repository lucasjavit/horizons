import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assinaturaDoGrupo } from './grupo';
import type { JobProfileDto, SalvarPerfilDto } from './job.dto';

const CAMPOS = {
  id: true,
  filtros: true,
  cvProfile: true,
  grupo: true,
  ativo: true,
  updatedAt: true,
} as const;

/**
 * O perfil de busca: o que a pessoa procura, e o que o job de 50 minutos le.
 *
 * Um por usuario — dai o upsert por `userId`. Salvar de novo substitui, em vez
 * de acumular perfis que ninguem sabe qual esta valendo.
 */
@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(userId: string): Promise<JobProfileDto | null> {
    const perfil = await this.prisma.jobProfile.findUnique({
      where: { userId },
      select: CAMPOS,
    });
    return perfil ? this.toDto(perfil) : null;
  }

  async salvar(userId: string, dados: SalvarPerfilDto): Promise<JobProfileDto> {
    const filtros = dados.filtros as Prisma.InputJsonValue;
    const grupo = assinaturaDoGrupo(dados.filtros);

    // Coluna Json? recebe Prisma.DbNull, nunca null — Prisma 7.
    const cvProfile = dados.cvProfile
      ? (dados.cvProfile as Prisma.InputJsonValue)
      : Prisma.DbNull;
    const ativo = dados.ativo ?? true;

    const perfil = await this.prisma.jobProfile.upsert({
      where: { userId },
      create: { userId, filtros, cvProfile, grupo, ativo },
      update: { filtros, cvProfile, grupo, ativo },
      select: CAMPOS,
    });
    return this.toDto(perfil);
  }

  async remover(userId: string): Promise<void> {
    const perfil = await this.prisma.jobProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!perfil) {
      throw new NotFoundException('Voce ainda nao tem um perfil de busca');
    }
    await this.prisma.jobProfile.delete({ where: { userId } });
  }

  private toDto(p: {
    id: string;
    filtros: Prisma.JsonValue;
    cvProfile: Prisma.JsonValue | null;
    grupo: string;
    ativo: boolean;
    updatedAt: Date;
  }): JobProfileDto {
    return {
      id: p.id,
      filtros: (p.filtros ?? {}) as Record<string, unknown>,
      cvProfile: (p.cvProfile as Record<string, unknown> | null) ?? null,
      grupo: p.grupo,
      ativo: p.ativo,
      // Data cruza a API como string ISO, nunca Date.
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
