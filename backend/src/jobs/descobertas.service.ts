import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecursosService } from '../settings/recursos.service';
import { BuscaAtsService } from './busca-ats.service';
import { extrair } from './descobertas';
import type { VagaDto } from './job.dto';

/**
 * Tempo 1 do JOB-37: a busca so ANOTA.
 *
 * **Efeito colateral, nunca caminho critico.** A busca ja leva ~58s; se a
 * captura falhar ou demorar, a vaga entra do mesmo jeito. Por isso o metodo
 * publico nao lanca nunca e nao devolve nada que o chamador precise esperar
 * para seguir — quem chama faz `void` e continua.
 *
 * **Nenhuma chamada de rede.** Host e slug saem da propria URL da vaga, que ja
 * esta em memoria. A unica ida ao banco e a gravacao, e ela e em lote: uma
 * transacao por busca, nao uma por vaga.
 */

/**
 * Teto de descobertas gravadas por busca.
 *
 * Uma busca traz ate ~200 empresas. Sem teto, a primeira busca com o catalogo
 * desatualizado gravaria centenas de linhas de uma vez — e a fila de
 * verificacao, que anda a uma consulta a cada 5s, levaria horas so para
 * digerir uma rodada. O que ficou de fora volta na proxima busca.
 */
const POR_BUSCA = 40;

/** Quanto do nome da empresa e do detalhe cabe numa linha. */
const CORTE = 200;

/**
 * Um host, com o que a fila aprendeu sobre ele.
 *
 * **Agrupado por HOST, e nao por empresa** — e o card inteiro nesta escolha.
 * Tres empresas em `app.careerpuck.com` valem mais que trinta em
 * `job-boards.greenhouse.io`: as primeiras revelam um ATS por descobrir, as
 * segundas so confirmam o que ja se sabe.
 */
export interface HostDescobertoDto {
  host: string;
  /** `greenhouse` | `lever` | `ashby`, ou `null` quando nao se sabe consultar. */
  ats: string | null;
  /** Quantos slugs distintos deste host ja apareceram. */
  slugs: number;
  /** Soma das aparicoes de todos os slugs deste host. */
  aparicoes: number;
  /**
   * Soma das vagas que os slugs confirmados deste host renderam.
   *
   * **E o numero que decide** se vale escrever um adaptador. Zero significa
   * "nada verificado ainda" ou "nada rendeu" — as duas coisas dizem a mesma
   * coisa a quem decide: nao ha caso ainda.
   */
  vagas: number;
  /** Quantos slugs em cada estado, para a linha ser lida de relance. */
  confirmadas: number;
  mortas: number;
  desconhecidas: number;
  novas: number;
  /**
   * Slugs que a verificacao achou, mas que o catalogo ja tinha.
   *
   * **Nao e descoberta.** O que era novo era o HOST, nao a empresa: Duolingo
   * publica em `careers.duolingo.com` e ja esta no catalogo como
   * `greenhouse:duolingo`. Contado a parte para nao inflar `confirmadas`, que
   * e o numero que decide a promocao.
   */
  jaNoCatalogo: number;
  /** Uma URL de exemplo, para quem for decidir poder abrir e olhar. */
  exemploUrl: string;
  /** Quando o host foi verificado pela ultima vez, ISO. `null` = nunca. */
  checkedAt: string | null;
}

@Injectable()
export class DescobertasService {
  private readonly log = new Logger(DescobertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recursos: RecursosService,
    private readonly ats: BuscaAtsService,
  ) {}

  /**
   * Anota o que estas vagas ensinaram sobre o catalogo.
   *
   * **Nao lanca.** Todo o corpo esta num try/catch que so registra — a captura
   * e efeito colateral da busca, e uma falha aqui nao pode chegar a quem
   * esperava as vagas.
   */
  async anotar(vagas: readonly VagaDto[]): Promise<void> {
    try {
      if (!(await this.recursos.obter()).descobertasAtivas) return;
      await this.gravar(vagas);
    } catch (e) {
      // `warn` e nao `error`: nada se perdeu do ponto de vista de quem buscou,
      // e a proxima busca reencontra as mesmas empresas.
      this.log.warn(`captura de descobertas falhou: ${String(e).slice(0, 200)}`);
    }
  }

  /**
   * A fila agrupada por host, ordenada por vagas rendidas.
   *
   * Tempo 3 do card: **promover e decisao humana**. Esta lista e o insumo dela,
   * e nada aqui grava em `backend/data/ats/` — o que faz isso e
   * `scripts/exportar-descobertas.py`, rodado a mao.
   */
  async porHost(): Promise<HostDescobertoDto[]> {
    const linhas = await this.prisma.atsDiscovery.findMany({
      select: {
        host: true,
        ats: true,
        aparicoes: true,
        estado: true,
        vagas: true,
        exemploUrl: true,
        checkedAt: true,
      },
      orderBy: { aparicoes: 'desc' },
    });

    const porHost = new Map<string, HostDescobertoDto>();
    for (const l of linhas) {
      let h = porHost.get(l.host);
      if (!h) {
        h = {
          host: l.host,
          ats: l.ats,
          slugs: 0,
          aparicoes: 0,
          vagas: 0,
          confirmadas: 0,
          mortas: 0,
          desconhecidas: 0,
          novas: 0,
          jaNoCatalogo: 0,
          exemploUrl: l.exemploUrl,
          checkedAt: null,
        };
        porHost.set(l.host, h);
      }
      h.slugs++;
      h.aparicoes += l.aparicoes;
      h.vagas += l.vagas ?? 0;
      if (l.estado === 'confirmada') h.confirmadas++;
      else if (l.estado === 'ja_no_catalogo') h.jaNoCatalogo++;
      else if (l.estado === 'morta') h.mortas++;
      else if (l.estado === 'desconhecida') h.desconhecidas++;
      else h.novas++;
      // O mais recente do host: e o que responde "isto ainda vale?".
      const iso = l.checkedAt?.toISOString() ?? null;
      if (iso && (h.checkedAt === null || iso > h.checkedAt)) h.checkedAt = iso;
    }

    // Por vagas rendidas, como o criterio de aceite pede — mas **quem so tem
    // slug ja catalogado vai para o fim**. Sem isso, `careers.roblox.com` com
    // 235 vagas lideraria a lista sem haver nada a promover, e a leitura da
    // tela seria exatamente a errada: parece o maior achado e e o menor.
    // Desempate por aparicoes: um host ainda nao verificado pode ser o mais
    // promissor, e ordenar so por `vagas` o esconderia no fim.
    const promovivel = (h: HostDescobertoDto): number =>
      h.confirmadas > 0 || h.novas > 0 || h.desconhecidas > 0 ? 1 : 0;
    return [...porHost.values()].sort(
      (a, b) =>
        promovivel(b) - promovivel(a) || b.vagas - a.vagas || b.aparicoes - a.aparicoes,
    );
  }

  private async gravar(vagas: readonly VagaDto[]): Promise<void> {
    if (vagas.length === 0) return;
    const conhecidos = await this.ats.paresConhecidos();

    // Agrupa ANTES de ir ao banco: dez vagas do mesmo board sao uma descoberta
    // com dez aparicoes, e nao dez upserts na mesma linha.
    const novos = new Map<
      string,
      { host: string; ats: string | null; slug: string; empresa: string; url: string; n: number }
    >();

    for (const v of vagas) {
      const d = extrair(v.url);
      if (!d) continue;
      // Slug conhecido nao e descoberta. **Contar quem ja se conhece e outro
      // card** — o proprio JOB-37 o separa: diria quais das 26 mil empresas de
      // fato publicam, que e uma pergunta diferente de "o que falta na lista".
      if (d.ats && d.slug && conhecidos.has(`${d.ats}:${d.slug}`)) continue;
      const chave = `${d.host}|${d.slug}`;
      const ja = novos.get(chave);
      if (ja) {
        ja.n++;
        continue;
      }
      novos.set(chave, {
        host: d.host,
        ats: d.ats,
        slug: d.slug,
        empresa: (v.company || d.slug || d.host).slice(0, CORTE),
        url: v.url.slice(0, 500),
        n: 1,
      });
    }

    if (novos.size === 0) return;

    const lista = [...novos.values()].slice(0, POR_BUSCA);
    if (novos.size > lista.length) {
      // Dito em voz alta: corte silencioso faria a fila parecer completa.
      this.log.warn(
        `${novos.size} descobertas nesta busca, gravando as ${lista.length} primeiras`,
      );
    }

    for (const d of lista) {
      // Um upsert por linha, e nao `createMany`: o caso comum e a descoberta
      // ja existir, e o que interessa entao e o CONTADOR — `createMany` com
      // `skipDuplicates` descartaria a aparicao em silencio.
      await this.prisma.atsDiscovery.upsert({
        where: { host_slug: { host: d.host, slug: d.slug } },
        create: {
          host: d.host,
          ats: d.ats,
          slug: d.slug,
          empresa: d.empresa,
          exemploUrl: d.url,
          aparicoes: d.n,
        },
        // Nao mexe em `estado`, `vagas` nem `checkedAt`: reaparecer nao apaga
        // o que a verificacao ja concluiu. Uma descoberta ja marcada `morta`
        // que volta a aparecer continua morta ate o cron reexaminar.
        update: { aparicoes: { increment: d.n } },
        select: { id: true },
      });
    }
    this.log.log(`${lista.length} descobertas anotadas`);
  }
}
