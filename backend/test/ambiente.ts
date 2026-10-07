/**
 * O ambiente das suites que precisam de segredo.
 *
 * **Valores de teste, e nunca os de verdade.** Nao se le o `.env` da maquina:
 * a `ENCRYPTION_KEY` real decifra os tokens de IA do stakeholder, e um teste
 * que a carregasse passaria a poder ler — e a falhar na maquina de quem nao a
 * tem, que e o mesmo defeito por outro lado.
 *
 * A consequencia util: o que estes testes cifram **nao se decifra** com a
 * chave de producao, e vice-versa. E a mesma garantia que o `crypto.spec.ts`
 * ja cobre entre salts diferentes.
 *
 * `JWT_SECRET` entra porque o `AuthService` derruba o boot sem ela — de
 * proposito (CLAUDE.md). A camada 3 sobe o `AppModule` inteiro e passaria por
 * esse construtor.
 *
 * ⚠️ **`AUTH_DISABLED` NAO e definida aqui.** As suites de papel exigem o
 * login ligado e falham ruidosamente no modo aberto; fixar a variavel neste
 * arquivo esconderia justamente o que elas existem para detectar.
 */

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY_TESTE ?? 'chave-de-teste-qa03-nao-e-a-de-producao';

process.env.JWT_SECRET =
  process.env.JWT_SECRET_TESTE ?? 'segredo-de-teste-qa03-com-mais-de-16';

// Sem isto o `AuthService` avisa que o login esta indisponivel a cada
// construcao, e a saida do Jest vira ruido. Nao ha login de verdade nos
// testes: quem emite token e a propria suite, com o `JWT_SECRET` acima.
delete process.env.GOOGLE_CLIENT_ID;

/**
 * O segredo da ingestao de vagas rastreadas (JOB-50).
 *
 * Entra aqui pelo mesmo motivo do `JWT_SECRET`: sem ele a rota
 * `POST /ingest/jobs` responde **503** — "este servidor nao tem ingestao
 * configurada" —, e o `fail-closed.e2e.spec.ts`, que percorre as rotas
 * registradas exigindo **401** do anonimo, acusaria a rota de vazar quando o
 * que falta e configuracao.
 *
 * **O 401 continua sendo medido de verdade**, e em dois lugares: aqui, porque
 * com a variavel definida o anonimo bate na comparacao do segredo e leva 401
 * como qualquer outra rota protegida; e no `ingest/ingestao.e2e.spec.ts`, que
 * apaga a variavel de proposito para provar o 503 — inclusive com
 * `AUTH_DISABLED=true`. Definir aqui nao afrouxa nada: troca uma falha por
 * configuracao ausente pela checagem que se quer de fato exercitar.
 *
 * Valor de teste, como os de cima. Nao e o de nenhum servidor de verdade.
 */
process.env.INGEST_TOKEN =
  process.env.INGEST_TOKEN_TESTE ?? 'ingest-token-de-teste-qa03-com-mais-de-32';
