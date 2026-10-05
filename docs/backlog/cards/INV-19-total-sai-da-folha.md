# INV-19 · O TOTAL DUE sai da folha quando a tabela termina perto do fim

**Estado:** bug aberto
**Tamanho:** P
**Achado medindo o INV-18 (05/10/2026).** Não foi causado por ele: o código de
`desenharTotais` e da tabela não mudou.

## Por quê

O total é o número que a fatura existe para comunicar. Com a quantidade errada
de itens, o PDF sai **sem ele** — uma página só, sem `TOTAL DUE`, e nada avisa.

## Como reproduzir

Invoice com 3 payment fields curtos, FROM de 5 linhas, e N itens de uma linha
(medido em 05/10, A4 de 297mm, fio do rodapé em y=281):

| itens | página | `Subtotal` y | `TOTAL DUE` y | o que acontece |
| --- | --- | --- | --- | --- |
| 14 | 1 | 268,1 | 282,9 | a caixa verde (275–287) cobre o fio e o texto do rodapé |
| 15 | 1 | 277,7 | 292,5 | caixa de 284,7 a 296,7: em cima do rodapé, colada na borda |
| **16** | 1 | 287,4 | **302,2** | **fora da folha: o PDF não tem total** (`pdftotext` não acha `TOTAL DUE`) |
| 17 | 2 | 43,0 | 57,8 | certo — o autotable trocou de página sozinho |

## Causa

`generateInvoicePdf` chama `desenharTotais(doc, draft, yTabela + 10, direita)`
sem conferir se os ~29mm do bloco cabem até o rodapé. A tabela pagina (o
autotable cuida); o que vem depois dela, não. A margem de baixo do autotable é
a padrão (~14mm), então a própria tabela também pode descer até y≈283, por
cima do fio do rodapé em 281.

## Critérios de aceite

- [ ] Se o bloco de totais não couber acima do rodapé, ele vai para a página
      seguinte, com rodapé nas duas
- [ ] A tabela de itens para antes do fio do rodapé (`margin.bottom` explícito)
- [ ] O `it.fails('INV-19: …')` de `frontend/src/invoice/pdf.spec.ts` vira `it`
      e passa

## Teste

Já está no repositório, marcado como conhecido: `it.fails` em
`frontend/src/invoice/pdf.spec.ts`. Passa enquanto o defeito existir e quebra
quando for corrigido.
