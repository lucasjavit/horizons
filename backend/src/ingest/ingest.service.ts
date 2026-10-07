import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { lerElegibilidade } from '../jobs/elegibilidade';
import type { VagaDto } from '../jobs/job.dto';
import type {
  LoteDeIngestaoDto,
  ReferenciaDeVagaDto,
  ResultadoDaIngestaoDto,
  VagaRastreadaDto,
} from './ingest.dto';

/**
 * Depois de quantos dias sem confirmacao a vaga e apagada.
 *
 * 7 e a **sugestao do JOB-49, nao um numero medido** — e o card diz isso em
 * voz alta. O que ele protege: o rastreador que para de falar (deploy longo,
 * banco cheio, bug) nao pode deixar a busca servindo vaga morta para sempre.
 *
 * Configuravel por `INGEST_DIAS_SEM_CONFIRMACAO` justamente porque o numero
 * certo so aparece quando o rastreador existir (JOB-51) e der para medir a
 * frequencia real das rodadas. Variavel de ambiente e nao `AppSetting`: isto
 * nao e interruptor de produto que alguem mexe pela tela, e sim o prazo de um
 * contrato entre duas aplicacoes.
 */
export const DIAS_SEM_CONFIRMACAO_PADRAO = 7;

/**
 * Quanto tempo a transacao do lote pode durar, em ms (JOB-54).
 *
 * ## Os numeros, medidos e nao chutados (06/10/2026, maquina de 4 nucleos)
 *
 * O `upsert` roda num laco — 200 idas ao banco no teto do lote —, entao a
 * pergunta do card era se isso cabe no padrao do Prisma (`timeout: 5s`):
 *
 * | Cenario | Pior lote |
 * | --- | --- |
 * | 1 lote de 200: create + confirmar 200 + fechar 200 | **773 ms** |
 * | o mesmo lote de novo (so update) | 384 ms, 334 ms |
 * | **6 lotes de 200 em paralelo** (o pior caso do review do JOB-50) | **1.608 ms** |
 *
 * Cabe nos 5s do padrao — mas com ~3x de folga no caso de 6 em paralelo, e so
 * nesta maquina, com este banco, sem mais nada rodando. Um lote que estoure o
 * timeout nao degrada: ele **aborta e devolve 500**, e o rastreador reenvia
 * para sempre. Entao o numero e explicito e generoso: 30s e ~19x o pior caso
 * medido, e continua sendo um teto de verdade — transacao presa mais que isso e
 * banco em apuros, nao lote grande.
 *
 * Nao se resolve trocando o laco por `createMany`: o card do JOB-50 ja mediu
 * que `createMany({ skipDuplicates })` **nao atualiza** a vaga que mudou de
 * titulo, e o criterio de aceite e *"atualiza, nao duplica"*.
 */
export const TEMPO_DA_TRANSACAO = 30_000;

/**
 * Quanto esperar por uma conexao livre do pool antes de desistir, em ms.
 *
 * **O limite mais provavel de morder, e nao o `timeout`.** O padrao do Prisma e
 * `maxWait: 2s`; com varios lotes concorrentes (o review do JOB-50 mediu 6 em
 * paralelo como caso real) a transacao que chega por ultimo espera no pool sem
 * ter comecado a trabalhar, e um 500 ali seria indistinguivel de lote invalido
 * para quem le a resposta. 10s da margem sem esconder saturacao de verdade.
 */
export const ESPERA_POR_CONEXAO = 10_000;

/**
 * O client de dentro da transacao, como o `$transaction` interativo o entrega.
 *
 * Tipo nomeado e nao `any`: as tres etapas recebem este `tx` em vez de
 * `this.prisma`, e **e justamente essa troca que a transacao depende**. Com
 * `any`, um `this.prisma` esquecido num dos metodos compilaria — e aquela
 * etapa voltaria a ter commit proprio, por fora da transacao, que e o defeito
 * que o JOB-54 corrigiu. Aqui o compilador nao deixa confundir os dois.
 *
 * Derivado do proprio `$transaction` e nao escrito a mao (um `Omit<PrismaService,
 * …>` nao compila: o `PrismaService` carrega `onModuleInit`/`onModuleDestroy`,
 * que o `tx` nao tem). Assim o tipo acompanha a versao do Prisma sozinho.
 */
type PrismaTransacao = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/** Le o prazo do ambiente, caindo no padrao quando ausente ou absurdo. */
export function diasSemConfirmacao(): number {
  const bruto = Number(process.env.INGEST_DIAS_SEM_CONFIRMACAO);
  // `Number('')` e 0 e `Number('abc')` e NaN — os dois cairiam para o padrao,
  // mas um 0 aceito apagaria o acervo inteiro na primeira limpeza.
  if (!Number.isFinite(bruto) || bruto < 1) return DIAS_SEM_CONFIRMACAO_PADRAO;
  return Math.floor(bruto);
}

/**
 * Recebe os lotes do rastreador e mantem a copia local (JOB-50).
 *
 * ## Por que a elegibilidade e calculada AQUI
 *
 * O rastreador nao conhece regra do Horizons (JOB-49, "quem e dono de que"):
 * ele le o ATS e repassa o que o anuncio diz. A pergunta "esta vaga aceita
 * quem mora onde eu moro?" e regra de produto, e sai de `lerElegibilidade`
 * sobre o `local` **cru** que veio no lote.
 *
 * Isso tem duas consequencias boas e uma obrigacao:
 *
 * - mudar a regra nao exige reenviar nada;
 * - o rastreador **nao pode afirmar** quem a vaga aceita — e dado de terceiro;
 * - o `snapshot` que o lote traz e sobrescrito nos campos de elegibilidade,
 *   mesmo que o rastreador os tenha mandado. O teste prova exatamente isso.
 */
@Injectable()
export class IngestService {
  private readonly log = new Logger(IngestService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aplica um lote. **Idempotente por construcao**: o mesmo lote duas vezes
   * deixa o banco no mesmo estado.
   *
   * A ordem das tres listas e `upsert` → `confirmar` → `fechar`, e nao e
   * arbitraria: `fechar` por ultimo faz um lote incoerente (a mesma vaga no
   * `upsert` e no `fechar`) terminar FECHADA, que e o desfecho seguro — a vaga
   * sai da busca em vez de ficar servindo link morto. O inverso deixaria a
   * vaga gravada depois de o ATS dizer que ela nao existe mais.
   *
   * ## ⚠️ Uma transacao, e e o contrato do JOB-49 que depende dela (JOB-54)
   *
   * Antes do JOB-54 as tres chamadas tinham **commit proprio cada uma**, e uma
   * falha no meio deixava o banco pela metade com resposta 500. Medido em
   * 06/10/2026, com `[ok-antes, NUL, ok-depois]` no `upsert`: **500, e so
   * `ok-antes` no banco**. Provado tambem com `upsert` valido + `fechar` com
   * NUL — a vaga nova ficou gravada E o `confirmadaEm` avancou, com 500.
   *
   * Por que isso e grave e nao feio: o rastreador tira os itens da fila **pela
   * resposta** (JOB-49, decisao 9). Num 500 ele nao sabe o que entrou —
   * reenviar re-executa o que ja foi, e o `fechar` de um lote que explodiu no
   * meio nao sabe quais vagas ja sairam. Com a transacao a resposta volta a ser
   * verdadeira: **ou o lote entrou, ou nao entrou.**
   *
   * A transacao e interativa (`async (tx) => …`) e nao a forma de array porque
   * as tres etapas sao sequenciais e cada uma devolve a contagem que vai na
   * resposta.
   */
  async aplicar(lote: LoteDeIngestaoDto): Promise<ResultadoDaIngestaoDto> {
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const gravadas = await this.gravar(tx, lote.upsert ?? []);
        const confirmadas = await this.confirmar(tx, lote.confirmar ?? []);
        const fechadas = await this.fechar(tx, lote.fechar ?? []);
        return { gravadas, confirmadas, fechadas };
      },
      { timeout: TEMPO_DA_TRANSACAO, maxWait: ESPERA_POR_CONEXAO },
    );

    this.log.log(
      `lote aplicado: ${resultado.gravadas} gravadas, ${resultado.confirmadas} confirmadas, ` +
        `${resultado.fechadas} fechadas`,
    );
    return resultado;
  }

  /**
   * Grava as vagas completas, uma por uma, por `(fonte, idExterno)`.
   *
   * **`upsert` do Prisma num laco, e nao `createMany({ skipDuplicates })`.** O
   * `createMany` ignora a duplicata em vez de atualizar — a vaga que mudou de
   * titulo ou de salario ficaria com o conteudo da primeira vez para sempre, e
   * o `confirmadaEm` nunca avancaria. O card pede *"atualiza, nao duplica"*.
   *
   * N consultas e aceitavel aqui: o teto e 200 por chamada, e quem espera e um
   * processo em segundo plano, nao uma pessoa.
   */
  private async gravar(tx: PrismaTransacao, vagas: VagaRastreadaDto[]): Promise<number> {
    let gravadas = 0;
    for (const v of vagas) {
      const dados = this.paraBanco(v);
      await tx.trackedJob.upsert({
        where: { fonte_idExterno: { fonte: v.fonte, idExterno: v.idExterno } },
        // `createdAt` fica de fora do update de proposito: ele diz quando a
        // vaga entrou no acervo, e regrava-lo faria vaga antiga parecer nova.
        create: dados,
        update: dados,
        select: { id: true },
      });
      gravadas += 1;
    }
    return gravadas;
  }

  /**
   * Atualiza so `confirmadaEm` — a vaga continua aberta e nao mudou.
   *
   * `updateMany` com `OR` das chaves, numa consulta: sao ate 200 ids, e o
   * laco de `update` individual seria 200 idas ao banco para mexer numa
   * coluna. **E `updateMany` tambem porque id inexistente nao pode dar erro**:
   * o `update` singular estoura `P2025`, e reenvio de lote e o caso normal.
   */
  private async confirmar(tx: PrismaTransacao, refs: ReferenciaDeVagaDto[]): Promise<number> {
    if (refs.length === 0) return 0;
    const { count } = await tx.trackedJob.updateMany({
      where: { OR: refs.map((r) => ({ fonte: r.fonte, idExterno: r.idExterno })) },
      data: { confirmadaEm: new Date() },
    });
    return count;
  }

  /**
   * **Apaga** a linha da vaga fechada (JOB-49, decisao 6).
   *
   * ⚠️ **Nao toca em `SavedJob` nem em `JobHistory`, e isso e o ponto.** O que
   * a pessoa salvou e um RETRATO independente (`SavedJob` copia o anuncio
   * inteiro; `JobHistory` guarda so a URL), e nenhum dos dois referencia esta
   * tabela — nao ha FK, por desenho, e a migration tambem nao cria nenhuma.
   * Um `deleteMany` aqui nao alcanca o que e do usuario.
   *
   * **Fechar id que nao existe e SUCESSO.** `deleteMany` casa zero linhas e
   * devolve `count: 0`; o `delete` singular estouraria `P2025` e faria o
   * rastreador reenviar para sempre um lote que ja foi aplicado.
   */
  private async fechar(tx: PrismaTransacao, refs: ReferenciaDeVagaDto[]): Promise<number> {
    if (refs.length === 0) return 0;
    const { count } = await tx.trackedJob.deleteMany({
      where: { OR: refs.map((r) => ({ fonte: r.fonte, idExterno: r.idExterno })) },
    });
    return count;
  }

  /**
   * Apaga a vaga que o rastreador nao menciona ha N dias.
   *
   * **Nao e a mesma coisa que fechar.** Fechar e o ATS dizendo "a vaga saiu";
   * isto e o Horizons dizendo "ninguem me fala desta vaga ha uma semana, nao
   * tenho como afirmar que ela existe". Sem este prazo, o rastreador que para
   * de falar deixa a busca servindo link morto indefinidamente.
   *
   * Metodo publico porque e o que o cron chama e o que o teste exercita com
   * datas controladas — esperar sete dias nao e teste.
   */
  async limpar(agora = new Date()): Promise<{ apagadas: number }> {
    const dias = diasSemConfirmacao();
    const limite = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.trackedJob.deleteMany({
      // `lt` e nao `lte`: a vaga confirmada exatamente no limite fica. Numa
      // fronteira, poupar e o lado certo de errar — apagar vaga boa e perda
      // visivel; guardar uma hora a mais nao e.
      where: { confirmadaEm: { lt: limite } },
    });
    if (count > 0) {
      this.log.log(`limpeza: ${count} vaga(s) sem confirmacao ha ${dias} dia(s)`);
    }
    return { apagadas: count };
  }

  /**
   * Traduz o item do lote para a linha do banco, calculando a elegibilidade.
   *
   * O `lerElegibilidade` espera um `VagaDto` e le dele **so `local` e
   * `regime`** (ver `jobs/elegibilidade.ts`). O objeto montado aqui e parcial
   * e tipado como tal: um `as VagaDto` calaria o compilador sobre um campo que
   * passasse a ser lido amanha, e a elegibilidade erraria em silencio.
   */
  private paraBanco(v: VagaRastreadaDto): Prisma.TrackedJobCreateInput {
    const entrada: Pick<VagaDto, 'local' | 'regime'> = {
      local: v.local ?? null,
      regime: v.regime ?? null,
    };
    const eleg = lerElegibilidade(entrada as VagaDto);

    // O que o rastreador mandou no snapshot e preservado, **menos** os campos
    // de elegibilidade: aqueles sao recalculados e sobrescritos sempre. A
    // ordem do spread e o que garante isso, e inverter seria confiar no
    // terceiro.
    const snapshot: Prisma.InputJsonValue = {
      ...(v.snapshot ?? {}),
      paisesElegiveis: eleg.paises,
      elegivelGlobal: eleg.global,
      elegibilidadeTrecho: eleg.trecho,
      elegibilidadePrecisaLer: eleg.precisaLer,
    };

    return {
      fonte: v.fonte,
      idExterno: v.idExterno,
      title: v.title,
      company: v.company,
      url: v.url,
      local: v.local ?? null,
      regime: v.regime ?? null,
      skills: v.skills ?? [],
      area: v.area ?? null,
      anosExp: v.anosExp ?? null,
      benefits: v.benefits ?? [],
      degree: v.degree ?? null,
      logoUrl: v.logoUrl ?? null,
      paisIso: v.paisIso ?? null,
      snapshot,
      postedAt: v.postedAt ? new Date(v.postedAt) : null,
      // Toda mencao confirma: criar, atualizar ou reconfirmar (JOB-49).
      confirmadaEm: new Date(),
    };
  }
}
