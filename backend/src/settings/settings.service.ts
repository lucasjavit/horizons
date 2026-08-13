import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cifrar } from './crypto';
import type { ApiTokenDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ApiTokenDto[]> {
    const linhas = await this.prisma.apiToken.findMany({
      where: { userId },
      select: { provider: true, hint: true, updatedAt: true },
      orderBy: { provider: 'asc' },
    });
    return linhas.map((l) => this.toDto(l));
  }

  async setToken(
    userId: string,
    provider: ApiProvider,
    token: string,
  ): Promise<ApiTokenDto> {
    const limpo = token.trim();
    const dados = {
      secret: cifrar(limpo),
      // Ultimos quatro: o suficiente para reconhecer, insuficiente para usar.
      hint: limpo.slice(-4),
    };

    const salvo = await this.prisma.apiToken.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, ...dados },
      update: dados,
      select: { provider: true, hint: true, updatedAt: true },
    });
    return this.toDto(salvo);
  }

  async remove(userId: string, provider: ApiProvider): Promise<void> {
    const apagados = await this.prisma.apiToken.deleteMany({
      where: { userId, provider },
    });
    if (apagados.count === 0) {
      throw new NotFoundException(`Nenhum token guardado para ${provider}`);
    }
  }

  private toDto(linha: {
    provider: ApiProvider;
    hint: string;
    updatedAt: Date;
  }): ApiTokenDto {
    return {
      provider: linha.provider,
      hint: linha.hint,
      updatedAt: linha.updatedAt.toISOString(),
    };
  }
}
