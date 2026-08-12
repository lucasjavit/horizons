# INV-04 · Editar durante a geração produz PDF com dados antigos

**Estado:** esperando decisão
**Tamanho:** P

## Por quê

Achado do QA em 12/08/2026, durante a revisão do INV-03. **É o achado mais
grave da invoice até agora**, e é pior que o bug que estávamos consertando:
a pessoa envia ao cliente uma fatura com valor e moeda errados, acreditando
ter enviado o que via na tela.

O PDF sai coerente e bem formatado — só que com os dados de antes. Não há
nada visualmente errado nele que denuncie o problema.

## O que

A geração usa os dados do momento do clique. Se a pessoa editar enquanto o
PDF é gerado, a edição não alcança o arquivo, e nada avisa.

## Como reproduzir

1. Abrir `/invoice`
2. Preencher: número `INV-STALE`, moeda `USD`, uma linha `2 × 100`
   (total `$200.00`)
3. Clicar em "Download PDF"
4. **Durante a geração**, mudar o número para `INV-EDITADO`, a moeda para
   `EUR` e o valor para `999`

Esperado: PDF coerente com a tela, ou recusa explícita
Obtido: a tela mostra `INV-EDITADO` e `€1,998.00`, mas o arquivo salvo é
`invoice-INV-STALE.pdf` com `$200.00` em USD

Verificado com `pdftotext` no arquivo real, não por inspeção de código.

## Causa

`baixar()` é um `useCallback` com `[draft, erros]` nas dependências, então
captura `draft` no closure no momento do clique. Edições posteriores não
alcançam a geração em voo.

O nome do arquivo (`INV-STALE`) é a única pista, e é fácil não notar.

## Decisão pendente

Três saídas:

1. **Bloquear a edição durante a geração** — os campos ficam somente leitura
   enquanto o PDF é gerado. Honesto, mas a geração é rápida (13–63ms) e o
   bloqueio pisca na tela.
2. **Gerar com os dados do momento do clique e avisar** — mantém o
   comportamento e deixa claro no status qual invoice foi baixada
   ("Downloaded INV-STALE").
3. **Regenerar se mudou** — detectar que o rascunho mudou durante a geração e
   refazer com os dados novos. Mais correto e mais caro.

Considerando que a janela é de milissegundos, a 2 é provavelmente suficiente
e a 1 é a mais honesta. A 3 é engenharia demais para o problema.

## Observações

Não foi introduzido pelo INV-03 — existe desde a primeira versão da feature.
