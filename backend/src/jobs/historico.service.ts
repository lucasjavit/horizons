import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { HistoricoDto, MarcarVagaDto, VagaMarcadaDto } from './job.dto';

/** Os dois estados que uma vaga pode ter no historico. */
export const ESTADOS = ['visto', 'descartado'] as const;
export type EstadoHistorico = (typeof ESTADOS)[number];

/**
 * O que a pessoa ja viu e o que ela descartou (JOB-26).
 *
 * As tres decisoes de produto deste card, e por que:
 *
 * **1. "Visto" e explicito, e nao automatico.** Marcar como visto tudo que
 * apareceu na tela seria mentira barata: a pessoa rola por 25 vagas e le 3, e
 * o resultado seria esconder 22 vagas que ela nunca leu. Aqui so vira "visto"
 * o que ela ABRIU — clicar no titulo e ir para o anuncio. E o unico gesto na
 * tela que prova atencao, e ele ja acontece de qualquer jeito, entao nao
 * custa um clique a mais a ninguem.
 *
 * **2. Descartar e reversivel.** Um clique errado nao pode esconder uma vaga
 * para sempre. Por isso o registro e uma LINHA COM ESTADO, e nao uma exclusao:
 * `desmarcar` apaga a linha e a vaga volta a ser nova. A tela oferece o
 * desfazer imediato e a lista "Dismissed", que e onde o arrependimento tardio
 * tem para onde ir.
 *
 * **3. Onde aparece:** selo "New" na linha e um filtro de tres estados na
 * busca, e nao uma aba. Uma aba de "vagas vistas" seria um lugar que ninguem
 * visita; o valor do historico esta em mudar a lista que a pessoa JA esta
 * olhando.
 *
 * O historico e por usuario e so o dono le: todo metodo recebe `userId` e ele
 * entra em todo `where`. Nao ha rota que liste o historico de outra pessoa.
 */
@Injectable()
export class HistoricoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Todas as marcas da pessoa, para a tela cruzar com o resultado da busca.
   *
   * Devolve as duas listas de uma vez, e nao uma consulta por vaga: a busca
   * traz ate 200 vagas e perguntar "esta e nova?" uma a uma seriam 200
   * requisicoes para responder o que cabe em duas listas de string.
   *
   * As descartadas vem com titulo e empresa porque a tela precisa MOSTRAR o
   * que foi descartado para poder desfazer — uma lista de URLs cruas nao se
   * reconhece.
   */
  async listar(userId: string): Promise<HistoricoDto> {
    const linhas = await this.prisma.jobHistory.findMany({
      where: { userId },
      select: {
        url: true,
        estado: true,
        title: true,
        company: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      vistas: linhas.filter((l) => l.estado === 'visto').map((l) => l.url),
      descartadas: linhas
        .filter((l) => l.estado === 'descartado')
        .map(
          (l): VagaMarcadaDto => ({
            url: l.url,
            title: l.title,
            company: l.company,
            // Data cruza a API como string ISO, nunca `Date`.
            marcadaEm: l.createdAt.toISOString(),
          }),
        ),
    };
  }

  /**
   * Marca uma vaga como vista ou descartada.
   *
   * `upsert`, e nao `create`: marcar a mesma vaga duas vezes e comum (a pessoa
   * abre o anuncio, volta e abre de novo) e responder 409 transformaria um
   * gesto inofensivo em erro na cara dela — mesmo raciocinio da estrela em
   * `SalvasService`.
   *
   * **Descartar sobrescreve visto, mas visto NAO sobrescreve descartado.** Sao
   * dois gestos de peso diferente: descartar e uma decisao ("nao me mostre
   * mais"), abrir e so passagem. Sem esta regra, abrir o anuncio a partir da
   * lista de descartadas — para conferir antes de restaurar — apagaria o
   * descarte em silencio.
   */
  async marcar(userId: string, dados: MarcarVagaDto): Promise<HistoricoDto> {
    // `@IsNotEmpty` nao apara espaco: `{"url":"   "}` passava a validacao e
    // gravava uma linha que o DELETE nao alcanca — o parametro `?url=%20%20`
    // e aparado antes de chegar aqui, entao a linha ficava orfa para sempre
    // (QA, 24/08).
    const url = dados.url.trim();
    if (url.length === 0) {
      throw new BadRequestException('Informe a url da vaga');
    }

    const estado = dados.estado as EstadoHistorico;

    const atual = await this.prisma.jobHistory.findUnique({
      where: { userId_url: { userId, url: url } },
      select: { estado: true },
    });

    // So nao escreve quando a marca fraca ('visto') chegaria por cima da forte
    // ('descartado'). Qualquer outro caso segue para o upsert.
    if (!(atual?.estado === 'descartado' && estado === 'visto')) {
      await this.prisma.jobHistory.upsert({
        where: { userId_url: { userId, url: url } },
        create: {
          userId,
          url: url,
          estado,
          title: dados.title,
          company: dados.company,
        },
        // O titulo tambem se atualiza: o anuncio pode ter mudado de nome entre
        // uma marca e outra, e o que vale e o que a pessoa esta vendo agora.
        update: { estado, title: dados.title, company: dados.company },
        select: { id: true },
      });
    }

    return this.listar(userId);
  }

  /**
   * Tira a vaga do historico — o desfazer do descarte.
   *
   * Apaga a linha em vez de gravar um terceiro estado ("restaurado"): sem
   * linha, a vaga volta a ser nova, que e exatamente o estado anterior ao
   * clique errado. Um estado a mais so criaria a pergunta de o que fazer com
   * ele na proxima busca.
   */
  async desmarcar(userId: string, url: string): Promise<HistoricoDto> {
    // **`undefined` no `where` do Prisma nao filtra nada — apaga tudo.**
    //
    // Foi o bug medido pelo QA em 21/08 no `DELETE /jobs/saved`, que zerou a
    // lista inteira. Aqui o estrago seria menor (perder o historico nao perde
    // dado da pessoa), mas o custo da checagem e uma linha. A validacao vive
    // no DTO tambem; esta existe porque quem chama o servico pode nao ser o
    // controller.
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new BadRequestException('Informe a url da vaga');
    }

    // `deleteMany` e nao `delete`: apagar o que ja nao existe nao e erro. O
    // estado final desejado (a vaga fora do historico) e o mesmo nos dois
    // casos — e 404 aqui faria o desfazer falhar em duas abas abertas, que foi
    // o defeito que o QA achou na lista de salvas.
    await this.prisma.jobHistory.deleteMany({ where: { userId, url } });

    return this.listar(userId);
  }
}
