# JOB-25 · O botão "consegui a vaga 🎉"

**Estado:** pronto para fazer
**Tamanho:** P

## O problema

**O produto funciona quando o usuário vai embora.** Ele acha a vaga, é
contratado, cancela. É estrutural em qualquer produto de emprego.

A primeira ideia foi reduzir a porção — mandar menos vagas por menos dinheiro.
Ela falha por dois motivos:

1. Transforma o **melhor momento da relação** (a pessoa conseguiu emprego) em
   entrega pior. Produto pior por menos dinheiro ainda é produto pior.
2. **O sistema não sabe que ela foi contratada.** Ela não avisa. Inferir do
   comportamento não funciona: quem parou de abrir e-mail pode ter conseguido
   emprego ou ter desistido, e os dois sinais são idênticos.

## A inversão

Quem foi contratado não recebe **menos** — recebe **outra coisa**. Ele parou de
precisar de vaga e passou a precisar de:

- emitir invoice todo mês
- saber se o câmbio compensa receber agora
- saber quanto o mercado paga para o cargo dele hoje
- continuar de olho no mercado sem procurar — **uma vaga por mês, das boas**

Mesmo preço, ou até menor, mas por **valor diferente, não por porção menor**.
A invoice deixa de ser isca e vira o produto de quem já chegou.

## A versão mínima

Um botão no e-mail. Quem clica:

- passa a receber **uma vaga por mês** em vez de toda semana
- vê a **invoice subir ao topo** do produto
- (fase 2) entra no catálogo do lado B como profissional **empregado** — que é
  justamente quem empresa quer

E o Horizons ganha a métrica que vale mais que todas: **quantas pessoas ele
empregou.** É o que vende o produto para o próximo usuário.

## Critérios de aceite

- [ ] O botão está em todo e-mail, e funciona sem login
- [ ] Quem clica muda de cadência, e a tela diz isso claramente
- [ ] Dá para desfazer — voltar a procurar é um clique
- [ ] A métrica de contratados é visível para o admin

## Decidido

**Não baixar o preço de início.** Quem vai cancelar cancela, e desconto na saída
raramente segura. Primeiro descobrir se o plano de invoice se sustenta sozinho.
