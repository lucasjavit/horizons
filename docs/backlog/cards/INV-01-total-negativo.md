# INV-01 · Quantidade negativa gera invoice com total negativo

**Estado:** backlog
**Tamanho:** P

## Por quê

Achado do QA adversarial em 12/08/2026. Uma fatura com total negativo não
existe no mundo real — ou é erro de digitação, ou a pessoa queria um desconto,
que é outra coisa. Hoje o gerador aceita e imprime no PDF sem avisar.

## O que

Decidir o que fazer com quantidade ou valor negativo, e aplicar.

Três saídas possíveis, para você escolher:

1. **Rejeitar** — negativo é erro de validação, com mensagem no campo.
2. **Aceitar como desconto** — permitir valor negativo, e o PDF mostra a linha
   como desconto. Mais trabalho, mas resolve um caso legítimo (crédito de mês
   anterior, abatimento acordado).
3. **Aceitar em silêncio** — manter como está, assumindo que quem digitou
   sabe o que quer.

## Critério de aceite

Depende da escolha acima. Para a opção 1:

- [ ] Quantidade negativa marca o campo como inválido, com mensagem
- [ ] Valor negativo idem
- [ ] O botão de baixar não gera PDF enquanto houver linha negativa
- [ ] O erro segue o padrão da casa: borda + `aria-invalid` + texto

## Como reproduzir hoje

1. Abrir `/invoice`
2. Preencher os obrigatórios
3. Numa linha, quantidade `-5` e valor `100`

Esperado: rejeitar, ou tratar como desconto explícito
Obtido: linha `-$500.00`, total `-$500.00`, PDF gerado normalmente

## Observações

`money.ts` já trata o sinal de propósito (`parseAmountToCents` tem
`const sinal = m[1] === '-' ? -1 : 1`), então a opção 2 é mais barata do que
parece — a matemática já funciona; falta a decisão e a apresentação.
