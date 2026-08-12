# INV-02 · Número grande demais vira $0.00 em silêncio

**Estado:** backlog
**Tamanho:** P

## Por quê

Achado do QA adversarial em 12/08/2026. Quando o valor passa do limite de
inteiro seguro do JavaScript, a linha vira `$0.00` sem dizer nada. O
comportamento é defensivo — não quebra a página nem produz `NaN` — mas some
com o número que a pessoa digitou, e ela pode não perceber antes de enviar a
fatura.

Relacionado: `1e9` na quantidade é aceito como um bilhão. Provavelmente foi
erro de digitação de quem queria `1`.

## O que

Avisar em vez de zerar. Quando o valor não puder ser representado, o campo
diz isso.

## Critério de aceite

- [ ] Valor além do inteiro seguro marca o campo como inválido, com mensagem
      dizendo que o valor é grande demais
- [ ] Notação científica (`1e9`) na quantidade é rejeitada ou convertida
      visivelmente, nunca aceita em silêncio
- [ ] A linha não mostra `$0.00` quando a entrada não era zero
- [ ] Continua sem `NaN` e sem `Infinity` em nenhum caso

## Como reproduzir hoje

1. Abrir `/invoice`, preencher os obrigatórios
2. Numa linha: quantidade `999999999`, valor `999999999`

Esperado: aviso de valor grande demais
Obtido: linha `$0.00`, total `$0.00`

Variação: quantidade `1e9` e valor `100` → total `$100,000,000,000.00`

## Observações

`lineAmountCents` já devolve `0` quando `Number.isSafeInteger` falha — o ponto
de decisão existe, falta transformá-lo em erro visível em vez de zero mudo.
