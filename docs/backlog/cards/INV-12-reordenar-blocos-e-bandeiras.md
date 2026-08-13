# INV-12 · Reordenar os blocos, separar Payment de Notes, bandeiras na moeda

**Estado:** feito (13/08/2026)
**Tamanho:** P
**Pedido do stakeholder (13/08/2026):** "Payment & notes (cada um deve ser um
field) deve ser o 3 e item por último" e "no select Currency deve ter as
bandeiras dos países".

## O que mudou

**Ordem dos blocos.** Antes: detalhes → partes → itens → pagamento. Agora:

1. Invoice details
2. Who is billing whom
3. Payment
4. Notes & terms
5. Items

Faz sentido: quem emite a mesma fatura todo mês muda só os itens. Deixá-los
por último põe o que varia no fim, depois do que se repete.

**Payment e Notes viraram blocos separados**, cada um com seu campo e sua
explicação. Antes dividiam um bloco e dois textareas lado a lado.

**Bandeiras no select de moeda** — emoji, porque `<option>` não aceita `<img>`
nem SVG. O rótulo virou `🇺🇸  USD — US Dollar`.

## Critério de aceite

- [x] A ordem é 1 detalhes, 2 partes, 3 payment, 4 notes, 5 items
- [x] Payment e Notes são blocos distintos, cada um com um campo
- [x] As 7 moedas têm bandeira
- [x] O cálculo e a prévia continuam corretos
- [x] O `qa-rapido.py` foi ajustado para o novo id do bloco de itens

## Observação

O `qa-rapido.py` referenciava `bloco-3` para achar as linhas de item. Com a
reordenação isso virou `bloco-5`, e o hook quebraria no commit seguinte se
não fosse ajustado junto. É o tipo de acoplamento que só aparece quando o
teste roda de verdade.
