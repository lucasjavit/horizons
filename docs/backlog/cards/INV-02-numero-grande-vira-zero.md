# INV-02 · Número grande demais vira $0.00 em silêncio

**Estado:** feito (12/08/2026)
**Tamanho:** P
**Decisão do stakeholder (12/08/2026):** limitar o que pode ser digitado à
faixa **1 a 1.000.000**, por campo. Um teto humano é mais defensável que o
limite de inteiro seguro do JavaScript, e resolve o `1e9` de quebra — um
bilhão passa de um milhão e cai na mesma regra.

## Por quê

Achado do QA adversarial em 12/08/2026. Quando o valor passa do limite de
inteiro seguro do JavaScript, a linha vira `$0.00` sem dizer nada. O
comportamento é defensivo — não quebra a página nem produz `NaN` — mas some
com o número que a pessoa digitou, e ela pode não perceber antes de enviar a
fatura.

Relacionado: `1e9` na quantidade é aceito como um bilhão. Provavelmente foi
erro de digitação de quem queria `1`.

## O que

Limitar quantidade e valor unitário à faixa **1 a 1.000.000**, avisando em vez
de zerar em silêncio.

O teto vale **por campo digitado**, não para o total: dez linhas de 1.000.000
somam 10.000.000, e isso continua permitido. Limitar o total seria outra
decisão, e não foi tomada.

## Critério de aceite

- [ ] Quantidade acima de 1.000.000 marca o campo como inválido, com mensagem
- [ ] Valor unitário acima de 1.000.000 idem
- [ ] Notação científica (`1e9`) cai na mesma regra (excede o teto), nunca é
      aceita em silêncio
- [ ] A linha não mostra `$0.00` quando a entrada não era zero
- [ ] Continua sem `NaN` e sem `Infinity` em nenhuma entrada
- [ ] O erro segue o padrão da casa: borda + `aria-invalid` + texto

## Ponto em aberto

O limite inferior de 1 conflita com quantidade fracionária, que é caso de uso
real (2,5 horas). "1 a 1.000.000" provavelmente quer dizer **maior que zero**
e no máximo um milhão — do contrário, cobrar meia hora fica impossível.
A implementação assume `> 0`; se a intenção era mesmo `>= 1`, é ajuste de uma
linha.

## Como reproduzir hoje

1. Abrir `/invoice`, preencher os obrigatórios
2. Numa linha: quantidade `999999999`, valor `999999999`

Esperado: aviso de valor grande demais
Obtido: linha `$0.00`, total `$0.00`

Variação: quantidade `1e9` e valor `100` → total `$100,000,000,000.00`

## Observações

`lineAmountCents` já devolve `0` quando `Number.isSafeInteger` falha — o ponto
de decisão existe, falta transformá-lo em erro visível em vez de zero mudo.
