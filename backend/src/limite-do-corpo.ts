/**
 * O limite do corpo JSON da API.
 *
 * ## Por que nao os 100 KB do padrao
 *
 * O body parser do Express aceita **102.400 bytes** por padrao
 * (`body-parser/lib/utils.js:62`). O lote de ingestao do JOB-50 nao cabe:
 * medido em 01/10/2026, com uma vaga realista (8 skills, 4 beneficios,
 * snapshot com salario e trecho), as tres listas com 200 itens cada dao
 * **171,7 KB** — e sozinhas as 200 vagas completas dao 152,9 KB.
 *
 * Nos 100 KB o lote morreria com **413 antes de o `ValidationPipe` rodar**, o
 * que daria ao rastreador um erro que nao explica nada: nem qual lista estourou
 * nem qual teto respeitar.
 *
 * ## Por que 2 MB, e nao 8 nem 50
 *
 * 2 MB da ~11x de folga sobre os 171,7 KB medidos — cabe o lote cheio com
 * vagas bem maiores que a da medicao — e continua sendo um teto de verdade:
 * limite generoso demais transforma uma requisicao em consumo de memoria do
 * processo, e o `ITENS_POR_LISTA` do DTO perderia a conversa com ele.
 *
 * **O numero vive aqui, e nao em `main.ts`, para o teste poder usar o mesmo.**
 * A aplicacao de teste (`test/aplicacao-de-teste.ts`) copia a configuracao de
 * `main.ts` a mao — nao ha como nao copiar, porque importar `main.ts` abriria a
 * porta 3333 no meio do `npm test`. Uma constante compartilhada e o que impede
 * de os dois divergirem: com o numero escrito duas vezes, o 413 apareceria so
 * em producao.
 */
export const LIMITE_DO_CORPO = '2mb';
