# INV-11 · Vírgula como decimal multiplica o valor por 100

**Estado:** feito (13/08/2026)
**Tamanho:** P
**Achado pelo stakeholder (13/08/2026)**, usando a ferramenta de verdade e
conferindo na calculadora.

## Por quê

**É o bug mais grave que esta feature já teve.** Quem digita `26,50` — como
escreve qualquer brasileiro, português, alemão ou francês — recebe uma fatura
de `$2.650,00`. Cem vezes mais.

E não há nada na tela que denuncie: o número aparece formatado, o total soma
certo a partir dele, o PDF sai bonito. A pessoa envia ao cliente uma cobrança
de cem mil dólares achando que cobrou mil.

O produto mira brasileiros que faturam para fora. A vírgula decimal é a
notação da casa deles.

## Como reproduzir

1. Abrir `/invoice`
2. Numa linha: Hours `44`, Rate `26,50`

Esperado: `$1.166,00` (44 × 26,50)
Obtido: **`$116.600,00`** (44 × 2.650)

Medido no parser:

| Digitado | Vira | Deveria |
| --- | --- | --- |
| `26,50` | $2.650,00 | $26,50 |
| `26,5` | $265,00 | $26,50 |
| `0,5` | $5,00 | $0,50 |
| `1.234,56` | $1,23 | $1.234,56 |

## Causa

`parseAmountToCents` em `frontend/src/invoice/money.ts` remove toda vírgula
antes de interpretar, assumindo que vírgula é **separador de milhar**:

```ts
const limpo = raw.trim().replace(/[^0-9.,-]/g, '').replace(/,/g, '')
```

Isso funciona para `1,234.56` (notação americana) e destrói `26,50` (notação
brasileira). A escolha foi minha e ficou registrada no comentário original
como se fosse cuidado — era metade do problema.

`parseQuantity` já trata vírgula como decimal (`replace(/,/g, '.')`), então os
dois campos da mesma linha interpretam vírgula de formas opostas. Ninguém
tinha notado porque quantidade raramente leva decimal.

## Critério de aceite

- [x] `26,50` vira $26,50
- [x] `26.50` continua virando $26,50
- [x] `1,234.56` continua virando $1.234,56 (milhar americano)
- [x] `1.234,56` vira $1.234,56 (milhar europeu)
- [x] `0,5` vira $0,50
- [x] `1.005` continua virando $1,01 (o caso que já era testado)
- [x] Quantidade e valor interpretam vírgula da mesma forma
- [x] O `qa-rapido.py` do pre-commit passa a cobrir a vírgula

## Regra escolhida

**Com os dois separadores, o último manda** — é ele que separa os centavos,
em qualquer notação:

- `1,234.56` → ponto por último → 123456
- `1.234,56` → vírgula por último → 123456

**Com um separador só e 3 dígitos depois, a moeda desempata.** Foi decisão do
stakeholder, e é melhor do que a regra fixa que eu tinha proposto: `1.005` é
mil e cinco no Brasil e um e meio centavo nos EUA, e a moeda escolhida diz
qual notação a pessoa está usando.

| Moeda | `1.005` | `1,005` |
| --- | --- | --- |
| USD, GBP, CAD, AUD | $1,01 (decimal) | $1.005,00 (milhar) |
| BRL, EUR, CHF | R$1.005,00 (milhar) | R$1,01 (decimal) |

Com 1 ou 2 dígitos depois, é sempre decimal em qualquer moeda — `26,50` e
`26.50` dão o mesmo valor.

## Verificado no navegador

Dez casos, nas duas notações, incluindo o do print original
(44 × 26,50 = $1.166,00 em USD e R$1.166,00 em BRL) e o `1.005` que já era
testado antes. O `qa-rapido.py` do pre-commit ganhou o caso da vírgula.
