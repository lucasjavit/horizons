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
