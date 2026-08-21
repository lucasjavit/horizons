import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SalvarVagaDto, VagaDto } from './job.dto';

/**
 * As vagas que a pessoa guardou.
 *
 * **Ficam para sempre**, fora da regra dos 15 dias que rege as encontradas.
 * Decisão do stakeholder: nada vai para o banco a não ser que ela decida
 * guardar.
 *
 * O que se grava é um **retrato**, não uma referência. Só a URL faria a lista
 * de salvas virar coleção de 404 — a vaga sai do ar em semanas, e é
 * justamente o anúncio que ela vai querer reler antes da entrevista. Com o
 * snapshot, a página cair não apaga a informação, e a afirmação de salário ou
 * elegibilidade continua conferível contra o trecho que a gerou.
 */
@Injectable()
export class SalvasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string): Promise<VagaDto[]> {
    const linhas = await this.prisma.savedJob.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        company: true,
        url: true,
        local: true,
        fonte: true,
        regime: true,
        skills: true,
        area: true,
        anosExp: true,
        benefits: true,
        degree: true,
        logoUrl: true,
        paisIso: true,
        snapshot: true,
        postedAt: true,
        foundAt: true,
      },
      orderBy: { savedAt: 'desc' },
    });
    return linhas.map((v) => paraDto(v));
  }

  /**
   * Salva, ou devolve a que já existe.
   *
   * `upsert` em vez de erro no duplicado: clicar na estrela de uma vaga já
   * salva é engano comum (a tela pode estar desatualizada), e responder 409
   * transformaria um gesto inofensivo em erro na cara da pessoa.
   */
  async salvar(userId: string, dados: SalvarVagaDto): Promise<VagaDto> {
    const comum = {
      title: dados.title,
      company: dados.company,
      local: dados.local ?? null,
      fonte: dados.fonte ?? null,
      regime: dados.regime ?? null,
      skills: dados.skills ?? [],
      area: dados.area ?? null,
      anosExp: dados.anosExp ?? null,
      benefits: dados.benefits ?? [],
      degree: dados.degree ?? null,
      logoUrl: dados.logoUrl ?? null,
      paisIso: dados.paisIso ?? null,
      // Coluna `Json?` recebe `Prisma.DbNull`, nunca `null`.
      snapshot: (dados.snapshot ?? Prisma.DbNull) as Prisma.InputJsonValue,
      postedAt: dados.postedAt ? new Date(dados.postedAt) : null,
      foundAt: dados.foundAt ? new Date(dados.foundAt) : new Date(),
    };

    const salva = await this.prisma.savedJob.upsert({
      where: { userId_url: { userId, url: dados.url } },
      create: { userId, url: dados.url, ...comum },
      // Atualiza o retrato: se a pessoa salvou de novo, a versão nova do
      // anúncio é a que ela está vendo.
      update: comum,
      select: {
        id: true,
        title: true,
        company: true,
        url: true,
        local: true,
        fonte: true,
        regime: true,
        skills: true,
        area: true,
        anosExp: true,
        benefits: true,
        degree: true,
        logoUrl: true,
        paisIso: true,
        snapshot: true,
        postedAt: true,
        foundAt: true,
      },
    });
    return paraDto(salva);
  }

  /**
   * Remove pela URL, e não pelo id.
   *
   * A tela conhece a vaga pela URL — é o `id` que ela usa na lista de
   * resultados. Exigir o id do registro obrigaria a buscar antes de remover,
   * e a estrela precisa desfazer num clique.
   */
  async remover(userId: string, url: string): Promise<void> {
    const { count } = await this.prisma.savedJob.deleteMany({
      where: { userId, url },
    });
    if (count === 0) throw new NotFoundException('Vaga salva nao encontrada');
  }
}

/** A linha do banco no formato que a tela já sabe desenhar. */
function paraDto(v: {
  id: string;
  title: string;
  company: string;
  url: string;
  local: string | null;
  fonte: string | null;
  regime: string | null;
  skills: string[];
  area: string | null;
  anosExp: number | null;
  benefits: string[];
  degree: string | null;
  logoUrl: string | null;
  paisIso: string | null;
  snapshot: unknown;
  postedAt: Date | null;
  foundAt: Date;
}): VagaDto {
  const s = (v.snapshot ?? {}) as {
    salaryMin?: number;
    salaryMax?: number;
    currency?: string;
    salaryTrecho?: string;
    paisesElegiveis?: string[];
    elegivelGlobal?: boolean;
    elegibilidadeTrecho?: string;
  };
  return {
    // A URL é o id que a tela usa, e é o que casa com a lista de resultados —
    // é assim que a estrela sabe que esta vaga já está salva.
    id: v.url,
    title: v.title,
    company: v.company,
    url: v.url,
    local: v.local,
    fonte: v.fonte,
    regime: v.regime,
    skills: v.skills,
    area: v.area,
    anosExp: v.anosExp,
    benefits: v.benefits,
    degree: v.degree,
    logoUrl: v.logoUrl,
    paisIso: v.paisIso,
    salaryMin: s.salaryMin ?? null,
    salaryMax: s.salaryMax ?? null,
    currency: s.currency ?? null,
    salaryTrecho: s.salaryTrecho ?? null,
    paisesElegiveis: s.paisesElegiveis ?? null,
    elegivelGlobal: s.elegivelGlobal ?? false,
    elegibilidadeTrecho: s.elegibilidadeTrecho ?? null,
    // Data cruza a API como string ISO, nunca `Date`.
    postedAt: v.postedAt?.toISOString() ?? null,
    foundAt: v.foundAt.toISOString(),
  };
}
