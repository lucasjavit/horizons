import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RecursosService } from '../settings/recursos.service';
import { BuscaAtsService } from './busca-ats.service';
import { palpitesDeSlug, type EstadoDescoberta } from './descobertas';

/**
 * Tempo 2 do JOB-37: de madrugada, verifica uma por uma.
 *
 * **Verificar e caro e nao pode acontecer enquanto alguem espera** — e por
 * isso que o card separou os dois tempos. Aqui cada descoberta e consultada no
 * ATS de verdade: o slug existe? rende quantas vagas?
 *
 * Roda as 3h porque:
 * - **nao compete com a busca do usuario** pelos mesmos limites dos ATS. Essas
 *   APIs sao gratuitas e sem chave; levar 429 delas quebraria a busca do
 *   produto inteiro, que e o ativo real.
 * - pode ser **lento de proposito** — uma consulta a cada 5s nao irrita
 *   ninguem
 * - se travar, ninguem esta esperando
 *
 * O que ele **nao** faz e gravar em `backend/data/ats/`. Ele classifica; a
 * promocao e humana (`scripts/exportar-descobertas.py`).
 */

/**
 * 3h da manha, todo dia.
 *
 * O unico cron do projeto em horario fixo — os outros dois sao por intervalo
 * (busca a cada 50 min, e-mail de hora em hora). Horario fixo aqui e o ponto:
 * o que este job precisa e nao coincidir com a busca de ninguem.
 */
const AS_TRES_DA_MANHA = '0 0 3 * * *';

/**
 * Quantas descobertas por rodada.
 *
 * A 5s por consulta, 60 leva 5 minutos no pior caso. Sem teto, uma fila de
 * quinhentas descobertas manteria o processo martelando os ATS por quarenta
 * minutos — e o resto volta amanha, que e cedo o bastante para uma decisao
 * humana que ninguem toma no mesmo dia.
 */
const POR_RODADA = 60;

/**
 * O intervalo entre consultas.
 *
 * **E o freio, e nao a lentidao.** As APIs de Greenhouse, Lever e Ashby sao um
 * favor: publicas, sem chave, sem contrato. A busca ao vivo ja usa
 * concorrencia 25 contra elas; um segundo processo batendo ao mesmo tempo e
 * como o teto some. 5s serializado e ~12 req/min de UMA fonte, contra as
 * ~1.500 que a busca faz num pico.
 */
const ENTRE_CONSULTAS_MS = 5_000;

/**
 * De quantos em quantos dias uma descoberta ja classificada e reexaminada.
 *
 * Slug morto pode voltar (empresa reabre o board) e slug confirmado pode
 * morrer. Sem isto a fila esvaziaria para sempre depois da primeira volta, e o
 * numero de vagas na tela — que e o que decide a promocao — envelheceria em
 * silencio.
 */
const REEXAMINAR_APOS_DIAS = 7;

@Injectable()
export class VerificacaoDeAtsService {
  private readonly log = new Logger(VerificacaoDeAtsService.name);
  /** Uma rodada por vez, como a busca agendada. */
  private rodando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly recursos: RecursosService,
    private readonly ats: BuscaAtsService,
  ) {}

  @Cron(AS_TRES_DA_MANHA, { name: 'verificacao-de-ats' })
  async rodar(): Promise<void> {
    const { descobertasAtivas } = await this.recursos.obter();
    if (!descobertasAtivas) return;

    if (this.rodando) {
      this.log.warn('rodada anterior ainda em andamento — pulando esta');
      return;
    }
    this.rodando = true;
    try {
      await this.verificarFila();
    } catch (e) {
      this.log.error(`rodada falhou: ${String(e).slice(0, 300)}`);
    } finally {
      this.rodando = false;
    }
  }

  /**
   * Roda a verificacao agora, sem esperar as 3h.
   *
   * E o que a rota `POST /jobs/descobertas/verificar` chama, e como o QA
   * exercita o cron. **Confere o interruptor aqui**, e nao so em `rodar()`:
   * um recurso desligado que a API ainda obedece nao esta desligado, esta
   * escondido — e isto sai para a rede.
   */
  async verificarAgora(): Promise<{ verificadas: number }> {
    const { descobertasAtivas } = await this.recursos.obter();
    if (!descobertasAtivas) {
      throw new ForbiddenException('A colheita do catalogo esta desligada.');
    }
    return { verificadas: await this.verificarFila() };
  }

  /** Verifica a fila, uma descoberta a cada `ENTRE_CONSULTAS_MS`. */
  private async verificarFila(limite = POR_RODADA): Promise<number> {
    const corte = new Date(Date.now() - REEXAMINAR_APOS_DIAS * 24 * 60 * 60 * 1000);
    // **A fila gira por `checkedAt`, nulo primeiro.** Mesma licao do
    // `buscadoEm` do JobProfile (medida pelo QA em 21/08): ordenar pelo que
    // muda quando a LINHA muda faria as mesmas descobertas serem reexaminadas
    // toda noite e o fim da fila nunca ser alcancado.
    const fila = await this.prisma.atsDiscovery.findMany({
      where: { OR: [{ checkedAt: null }, { checkedAt: { lt: corte } }] },
      select: { id: true, host: true, ats: true, slug: true, empresa: true },
      orderBy: [{ checkedAt: { sort: 'asc', nulls: 'first' } }, { aparicoes: 'desc' }],
      take: limite,
    });
    if (fila.length === 0) {
      this.log.log('fila de descobertas vazia');
      return 0;
    }
    // O catalogo entra na verificacao porque **o slug so aparece aqui**.
    //
    // Medido em 25/08: as tres primeiras descobertas reais — Duolingo, Roblox,
    // Epic Games — sao dominio proprio, entao a captura nao tinha slug para
    // comparar e as anotou. A verificacao adivinhou `duolingo`, `roblox` e
    // `epicgames`, e os tres JA ESTAVAM no catalogo. Sem esta conferencia a
    // fila as mostraria como "confirmada, 479 vagas" para sempre, e quem
    // fosse promover descobriria na mao que nao havia nada a promover.
    const conhecidos = await this.ats.paresConhecidos();
    this.log.log(`verificando ${fila.length} descobertas`);

    let i = 0;
    for (const d of fila) {
      // O freio vem ANTES da consulta e nao depois, para nao ficar um sleep
      // solto no fim da rodada. A primeira nao espera.
      if (i++ > 0) await pausa(ENTRE_CONSULTAS_MS);
      try {
        const r = await this.verificarUma(d.host, d.ats, d.slug, conhecidos);
        await this.prisma.atsDiscovery.update({
          where: { id: d.id },
          data: {
            estado: r.estado,
            vagas: r.vagas,
            slugTestado: r.slugTestado,
            detalhe: r.detalhe.slice(0, 200),
            checkedAt: new Date(),
          },
          select: { id: true },
        });
        this.log.log(
          `${d.host}/${d.slug || '?'} → ${r.estado}` +
            (r.vagas !== null ? ` (${r.vagas} vagas)` : ''),
        );
      } catch (e) {
        // Uma descoberta que falha nao trava a fila: `checkedAt` avanca no
        // `catch`, entao ela vai para o fim e volta na proxima rodada. Sem
        // isto, um host que sempre dá timeout seria eternamente o primeiro da
        // ordenacao e as outras nunca seriam alcancadas.
        this.log.warn(`${d.host} falhou: ${String(e).slice(0, 160)}`);
        await this.prisma.atsDiscovery
          .update({
            where: { id: d.id },
            data: {
              estado: 'desconhecida' satisfies EstadoDescoberta,
              detalhe: String(e).slice(0, 200),
              checkedAt: new Date(),
            },
            select: { id: true },
          })
          .catch(() => undefined);
      }
    }
    return fila.length;
  }

  /**
   * Uma descoberta contra o ATS de verdade.
   *
   * Tres desfechos, e sao os do card:
   * - **confirmada** — o slug existe e rende vagas. `vagas` e o numero que
   *   decide a promocao.
   * - **morta** — o board respondeu, mas com zero vaga. Nao e erro: o catalogo
   *   inteiro tem slug assim, empresa que fechou o board sem apaga-lo.
   * - **desconhecida** — o host nao e um ATS que sabemos consultar, ou o slug
   *   nao existe la. **E o caso que interessa**: pode ser um ATS novo.
   * - **ja_no_catalogo** — o slug que a verificacao adivinhou ja esta na
   *   lista. Nao e descoberta nenhuma; e o host que era desconhecido, nao a
   *   empresa.
   */
  private async verificarUma(
    host: string,
    ats: string | null,
    slug: string,
    conhecidos: Set<string>,
  ): Promise<{ estado: EstadoDescoberta; vagas: number | null; slugTestado: string | null; detalhe: string }> {
    // Sem ATS conhecido nao ha o que consultar. Ainda assim a linha vale: e o
    // contador de aparicoes por HOST que diz se vale escrever um adaptador.
    if (!ats) {
      return {
        estado: 'desconhecida',
        vagas: null,
        slugTestado: null,
        detalhe: `host ${host} nao e um ATS conhecido`,
      };
    }

    // O slug da URL primeiro; depois os palpites tirados do host, para o caso
    // do dominio proprio com `?gh_jid=` (medido: `careers.duolingo.com` →
    // `duolingo` da 80 vagas). Cada palpite e UMA chamada, e sao no maximo
    // dois.
    const tentativas = slug ? [slug] : palpitesDeSlug(host);
    if (tentativas.length === 0) {
      return {
        estado: 'desconhecida',
        vagas: null,
        slugTestado: null,
        detalhe: `nao consegui deduzir um slug de ${host}`,
      };
    }

    let ultimo = '';
    for (const s of tentativas) {
      try {
        const vagas = await this.ats.vagasDoSlug(ats, s);
        if (vagas.length > 0) {
          // O slug responde — mas ja esta no catalogo? Entao o que se
          // descobriu foi um HOST novo para uma empresa velha, e nao ha o que
          // promover. Guarda o numero de vagas assim mesmo: ele diz quanto o
          // catalogo ja alcanca por aquele caminho.
          const estado: EstadoDescoberta = conhecidos.has(`${ats}:${s}`)
            ? 'ja_no_catalogo'
            : 'confirmada';
          return {
            estado,
            vagas: vagas.length,
            slugTestado: s,
            detalhe: estado === 'ja_no_catalogo' ? `${ats}:${s} ja esta no catalogo` : '',
          };
        }
        // Zero vaga com resposta boa: o board existe e esta vazio.
        return { estado: 'morta', vagas: 0, slugTestado: s, detalhe: 'board respondeu sem vaga' };
      } catch (e) {
        ultimo = `${s}: ${String(e).slice(0, 80)}`;
        // 404 no palpite e o esperado — vai para o proximo. Timeout tambem cai
        // aqui, e o `checkedAt` do chamador garante que a linha nao trava a
        // fila.
      }
    }
    return {
      estado: 'desconhecida',
      vagas: null,
      slugTestado: null,
      detalhe: `nenhum slug respondeu (${ultimo})`,
    };
  }
}

/** O freio entre consultas. */
function pausa(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
