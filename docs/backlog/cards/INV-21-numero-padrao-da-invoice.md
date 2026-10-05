# INV-21 · O número da invoice nasce preenchido: `INV-ANO-MÊS`

**Estado:** feito (05/10/2026)
**Tamanho:** P
**Pedido pelo Lucas (05/10/2026).**

## Por quê

`Invoice number` é obrigatório e nascia vazio: toda invoice começava com a
pessoa inventando um número. Quem fatura uma vez por mês usa o mês como número
— então esse é o padrão, e continua sendo um campo de texto comum.

## Decisão

- Rascunho novo (primeira visita e `Start over`) nasce com `INV-AAAA-MM`, do
  mês corrente no fuso local — ex.: `INV-2026-10`.
- **Editável como sempre**: é só o valor inicial do campo, não uma máscara.
- Rascunho já guardado **com número em branco** também ganha o padrão ao abrir.
  O campo é obrigatório, então branco nunca é um estado final válido; e sem
  isso quem já tinha rascunho só veria o padrão depois de `Start over`.
- Rascunho guardado com número preenchido não é tocado.

## Critérios de aceite

- [x] `emptyDraft()` devolve `INV-AAAA-MM` do mês corrente, com zero à esquerda
- [x] Rascunho guardado com número em branco abre com o padrão
- [x] Rascunho guardado com número próprio abre intacto
- [x] O campo aceita edição livre (o padrão não volta enquanto se digita)
- [x] Teste automatizado no `npm test`
