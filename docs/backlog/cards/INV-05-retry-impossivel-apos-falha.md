# INV-05 · Depois de uma falha, "Please try again" nunca funciona

**Estado:** feito (13/08/2026)
**Tamanho:** P

## Por quê

Achado do QA em 12/08/2026, durante a revisão do INV-03. A mensagem de erro
instrui a pessoa a fazer exatamente o que não pode dar certo: clicar de novo
nunca funciona, por mais que a rede tenha voltado. Só recarregar a página
recupera.

Quem teve um soluço de rede fica sem conseguir emitir a invoice, e a interface
mente sobre a saída.

## O que

Depois de uma falha ao carregar o jsPDF, toda tentativa seguinte falha
instantaneamente sem tocar a rede.

## Como reproduzir

1. Abrir `/invoice` e preencher os obrigatórios
2. Derrubar a rede (ou bloquear `/assets/jspdf*`)
3. Clicar em "Download PDF" → "Could not generate the PDF. Please try again."
4. Restaurar a rede
5. Clicar de novo, quantas vezes quiser

Esperado: gera o PDF
Obtido: zero downloads, mesma mensagem, e **zero requisições de rede novas**

O QA contou as requisições ao chunk: a primeira tentativa dispara 2, todas as
seguintes disparam 0. Depois de F5 com a rede liberada, baixa normalmente.

## Causa

Um `import()` que rejeita fica cacheado permanentemente no registro de módulos
do ESM. Toda retentativa rejeita a partir do cache, sem nova requisição.

## Critério de aceite

- [x] Após uma falha por rede, com a rede restaurada, clicar de novo gera o PDF
- [x] A retentativa dispara requisição de rede de verdade
- [x] Se falhar de novo, a mensagem continua aparecendo (sem travar)
- [x] Não é preciso recarregar a página em nenhum caso

## Observações

O caminho usual é forçar uma URL nova a cada tentativa (ex.: acrescentar um
parâmetro de cache-busting ao especificador), o que faz o navegador tratar
como outro módulo. Confirmar que isso não quebra o code splitting do Vite —
o jsPDF **precisa continuar em chunk separado**, senão o INV-05 conserta um
bug e cria outro pior.

Alternativa mais simples: manter o `import()` como está e apenas trocar a
mensagem para dizer a verdade ("recarregue a página e tente de novo"). Resolve
a mentira sem resolver o problema.

Não foi introduzido pelo INV-03 — existe desde a primeira versão da feature.


## Resolução parcial (12/08/2026)

Tentei o cache-busting sugerido acima (`import('jspdf?t=...')`) e **o Vite
parou de separar o chunk**: o bundle principal saltou de 320 KB para 329 KB
com o jsPDF dentro. Revertido — o carregamento sob demanda protege todo mundo
que só quer ler uma aula, e este bug atinge só quem teve falha de rede.

O que foi feito: a mensagem passou a dizer a verdade — "Please reload the page
and try again" em vez de "Please try again", que instruía a fazer o que não
funciona.

O que falta: fazer a retentativa funcionar sem recarregar, sem quebrar o code
splitting. Provavelmente exige carregar o jsPDF por outro caminho que não o
`import()` do ESM.


## Segunda tentativa (12/08/2026) — tambem descartada

Tentei reaquecer a rede antes de reimportar: `fetch(url, {cache:'reload'})`
no chunk descoberto via `performance.getEntriesByType('resource')`. O fetch
encontra as URLs e vai a rede, mas **o registro de modulos do ESM guarda a
rejeicao do `import()` para sempre** — medido: continua sem gerar o PDF.

As duas saidas obvias estao esgotadas (URL dinamica quebra o code splitting,
cache-reload nao apaga o registro do ESM). O codigo morto foi removido; o
raciocinio ficou registrado no comentario de `pdf.ts`.

**O que sobra:** carregar o jsPDF por outro caminho que nao o `import()` do
ESM (por exemplo injetando um `<script>`), o que e uma mudanca grande para um
bug que atinge so quem teve falha de rede. Fica parado de proposito.


## Terceira e quarta tentativas (12/08/2026) — encerrado

Testei as duas ultimas saidas que restavam, cada uma numa aba com o chunk
bloqueado, falha provocada e rede liberada em seguida:

**`<script type="module">` injetado.** Falhou. Um script de modulo usa o
**mesmo registro de modulos** que o `import()`, entao herda a rejeicao
cacheada. Nao e via alternativa nenhuma — e a mesma via com outra sintaxe.

**Blob URL.** Falhou, e o erro explica o porque de forma definitiva:

```
Failed to resolve module specifier "./index-CA1LRIvg.js"
```

O chunk do jsPDF importa outro chunk por **caminho relativo**. Um blob nao
tem caminho base, entao a resolucao quebra. Reescrever o import interno seria
mexer no artefato de build — fragil e sem garantia entre versoes.

## Conclusao

**Quatro caminhos testados, quatro fechados com motivo medido:**

| Caminho | Por que falhou |
| --- | --- |
| URL dinamica no `import()` | Vite para de separar o chunk: 320 → 329 KB |
| `fetch` com `cache:'reload'` | Reaquece o cache HTTP, nao o registro do ESM |
| `<script type="module">` | Mesmo registro de modulos, mesma rejeicao |
| Blob URL | Import relativo interno nao resolve sem caminho base |

O que sobraria e abandonar o code splitting do Vite para o jsPDF e servi-lo
como script classico (nao-modulo) — o que significa 400 KB fora do sistema de
build, sem versionamento por hash e sem tree-shaking. Custo alto demais para
um bug que atinge quem teve falha de rede no momento exato do download.

**Fechado.** O que foi entregue: a mensagem diz a verdade ("Please reload the
page and try again") em vez de instruir a fazer o que nao funciona. Se algum
dia o carregamento do jsPDF mudar por outro motivo, vale reavaliar.


---

# Resolvido (13/08/2026) — o quinto caminho

Eu tinha fechado este card como não-viável depois de quatro tentativas. Estava
errado: faltava testar `<script>` **clássico** (não módulo).

O UMD do jsPDF carrega por `<script src>` comum, que **não passa pelo registro
de módulos do ESM** — é justamente o registro que guardava a rejeição para
sempre. Testado isoladamente antes de escrever qualquer código:

```
1a tentativa (rede bloqueada): FALHOU
2a tentativa (rede voltou):    carregou
```

## O que mudou

`node_modules/jspdf/dist/jspdf.umd.min.js` e o plugin autotable foram copiados
para `frontend/public/vendor/`. O `carregarJsPdf` injeta os dois por `<script>`,
em ordem (o autotable depende do jsPDF já estar em `window`), e limpa a
promessa em caso de falha para a próxima tentativa ir à rede.

A mensagem de erro deixou de mandar recarregar a página: agora diz
"Check your connection and try again", que é o que de fato funciona.

## O custo, medido

| | Antes (ESM) | Depois (UMD) |
| --- | --- | --- |
| Bundle principal | 341 KB | **351 KB** (+9 KB, do código da prévia) |
| jsPDF no carregamento inicial | não | **não** |
| Retry após falha de rede | impossível | **funciona** |
| Hash de versão no arquivo | sim | **não** |
| Tree-shaking | sim | não (já era mínimo) |

Perder o hash de versão é real: um deploy novo não invalida o cache do
`vendor/` automaticamente. Como o jsPDF só é atualizado quando alguém roda
`npm update` de propósito, e o arquivo é imutável na prática, o risco é baixo
— mas está registrado aqui.

## A lição

Fechar um card como não-viável deve significar "testei os caminhos", não
"cansei de tentar". Eu tinha escrito no card que o que sobrava era "carregar
o jsPDF fora do ESM" e classifiquei como caro demais sem medir. Custou 20
linhas.
