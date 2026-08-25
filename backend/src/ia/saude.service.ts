import { Injectable, Logger } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IaService } from './ia.service';
import { PROVEDORES, provedor, provedoresCom, type Capacidade } from './provedores';
import { statusGravado, type StatusDaChave, type Verificacao } from './verificacao';

/** O estado guardado de um provedor, ja lido de volta do banco. */
export interface EstadoDoProvedor {
  provider: ApiProvider;
  status: StatusDaChave;
  httpStatus: number | null;
  detalhe: string;
  /** ISO. `null` quando nunca foi verificado. */
  checkedAt: string | null;
}

/**
 * A saude das chaves de IA: o que esta guardado, e como se guarda.
 *
 * **Separado do `IaService` de proposito.** O `IaService` sabe falar com os
 * provedores; este sabe quando vale a pena falar e o que fazer com a resposta.
 * Misturar os dois faria a cadeia — que roda em toda busca e toda leitura de
 * CV — carregar a persistencia de diagnostico que so a tela de admin usa.
 *
 * ## Quando se verifica (decisao de produto, 25/08/2026)
 *
 * **Ao salvar uma chave: sempre.** E o unico momento em que a pessoa esta
 * esperando por uma resposta sobre aquela chave, e o unico em que o resultado
 * e ambiguo se faltar.
 *
 * **Na carga da tela: nunca.** Seriam seis chamadas reais a cada visita, e nas
 * pagas isso custa dinheiro de verdade — a tela de admin viraria uma torneira
 * aberta. A tela le o que esta guardado e diz QUANDO foi verificado; um
 * resultado velho aparece como "checked yesterday" em vez de fingir frescor,
 * e quem quiser o valor de agora tem o botao `Test all keys`.
 */
@Injectable()
export class SaudeDaIaService {
  private readonly log = new Logger(SaudeDaIaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaService,
  ) {}

  /**
   * O estado de todos os provedores, do banco — sem chamar ninguem.
   *
   * Tres casos, e os tres sao diferentes: sem chave e `sem_chave`; com chave e
   * sem linha gravada e `nao_verificado` (nunca testada — nao e falha dela);
   * com linha, o que a linha diz. Por isso `checkedAt` e anulavel.
   */
  async estado(): Promise<EstadoDoProvedor[]> {
    const [linhas, comChave] = await Promise.all([
      this.prisma.providerCheck.findMany({
        select: {
          provider: true,
          status: true,
          httpStatus: true,
          detalhe: true,
          checkedAt: true,
        },
      }),
      this.ia.comChave('estruturada'),
    ]);
    const porId = new Map(linhas.map((l) => [l.provider, l]));
    const temChave = new Set(comChave);

    return PROVEDORES.map((p) => {
      const linha = porId.get(p.id);
      // Sem chave manda sobre o gravado: uma chave removida depois de um
      // check bem-sucedido nao pode continuar aparecendo como "Working".
      if (!temChave.has(p.id)) {
        return {
          provider: p.id,
          status: 'sem_chave' as const,
          httpStatus: null,
          detalhe: '',
          checkedAt: null,
        };
      }
      // Chave presente e nunca testada. E um estado proprio, e nao `erro`:
      // acusar uma chave que pode estar perfeita mandaria trocar a chave
      // certa. Acontece com chave cadastrada antes desta feature existir.
      if (!linha) {
        return {
          provider: p.id,
          status: 'nao_verificado' as const,
          httpStatus: null,
          detalhe: '',
          checkedAt: null,
        };
      }
      return {
        provider: p.id,
        status: statusGravado(linha.status),
        httpStatus: linha.httpStatus,
        detalhe: linha.detalhe,
        checkedAt: linha.checkedAt.toISOString(),
      };
    });
  }

  /**
   * Verifica um provedor e guarda o resultado. Usado ao salvar uma chave.
   *
   * Nao levanta: uma verificacao que falha e um RESULTADO (a chave nao serve),
   * e nao um erro da operacao de salvar. Quem salva uma chave morta salvou
   * a chave — o que ele precisa e ver o selo vermelho, nao um 500.
   */
  async verificarUm(id: ApiProvider): Promise<EstadoDoProvedor | null> {
    const p = provedor(id);
    // FIRECRAWL cai aqui: esta no enum, nao e provedor de IA, e nao tem
    // dialeto para verificar. Silencio e a resposta certa.
    if (!p) return null;

    const r = await this.ia.verificar(p);
    return this.gravar(r);
  }

  /**
   * Verifica os seis e guarda tudo. E o botao `Test all keys`.
   *
   * Provedor sem chave nao gera linha — nao ha o que guardar sobre uma chave
   * que nao existe, e uma linha `sem_chave` no banco competiria com a
   * ausencia de chave como fonte da verdade.
   */
  async verificarTodos(): Promise<EstadoDoProvedor[]> {
    const resultados = await this.ia.verificarTodos();
    await Promise.all(
      resultados
        .filter((r) => r.status !== 'sem_chave')
        .map((r) => this.gravar(r)),
    );
    this.log.log(
      `verificacao: ${resultados
        .map((r) => `${r.provider}=${r.status}`)
        .join(', ')}`,
    );
    return this.estado();
  }

  /**
   * Quem de fato serve uma capacidade agora.
   *
   * **E a pergunta que o painel de saude responde**, e ela nao e "quem tem
   * chave": e "quem tem chave que FUNCIONA, na ordem em que se tenta". Um
   * provedor com chave recusada nao serve ninguem, mesmo estando no topo.
   *
   * `null` significa que a capacidade nao tem quem a atenda — e ai a tela diz
   * qual uso esta parado, em vez de deixar alguem descobrir clicando.
   */
  quemServe(
    capacidade: Capacidade,
    ordem: readonly ApiProvider[],
    estados: readonly EstadoDoProvedor[],
  ): ApiProvider | null {
    const aptos = new Set(provedoresCom(capacidade).map((p) => p.id));
    const porId = new Map(estados.map((e) => [e.provider, e]));
    for (const id of ordem) {
      if (!aptos.has(id)) continue;
      if (porId.get(id)?.status === 'funcionando') return id;
    }
    return null;
  }

  private async gravar(r: Verificacao): Promise<EstadoDoProvedor> {
    const dados = {
      status: r.status,
      httpStatus: r.httpStatus,
      detalhe: r.detalhe,
      // `@updatedAt` so se move no update; no create o Prisma o preenche.
      // Forcar aqui manteria os dois caminhos com o mesmo instante.
      checkedAt: new Date(),
    };
    const linha = await this.prisma.providerCheck.upsert({
      where: { provider: r.provider },
      create: { provider: r.provider, ...dados },
      update: dados,
      select: {
        provider: true,
        status: true,
        httpStatus: true,
        detalhe: true,
        checkedAt: true,
      },
    });
    return {
      provider: linha.provider,
      status: statusGravado(linha.status),
      httpStatus: linha.httpStatus,
      detalhe: linha.detalhe,
      checkedAt: linha.checkedAt.toISOString(),
    };
  }
}
