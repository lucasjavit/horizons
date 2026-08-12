# INV-01 · Quantidade negativa gera invoice com total negativo

**Estado:** pronto para fazer
**Tamanho:** P
**Decisão do stakeholder (12/08/2026):** rejeitar. Não permitir valor
negativo — nem na quantidade, nem no valor unitário.

## Por quê

Achado do QA adversarial em 12/08/2026. Uma fatura com total negativo não
existe no mundo real — ou é erro de digitação, ou a pessoa queria um desconto,
que é outra coisa. Hoje o gerador aceita e imprime no PDF sem avisar.

## O que

Rejeitar valor negativo, na quantidade e no valor unitário. A decisão foi
tomada: linha de desconto ficou de fora por ora — se aparecer a necessidade
real, vira card próprio.

## Critério de aceite

- [ ] Quantidade negativa marca o campo como inválido, com mensagem
- [ ] Valor unitário negativo idem
- [ ] O botão de baixar não gera PDF enquanto houver linha negativa
- [ ] O erro segue o padrão da casa: borda + `aria-invalid` + texto
- [ ] O erro aparece no blur, não enquanto a pessoa digita pela primeira vez
      (é o padrão do formulário)

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
