import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecursosService } from '../settings/recursos.service';
import { BuscaService } from './busca.service';
import type { FiltrosDto, VagaDto } from './job.dto';

/**
 * A busca que roda sozinha.
 *
 * **É o que separa este produto de colar a vaga no ChatGPT.** A pessoa pode
 * pedir a análise de um anúncio a qualquer assistente; o que ela não pode é
 * ter alguém varrendo 900 empresas enquanto ela dorme. Sem isto, o produto
 * depende de ela lembrar de voltar.
 *
 * Também resolve o problema que quase matou a feature: uma busca leva ~58s
 * (medido), o que não cabe na paciência de ninguém olhando a tela. Em segundo
 * plano, 58s deixa de ser problema.
 *
 * **Uma rodada por GRUPO, não por pessoa.** Perfis com os mesmos filtros
 * compartilham a assinatura (`grupo`, JOB-02), e a vaga é gravada uma vez
 * para todos. É o que impede N usuários virarem N buscas.
 */

/** De quanto em quanto tempo. Decisão do stakeholder em 13/08. */
const CADA_50_MIN = '0 */50 * * * *';

/** Quantos dias a vaga fica antes de sumir. */
const DIAS_ATE_EXPIRAR = 15;

/**
 * Quantos grupos por rodada.
 *
 * Cada grupo é uma busca de ~1 minuto. Sem teto, 50 grupos levariam quase a
 * hora inteira e a rodada seguinte começaria em cima da anterior.
 */
const GRUPOS_POR_RODADA = 10;

/**
 * Teto de vagas gravadas por grupo, por rodada.
 *
 * Medido em 21/08 pelo QA: um perfil com `filtros: {}` gravou **484 linhas de
 * uma vez**, e a cada 50 minutos faria de novo. Filtro vazio e entrada
 * legitima — a pessoa pode salvar o perfil antes de escolher qualquer coisa —
 * entao o teto tem de estar aqui, e nao na esperanca de que ninguem faca isso.
 *
 * 50 e generoso para uma rodada: quem tem mais que isso de vaga nova em 50
 * minutos nao esta procurando emprego, esta baixando um board inteiro.
 */
const VAGAS_POR_GRUPO = 50;

@Injectable()
export class BuscaAgendadaService {
  private readonly log = new Logger(BuscaAgendadaService.name);
  /** Uma rodada por vez. Sem isto, uma busca lenta acumula com a próxima. */
  private rodando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly recursos: RecursosService,
    private readonly busca: BuscaService,
  ) {}

  @Cron(CADA_50_MIN, { name: 'busca-de-vagas' })
  async rodar(): Promise<void> {
    // A limpeza roda SEMPRE, mesmo com a busca desligada.
    //
    // Levantado pelo QA em 21/08: com a flag off, vaga vencida ficava no banco
    // indefinidamente. Desligar a busca e dizer "nao procure mais", nao "deixe
    // o lixo acumular" — e quem desliga costuma ser justamente quem quer parar
    // de gastar.
    try {
      await this.limparVencidas();
    } catch (e) {
      this.log.error(`limpeza falhou: ${String(e).slice(0, 200)}`);
    }

    const { buscaAgendadaAtiva } = await this.recursos.obter();
    if (!buscaAgendadaAtiva) return;

    if (this.rodando) {
      this.log.warn('rodada anterior ainda em andamento — pulando esta');
      return;
    }
    this.rodando = true;
    try {
      await this.buscarPorGrupo();
    } catch (e) {
      this.log.error(`rodada falhou: ${String(e).slice(0, 300)}`);
    } finally {
      this.rodando = false;
    }
  }

  /**
   * Apaga o que venceu.
   *
   * Vem antes da busca de propósito: se a rodada falhar no meio, ao menos o
   * lixo saiu. Vaga vencida na lista faz a pessoa clicar em link morto, e
   * isso corrói a confiança na ferramenta inteira.
   */
  private async limparVencidas(): Promise<void> {
    const { count } = await this.prisma.foundJob.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) this.log.log(`${count} vagas vencidas apagadas`);
  }

  private async buscarPorGrupo(): Promise<void> {
    // **A fila gira, e por `buscadoEm`, nao por `updatedAt`.**
    //
    // Medido em 21/08 pelo QA: com 15 grupos e teto de 10, os mesmos 10 eram
    // buscados em toda rodada e 5 ficavam de fora PARA SEMPRE — `updatedAt`
    // so muda quando a PESSOA edita o perfil, entao quem salvou e nao mexeu
    // mais nunca receberia vaga. E em silencio: o log dizia "buscando 10" sem
    // dizer quem ficou fora.
    //
    // Ordenando pelo que foi buscado ha mais tempo (nulo primeiro), a fila
    // roda sozinha: quem foi atendido agora vai para o fim.
    const perfis = await this.prisma.jobProfile.findMany({
      where: { ativo: true },
      select: { grupo: true, filtros: true, buscadoEm: true },
      orderBy: [{ buscadoEm: { sort: 'asc', nulls: 'first' } }],
    });
    if (perfis.length === 0) return;

    // Um perfil por grupo — o resto tem os mesmos filtros por definição.
    const porGrupo = new Map<string, FiltrosDto>();
    for (const p of perfis) {
      if (!porGrupo.has(p.grupo)) {
        porGrupo.set(p.grupo, p.filtros as unknown as FiltrosDto);
      }
    }

    const grupos = [...porGrupo.entries()].slice(0, GRUPOS_POR_RODADA);
    const fora = porGrupo.size - grupos.length;
    this.log.log(
      `${perfis.length} perfis em ${porGrupo.size} grupos; buscando ${grupos.length}` +
        (fora > 0 ? ` (${fora} ficam para a proxima rodada)` : ''),
    );

    for (const [grupo, filtros] of grupos) {
      try {
        const achadas = await this.buscarUm(filtros);
        const novas = await this.gravar(grupo, achadas);
        this.log.log(`grupo ${grupo.slice(0, 40)}: ${achadas.length} vagas, ${novas} novas`);
      } catch (e) {
        // Um grupo que falha não derruba os outros: são buscas independentes,
        // e a próxima rodada tenta de novo.
        this.log.error(`grupo ${grupo.slice(0, 40)} falhou: ${String(e).slice(0, 200)}`);
      } finally {
        // Marca mesmo quando falha: um grupo que quebra sempre nao pode
        // travar a fila para os outros — ele volta na proxima volta.
        await this.prisma.jobProfile.updateMany({
          where: { grupo },
          data: { buscadoEm: new Date() },
        });
      }
    }
  }

  /** Consome o gerador de eventos e devolve só as vagas. */
  private async buscarUm(filtros: FiltrosDto): Promise<VagaDto[]> {
    const achadas: VagaDto[] = [];
    for await (const ev of this.busca.buscar(filtros)) {
      if (ev.tipo === 'vaga' && ev.vaga) achadas.push(ev.vaga);
      if (ev.tipo === 'erro') throw new Error(ev.mensagem ?? 'busca falhou');
    }
    return achadas;
  }

  /**
   * Grava as vagas novas do grupo.
   *
   * `skipDuplicates` com a chave `(grupo, url)`: a mesma vaga aparecendo na
   * rodada seguinte não vira linha nova nem sobrescreve a anterior — o
   * `foundAt` original é o que diz "isto é novo desde sua última visita"
   * (JOB-26), e regravar apagaria essa informação.
   */
  private async gravar(grupo: string, vagas: VagaDto[]): Promise<number> {
    if (vagas.length === 0) return 0;
    if (vagas.length > VAGAS_POR_GRUPO) {
      // Dito em voz alta: corte silencioso faz a lista parecer completa.
      this.log.warn(
        `grupo ${grupo.slice(0, 40)}: ${vagas.length} vagas, gravando as ${VAGAS_POR_GRUPO} primeiras`,
      );
    }
    const aGravar = vagas.slice(0, VAGAS_POR_GRUPO);
    const expiresAt = new Date(Date.now() + DIAS_ATE_EXPIRAR * 24 * 60 * 60 * 1000);

    const { count } = await this.prisma.foundJob.createMany({
      data: aGravar.map((v) => ({
        grupo,
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
        // Coluna Json? recebe `Prisma.DbNull`, nunca `null`.
        snapshot: {
          salaryMin: v.salaryMin,
          salaryMax: v.salaryMax,
          currency: v.currency,
          salaryTrecho: v.salaryTrecho,
          paisesElegiveis: v.paisesElegiveis,
          elegivelGlobal: v.elegivelGlobal,
          elegibilidadeTrecho: v.elegibilidadeTrecho,
        } as Prisma.InputJsonValue,
        postedAt: v.postedAt ? new Date(v.postedAt) : null,
        expiresAt,
      })),
      skipDuplicates: true,
    });
    return count;
  }
}
