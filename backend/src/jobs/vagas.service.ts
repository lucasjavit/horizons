import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { FiltrosDto } from './job.dto';
import type { VagaDto } from './job.dto';

const CAMPOS = {
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
} as const;

/**
 * As vagas que a rodada encontrou para o grupo da pessoa.
 *
 * O agrupamento (JOB-02) faz uma rodada servir a varios perfis — o que deixa a
 * feature caber no orcamento, e cria a obrigacao abaixo.
 */
@Injectable()
export class VagasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(userId: string): Promise<VagaDto[]> {
    const perfil = await this.prisma.jobProfile.findUnique({
      where: { userId },
      select: { grupo: true, filtros: true },
    });
    // Sem perfil, mostra o que a rodada achou — a tela e de busca, e uma lista
    // vazia porque falta cadastro seria uma porta fechada onde deveria haver
    // resultado. O perfil, quando existe, RESTRINGE ao grupo dele.
    const achadas = await this.prisma.foundJob.findMany({
      where: {
        ...(perfil ? { grupo: perfil.grupo } : {}),
        // Vaga vencida some da lista mesmo que a limpeza ainda nao tenha
        // rodado: a query nao depende do job de manutencao estar em dia.
        expiresAt: { gt: new Date() },
      },
      select: CAMPOS,
      orderBy: [{ postedAt: 'desc' }, { foundAt: 'desc' }],
      take: 200,
    });

    const filtros = (perfil?.filtros ?? {}) as FiltrosDto;
    return achadas.filter((v) => passaNoFiltro(v, filtros)).map(toDto);
  }
}

/**
 * Os filtros que ficaram FORA da assinatura de grupo, reaplicados aqui.
 *
 * Isto nao e otimizacao: e correcao. `salary_min`, `exclude_keywords` e
 * `posted_within_days` nao entram na assinatura de proposito — se entrassem,
 * "senior React 8k" e "senior React 12k" disparariam duas buscas identicas e o
 * agrupamento perderia a razao de existir.
 *
 * A consequencia e que **duas pessoas do mesmo grupo recebem as mesmas vagas**,
 * e a diferenca entre o que cada uma pediu tem de ser aplicada na exibicao. Sem
 * isto, quem pediu "minimo 12k" recebe vaga de 8k porque outra pessoa do grupo
 * pediu 8k — e a interface estaria mentindo sobre um filtro que ela mesma
 * ofereceu.
 *
 * E o tipo de defeito que nao aparece em teste: a lista carrega, os cartoes sao
 * reais, e so quem conferir salario por salario percebe.
 */
function passaNoFiltro(
  vaga: { title: string; company: string; skills: string[]; postedAt: Date | null; snapshot: unknown },
  filtros: FiltrosDto,
): boolean {
  // Palavra que elimina: bate no titulo, na empresa ou nas skills.
  const excluir = filtros.exclude_keywords ?? [];
  if (excluir.length > 0) {
    const alvo = [vaga.title, vaga.company, ...vaga.skills].join(' ').toLowerCase();
    if (excluir.some((p) => alvo.includes(p.trim().toLowerCase()))) return false;
  }

  // Publicada nos ultimos N dias. Vaga sem data NAO e descartada: ausencia de
  // dado nao e prova de vaga velha, e descartar por isso esconderia vagas boas.
  const dias = filtros.posted_within_days;
  if (dias && vaga.postedAt) {
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    if (vaga.postedAt.getTime() < limite) return false;
  }

  // Salario minimo. Vaga SEM salario publicado continua aparecendo — a maioria
  // nao publica, e filtrar por ausencia esvaziaria a lista. Some so a que
  // publicou um valor e ficou abaixo do pedido.
  const min = filtros.salary_min;
  if (min) {
    const anunciado = salarioAnual(vaga.snapshot);
    if (anunciado !== null && anunciado < min) return false;
  }

  return true;
}

/** O teto anual anunciado, quando o snapshot trouxe um. */
function salarioAnual(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const s = snapshot as { salaryMax?: unknown; salaryMin?: unknown };
  // Compara pelo teto: uma faixa "80k–130k" atende quem pede 120k.
  const valor = s.salaryMax ?? s.salaryMin;
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function toDto(v: {
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
    /** Formato anterior a 20/08. Lido para nao precisar migrar o Json. */
    elegivelBrasil?: boolean;
    paisesElegiveis?: string[];
    elegivelGlobal?: boolean;
    elegibilidadeTrecho?: string;
  };
  return {
    id: v.id,
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
    // Campo ausente permanece ausente: a tela mostra "nao informado" com
    // naturalidade, e nunca um numero inventado.
    salaryMin: s.salaryMin ?? null,
    salaryMax: s.salaryMax ?? null,
    currency: s.currency ?? null,
    salaryTrecho: s.salaryTrecho ?? null,
    // Vaga gravada antes de 20/08 tem `elegivelBrasil` no snapshot, e nao
    // `paisesElegiveis`. Converter na leitura evita migracao de Json.
    paisesElegiveis:
      s.paisesElegiveis ?? (s.elegivelBrasil === true ? ['Brazil'] : null),
    elegivelGlobal: s.elegivelGlobal ?? false,
    elegibilidadeTrecho: s.elegibilidadeTrecho ?? null,
    // Data cruza a API como string ISO, nunca Date.
    postedAt: v.postedAt?.toISOString() ?? null,
    foundAt: v.foundAt.toISOString(),
  };
}
