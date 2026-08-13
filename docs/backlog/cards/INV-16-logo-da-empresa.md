# INV-16 · Logo da empresa no lugar da palavra INVOICE

**Estado:** feito (13/08/2026)
**Tamanho:** M
**Pedido do stakeholder (13/08/2026):** "no lugar disso, pode ter a logo da
empresa caso não, mas se não tiver use isso mesmo" — e, em seguida, "o usuário
também vai poder salvar em preto e branco".

## O que faz

- A empresa salva ganha um campo de logo, com prévia no formulário
- A logo substitui a palavra "INVOICE" no cabeçalho do documento
- **Sem logo, o texto continua** — o fallback é o comportamento de hoje
- Caixa "Black and white" converte para tons de cinza
- Dá para remover a logo depois de subir

## Decisões técnicas

**Data URI, não arquivo.** Tudo roda no navegador: não há servidor para
hospedar imagem, e o PDF precisa dos bytes na hora de desenhar.

**Reduzida para 400px de lado maior antes de guardar.** O `localStorage` tem
~5 MB, e uma foto de celular sozinha estoura isso. No PDF a logo ocupa 14mm de
altura, então 400px já sobra para impressão.

**PNG, não JPEG.** Preserva transparência, que quase toda logo usa — JPEG
poria fundo preto onde deveria haver papel.

**Cinza por luminância, não média dos canais.** `(r+g+b)/3` achata cores
distintas no mesmo tom porque o olho enxerga verde muito mais que azul. Os
pesos usados são os da ITU-R BT.601, a mesma recomendação que a TV usa.

Verificado: numa logo com vermelho, azul e amarelo, os três viram cinzas
**diferentes**. Com a média simples ficariam quase iguais.

**Altura fixa, largura pela proporção.** Logo larga e baixa e logo alta e
estreita precisam ocupar o mesmo espaço vertical no cabeçalho.

**A conversão reprocessa o arquivo original**, não a logo já guardada — senão
cada troca da caixa perderia qualidade.

**`try/catch` ao desenhar no PDF**, caindo no texto: uma fatura sem cabeçalho
seria pior que uma sem logo.

## Critério de aceite

- [x] Sem logo, o documento mostra "INVOICE"
- [x] Com logo, ela substitui o texto
- [x] Prévia da logo no formulário da empresa
- [x] A caixa "Black and white" converte de verdade
- [x] Dá para remover
- [x] Funciona na prévia e no PDF
- [x] Arquivo grande demais ou não-imagem dá erro explicado

## Prova da conversão

Medido nos PDFs gerados, na região da logo:

```
colorida:        2.813 pixels coloridos de 20.800
preto e branco:      0 pixels coloridos de 20.800
```
