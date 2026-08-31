import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaudeDaIaService } from '../ia/saude.service';
import { cifrar, SALT_TOKENS } from './crypto';
import type { ApiTokenDto } from './settings.dto';

@Injectable()
export class SettingsService {
  private readonly log = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly saude: SaudeDaIaService,
  ) {}

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
      secret: cifrar(limpo, SALT_TOKENS),
      // Ultimos quatro: o suficiente para reconhecer, insuficiente para usar.
      hint: limpo.slice(-4),
    };

    const salvo = await this.prisma.apiToken.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, ...dados },
      update: dados,
      select: { provider: true, hint: true, updatedAt: true },
    });

    // **Verifica ao salvar, sempre** (decisao de produto, 25/08/2026). E o
    // unico momento em que a pessoa esta esperando resposta sobre ESTA chave,
    // e o unico em que o silencio e ambiguo: a tela antiga dizia "stored" para
    // duas chaves mortas. Na carga da tela nao se verifica — seriam seis
    // chamadas reais por visita, e nas pagas isso custa dinheiro.
    //
    // A falha nao sobe: uma chave que nao passa foi salva do mesmo jeito, e o
    // que a pessoa precisa e ver o selo vermelho, nao um 500 no lugar do
    // resultado.
    try {
      await this.saude.verificarUm(provider);
    } catch (e) {
      this.log.warn(
        `nao foi possivel verificar a chave de ${provider}: ${String(e).slice(0, 200)}`,
      );
    }

    return this.toDto(salvo);
  }

  async remove(userId: string, provider: ApiProvider): Promise<void> {
    const apagados = await this.prisma.apiToken.deleteMany({
      where: { userId, provider },
    });
    if (apagados.count === 0) {
      throw new NotFoundException(`Nenhum token guardado para ${provider}`);
    }
    // O resultado guardado morre com a chave: manter "Working" de uma chave
    // removida faria a tela afirmar sobre algo que nao existe mais.
    await this.prisma.providerCheck.deleteMany({ where: { provider } });
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
