# INV-18 · Campo longo atropela o PDF em vez de ganhar outra linha

**Estado:** feito (05/10/2026)
**Tamanho:** P
**Relatado pelo Lucas (05/10/2026)**, baixando uma invoice em produção com
endereço comprido.

## Por quê

O PDF é o único desfecho da tela de Invoice, e é o que vai para o cliente. Com
um endereço comprido nos dados de pagamento, o valor **sai pela margem esquerda
da folha e é cortado** — a pessoa manda para o cliente um documento em que o
endereço do banco está ilegível.

## Como reproduzir

Gerar o PDF com estes campos (medido em 05/10, A4, `frontend/src/invoice/pdf.ts`):

| campo | valor | o que acontece |
| --- | --- | --- |
| Payment field, valor | endereço de ~170 caracteres | escrito numa linha só, alinhado à direita: **passa por cima do rótulo e sai da folha pela esquerda** |
| Payment field, rótulo | ~75 caracteres | passa por baixo do valor, os dois ilegíveis |
| Invoice # | 43 caracteres | passa por cima do rótulo `Invoice #` |
| Rodapé (nome · e-mail) | nome de 88 + e-mail de 82 | passa por cima de `Page 1` e sai da folha pela direita |

FROM e BILL TO **já quebram certo** (`splitTextToSize` em `desenharPartes`), e a
descrição do item também (o autotable cuida). O defeito está só onde o texto é
desenhado com um `doc.text()` direto, sem medir.

## Causa

Três trechos desenham texto de tamanho livre numa posição fixa:

- `desenharPagamento`: rótulo em `MARGEM + 2.5`, valor em `direita - 2.5` com
  `align: 'right'`, altura de linha fixa (`ALTURA = 5.4`). Nenhum dos dois é
  medido, e a faixa da zebra tem a altura de uma linha só.
- metadados do cabeçalho: valor em `direita`, rótulo em `direita - 34`.
- `rodape`: `esquerda` inteiro em `MARGEM`.

## Critérios de aceite

- [x] Valor de payment field maior que a coluna dele **quebra em mais linhas**,
      e a linha (com a faixa da zebra) cresce junto; a linha seguinte começa
      abaixo
- [x] Rótulo de payment field longo também quebra, sem encostar no valor
- [x] Nenhum texto do PDF passa das margens (15mm) — nem à esquerda, nem à
      direita
- [x] `Invoice #` longo não sobrepõe o rótulo
- [x] Rodapé longo não sobrepõe `Page N` nem sai da folha
- [x] Invoice de campos curtos sai **idêntica** à de hoje (sem regressão de
      layout)
- [x] Teste automatizado em `frontend/src/invoice/` gera o PDF de verdade e
      confere as posições; roda no `npm test`

## Corrigido (05/10/2026)

`frontend/src/invoice/pdf.ts`, com teste em `frontend/src/invoice/pdf.spec.ts`
(39 casos) que gera o PDF de verdade e confere posição: cada `doc.text` é
anotado com a largura medida na fonte ativa, e as regras são geométricas —
nada fora das margens, nada por cima de outro texto na mesma linha de base, a
linha seguinte abaixo da anterior.

**Antes da correção: 11 falhando, 27 passando** (as 27 são a regressão dos
campos curtos, que tem de passar nos dois lados). **Depois: 38 passando**, mais
um `it.fails` do INV-19. Suíte do frontend: 13 arquivos, 405 testes.

### O que mudou

- **Payment fields.** Duas colunas: a do rótulo tem a largura do maior rótulo,
  **até o teto de 38%** da largura interna (66,5mm de 175); o valor fica com o
  resto, descontado um vão de 6mm. Os dois quebram, a linha tem a altura do
  maior (`5,4 + (n-1) × 4,6`mm) e a zebra cresce junto. O valor continua
  alinhado à direita, linha a linha.
- **`Invoice #`.** A coluna dos rótulos fica onde sempre esteve (34mm da margem)
  enquanto o valor couber; passou disso, **recua para a esquerda** até o limite
  da marca (a logo ocupa no máximo 60mm). Os 43 caracteres do relato cabem numa
  linha assim. Só além de ~97mm de valor ele quebra — e aí **empurra** o fio
  dourado e o FROM para baixo, em vez de limitar: número cortado numa fatura é
  pior que cabeçalho alto.
- **Rodapé.** Cortado com reticências antes do `Page N` (vão de 6mm). É uma
  linha só por definição, e nome e e-mail já aparecem inteiros no FROM. São
  três pontos ASCII, e não `…`: o caractere está fora do Latin-1 e as fontes
  padrão do PDF não o desenham.
- **Estouro de página.** Payment details mais alto que a folha **continua na
  página seguinte** (linha a linha, um campo pode atravessar a quebra), com
  rodapé nas duas. Medido com 24 campos de endereço: 2 páginas, nada abaixo de
  y=277. Vale também para o texto livre antigo (`paymentDetails`).

### Três coisas que só apareceram medindo

1. **`splitTextToSize` quebra texto que cabe.** Ele não faz a mesma conta do
   `getTextWidth` (um aplica kerning, o outro não). Com a coluna na largura
   exata do maior rótulo, `Bank address 10` saía como `Bank address` / `10`; meio
   milímetro de folga ainda quebrava `Co-Fsmy VTLSTto0 TdFhJsLd`. Por isso
   `quebrar()` **mede antes** e só chama o split quando o texto passa — é
   também o que garante que campo curto sai idêntico.
2. **O rodapé deixa a fonte em 8pt.** Na primeira versão da quebra de página,
   tudo o que vinha depois dela saía menor (visto no PNG, não no teste — o
   teste ganhou a checagem depois).
3. **A linha partida vinha com espaço no fim**, e num texto alinhado à direita
   isso recuava a linha 0,9mm. `quebrar()` apara.

### A prévia tinha o mesmo defeito

`InvoicePreview.tsx`: valor com espaços quebrava certo, mas **palavra sem
espaço** não — um link de pagamento de 182 caracteres esticava a tabela a
2246px numa folha de 616, e o e-mail do FROM invadia o BILL TO. Corrigido com
`overflow-wrap: anywhere` na folha, mais `whitespace-nowrap` na marca e nos
rótulos do cabeçalho (sem isso o `anywhere` fazia `INVOICE` virar `INVOI`/`CE`).
Medido no Chromium antes e depois: 5 textos fora da folha → 0. O teste
(`InvoicePreview.spec.tsx`, 3 casos) guarda só a causa, porque o jsdom não faz
layout — está dito no cabeçalho dele.

### O que NÃO foi resolvido

- **FROM / BILL TO não trocam de página.** Não era o defeito e o card pedia
  para não mexer; um endereço de dezenas de linhas ainda passaria do rodapé.
- **Os rótulos `Issue date` / `Due date` acompanham o recuo do `Invoice #`**
  (são uma coluna só), e ficam longe das datas quando o número é comprido.
  Legível, mas menos bonito que o caso curto.
- **A quebra da prévia não é a mesma do PDF** — fontes diferentes, e na tela a
  coluna do rótulo é a que o navegador calcula, não os 38%. As duas quebram; as
  linhas não caem no mesmo lugar.
- Dois defeitos antigos apareceram no caminho e viraram card:
  [INV-19](INV-19-total-sai-da-folha.md) (o TOTAL DUE sai da folha com 16
  itens) e [INV-20](INV-20-rolagem-horizontal-no-celular.md) (rolagem
  horizontal em `/invoice` a 390px).
