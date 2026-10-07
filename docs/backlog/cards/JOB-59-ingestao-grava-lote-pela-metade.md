# JOB-59 · A ingestão grava o lote pela metade

> Renumerado de JOB-54 para JOB-59 em 07/10: o numero colidia com
> `JOB-54-ordenacao-e-filtro-de-data.md`, de 05/10, que ja estava feito. O 54
> fica com o card mais antigo.

**Estado:** feito (06/10/2026)
**Tamanho:** P
**Achado por:** review adversarial do [JOB-50](JOB-50-ingestao-de-vagas-rastreadas.md), 02/10

## Os quatro defeitos, todos reproduzidos duas vezes

### 1. [GRAVE] Byte NUL dá 500 e o lote grava pela metade

```bash
T='horizons dev ingest token trocar antes de publicar'
curl -s -X POST http://localhost:3333/api/ingest/jobs \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"upsert":[
   {"fonte":"qa","idExterno":"ok-antes","title":"T","company":"C","url":"https://e.com/1"},
   {"fonte":"qa","idExterno":"ruim\u0000","title":"T","company":"C","url":"https://e.com/2"},
   {"fonte":"qa","idExterno":"ok-depois","title":"T","company":"C","url":"https://e.com/3"}]}'
```

**Esperado:** 400, nada gravado.
**Obtido:** `500 {"statusCode":500,"message":"Internal server error"}`, e no banco
**só `ok-antes`** — `ok-depois` não entrou.

O 500 não é o problema. **`aplicar()` não tem transação** (`ingest.service.ts:71-73`
chama `gravar` → `confirmar` → `fechar`, cada uma com commit próprio), então o
rastreador recebe 500 **sem saber o que entrou**.

O JOB-49 decidiu que é pela resposta que o rastreador tira itens da fila. Num 500
ele não sabe o que aplicar de novo: reenviar re-executa o que já entrou, e o
`fechar` de um lote que explodiu no meio não sabe quais vagas já saíram.

**O pior caso:** uma vaga com NUL no título (ATS copiando lixo de HTML) **trava o
board inteiro em reenvio permanente**.

Atinge **todo** campo string — `fonte`, `idExterno`, `title`, `company`, `url`,
`local`, `regime`, `area`, `degree`, `logoUrl`, `paisIso`, dentro de
`skills`/`benefits`, dentro de `snapshot` — e também as listas `confirmar` e
`fechar` (500 vindo de `updateMany`/`deleteMany`).

**A não-atomicidade vale para qualquer falha no meio do lote**, não só NUL:
provado com `upsert` válido + `confirmar` válido + `fechar` com NUL — a vaga nova
ficou gravada **e** o `confirmadaEm` foi atualizado, com resposta 500.

O CLAUDE.md já avisa que `'\u0000'` derruba o Postgres
(*invalid byte sequence for encoding UTF8*). O aviso valia aqui.

### 2. [MÉDIO] `Content-Type` errado devolve 201 e não grava nada

```bash
curl -s -X POST http://localhost:3333/api/ingest/jobs \
  -H "Authorization: Bearer $T" -H 'Content-Type: text/plain' \
  -d '{"upsert":[{"fonte":"qa","idExterno":"ct1","title":"T","company":"C","url":"https://e.com/ct1"}]}'
```

**Esperado:** 415, ou 400.
**Obtido:** `201 {"gravadas":0,"confirmadas":0,"fechadas":0}`, zero linhas.

`app.useBodyParser('json', …)` só parseia `application/json`. Com outro tipo o
corpo chega `{}`, o DTO aceita (as três listas são `@IsOptional`) e o serviço
aplica listas vazias.

`text/json` e `application/octet-stream` idem. `application/x-www-form-urlencoded`
dá 400 (outro parser pega); `application/json; charset=utf-8` e
`application/JSON` funcionam normalmente.

**Quem olha só o status HTTP perde o lote em silêncio** e tira os itens da fila.
O atenuante é que os contadores vêm `0` — um cliente que confira
`gravadas == upsert.length` detecta.

### 3. [MÉDIO] `postedAt: "2026-02-31"` é aceito e gravado como 3 de março

```bash
curl -s -X POST http://localhost:3333/api/ingest/jobs \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"upsert":[{"fonte":"qa","idExterno":"fev31","title":"T","company":"C","url":"https://e.com/f","postedAt":"2026-02-31T00:00:00Z"}]}'
```

**Esperado:** 400 — a data não existe.
**Obtido:** `201`, e no banco `2026-03-03 00:00:00`. **Corrupção silenciosa.**

`ingest.dto.ts:161` usa `@IsISO8601()` sem `{ strict: true }`. Sonda na lib:
`isISO8601('2026-02-31')` → `true`; com `{strict:true}` → `false`. Também passam
`2026-02-30` (→ 03-02) e `2026-04-31` (→ 05-01).

**É reincidência:** o CLAUDE.md registra *"o RFC aceitando 31 de fevereiro"* como
bug achado em 31/08.

⚠️ **`src/jobs/job.dto.ts:622,626` tem o mesmo problema** — o JOB-50 copiou a
convenção existente em vez de introduzi-la. Decidir se corrige nos dois lugares
ou só aqui; o outro já está em produção.

**O que resistiu**, e não precisa de mudança: `"banana"`, `"01/08/2026"`, mês 13,
leap second, ano de 5 dígitos e epoch numérico **todos dão 400**.

### 4. [BAIXO] A chave de idempotência não normaliza

```bash
for F in "greenhouse" "Greenhouse" "GREENHOUSE" " greenhouse" "greenhouse "; do … done
```

**Esperado:** 1 linha — é a mesma vaga do mesmo board.
**Obtido:** **5 linhas.**

Nem o DTO nem `paraBanco()` fazem `trim()`/`toLowerCase()` em `fonte` e
`idExterno`, e o unique do Postgres é byte-exato. `idExterno: "   "` também passa,
porque `@IsNotEmpty()` rejeita `""` mas não espaço em branco.

Impacto hoje é baixo (o rastreador não existe e mandará `fonte` vinda de código),
mas **é a chave de idempotência do card** — vale decidir de propósito, e não por
omissão.

## O que fazer

1. **Rejeitar caracteres de controle no DTO**, em todo campo string — inclusive
   dentro de `skills`/`benefits` e das chaves/valores do `snapshot`. 400, não 500.
2. **`aplicar()` numa transação.** A resposta precisa ser verdadeira: ou o lote
   entrou, ou não entrou. Sem isso o contrato do JOB-49 não se sustenta.
3. **415 para `Content-Type` não-JSON**, em vez de 201 com corpo vazio.
4. **`@IsISO8601({ strict: true })`** no `postedAt`.
5. **Normalizar `fonte` e `idExterno`** (`trim`, e `toLowerCase` no `fonte`), ou
   registrar aqui por que não.

## Critérios de aceite

- [x] NUL em qualquer campo string → **400**, e **nada gravado** — 16 campos
      cobertos por `it.each`, inclusive dentro de `skills`/`benefits` e nas
      **chaves e valores** do `snapshot` aninhado
- [x] Falha no meio do lote → **nada gravado** (a transação prova, não a sorte)
      — dois testes com falha injetada DENTRO da transação, conferindo o banco
- [x] `Content-Type` não-JSON → 415, e `application/json; charset=utf-8` e
      `application/JSON` continuam em 201
- [x] `2026-02-31` → 400; as 6 datas que já davam 400 continuam dando, e as 5
      válidas continuam entrando
- [x] A mesma vaga com `fonte` em caixas diferentes → **1 linha**; o
      `idExterno` leva só `trim`, e a razão está escrita abaixo
- [x] Cada correção tem teste, e **cada teste foi visto falhar** com o defeito
      reintroduzido — 11 mutações, tabela abaixo
- [x] Os 39 testes do `ingestao.e2e.spec.ts` continuam passando (agora são 92)

## Por que a suíte não pegou

`grep` por `u0000|nul|500|atomic|transacao|parcial|content-type|02-31` em
`ingestao.e2e.spec.ts` (39 testes, todos passando): **nenhuma ocorrência**.

A suíte é forte no que o card previu e cega no que ele não previu. É o argumento
para estes casos virarem teste junto da correção — não para desconfiar da suíte.

## Fora do escopo

- **`url` duplicada entre fontes é permitida por desenho** (o unique é
  `(fonte, idExterno)`). Consequência registrada no
  [JOB-52](JOB-52-busca-le-da-copia-local.md): **a busca vai precisar deduplicar
  por URL na leitura**, senão a mesma vaga aparece duas vezes.
- **`INGEST_TOKEN` não está na tabela de variáveis do `docs/DEPLOY.md`** — as
  outras quatro estão. Omissão, não escolha.

## O que o review atacou e resistiu

Registrado para não ser reatacado: a trava do token **não cedeu a nada**. Token de
1 char, 10.000 chars, vazio, emoji, prefixo-correto-menos-1 → 401, nenhum 500
(`timingSafeEqual` compara tamanho antes). Header malformado em sete variações →
401. `@TokenDeIngestao()` + `@Public()` exige o **mais restritivo**. Nenhum
vazamento do token em log, nem nos 500. Rota não listada em `/api`, `/api-json`,
`/api/docs`. Concorrência: 6 lotes de 50 em paralelo → exatamente 50 linhas, zero
`P2002`. Teto de 200 itens e `413` acima de 2 MB. `INGEST_DIAS_SEM_CONFIRMACAO`
com 33 valores absurdos → **todos caem no padrão 7**, nunca em zero. Injeção SQL,
`<script>`, `__proto__`, RTL, emoji → gravados como dado literal.

## O que foi feito (06/10/2026)

Os quatro defeitos foram reproduzidos no ar antes de qualquer linha de código —
os `curl` do card bateram exatamente como descrito — e reconferidos depois.

### As cinco correções

| # | Onde | O que mudou |
| --- | --- | --- |
| 1 | `src/ingest/sem-controle.ts` (novo) + 16 campos do DTO | `@SemCaractereDeControle()`, varredura **recursiva**: string, array, e chave **e** valor do `snapshot` em qualquer nível |
| 2 | `ingest.service.ts:142` | `aplicar()` dentro de `prisma.$transaction`, com as três etapas recebendo o `tx` |
| 3 | `src/ingest/exigir-json.guard.ts` (novo) | 415 para `Content-Type` não-JSON |
| 4 | `ingest.dto.ts:255` | `@IsISO8601({ strict: true })` |
| 5 | `ingest.dto.ts` | `@Transform` com `trim` nos dois campos da chave, e `toLowerCase` **só** no `fonte` |

### Os quatro `curl` do card, com o código corrigido

```
1. lote [ok-antes, NUL, ok-depois]
   antes:  500 {"statusCode":500,...}  e `ok-antes` GRAVADO
   agora:  400 {"message":["upsert.1.idExterno tem caractere de controle"]}
           e `select count(*) from tracked_jobs` = 0

2. Content-Type: text/plain com lote válido
   antes:  201 {"gravadas":0,...}  e ZERO linhas (perda silenciosa)
   agora:  415 {"message":"O lote de ingestao precisa ser enviado como
                application/json.","error":"Unsupported Media Type"}

3. postedAt: "2026-02-31T00:00:00Z"
   antes:  201, e no banco 2026-03-03 00:00:00
   agora:  400 {"message":["upsert.0.postedAt must be a valid ISO 8601 date string"]}

4. a mesma vaga com fonte em 5 caixas/espaços
   antes:  5 linhas
   agora:  1 linha, e o `fonte` gravado é `greenhouse`
```

E o cenário composto que o card usou para provar a não-atomicidade (`upsert`
válido + `confirmar` válido + `fechar` com NUL): **400, e a vaga nova não
entrou nem o `confirmadaEm` avançou.** Note que agora o DTO recusa antes de a
transação abrir — a transação é a rede para a falha que o DTO *não* pode prever.

### A decisão sobre normalizar: `trim` nos dois, `toLowerCase` só no `fonte`

**`fonte` leva `toLowerCase`.** É um identificador do nosso lado — o nome do
adaptador do rastreador (`greenhouse`, `lever`, `ashby`), escolhido em código,
de um conjunto fechado. `Greenhouse` e `greenhouse` não são dois boards: são a
mesma coisa escrita por duas mãos. Dobrar a caixa não perde informação nenhuma.

**`idExterno` leva só `trim`, e isso é deliberado.** Ele é o id da vaga **no ATS
de origem**, e esse id não é nosso: o Lever usa uuid, o Ashby usa slug, e há
board que usa base64 — onde `A` e `a` são bytes diferentes e apontam para vagas
**diferentes**. Dobrar a caixa dele fundiria duas vagas reais numa linha, que é
o oposto do bug corrigido, e pior: perderia dado em vez de duplicar.

O `trim` resolve de graça o `idExterno: "   "` que o card apontou: ele roda
**antes** da validação, então os três espaços viram `""` e o `@IsNotEmpty()`
finalmente pega.

⚠️ **A normalização está nas DUAS classes** (`VagaRastreadaDto` e
`ReferenciaDeVagaDto`), e é a parte mais fácil de errar. Se só o `upsert`
normalizasse, o rastreador gravaria `greenhouse` e tentaria confirmar
`Greenhouse`: o `updateMany` casaria **zero** linhas, devolveria
`confirmadas: 0`, e a vaga morreria no prazo de 7 dias enquanto o ATS dizia que
estava aberta — falha silenciosa com uma semana de atraso. Há teste para isso
(e a mutação M11 abaixo o mata).

### O timeout da transação, medido e não chutado

O card pedia para conferir se o laço de `upsert` cabe no timeout padrão do
Prisma (5s) com 200 itens. Medido em 06/10, máquina de 4 núcleos, banco local:

| Cenário | Pior lote |
| --- | --- |
| 1 lote de 200: create + `confirmar` 200 + `fechar` 200 | **773 ms** |
| o mesmo lote de novo (só update) | 384 ms, depois 334 ms |
| **6 lotes de 200 em paralelo** (o pior caso do review do JOB-50) | **1.608 ms** |

**Cabe nos 5s do padrão** — mas com ~3x de folga no caso paralelo, nesta
máquina, sem mais nada rodando. Como um lote que estoure o timeout não degrada
(ele aborta com 500, e o rastreador reenvia para sempre), os dois números ficam
explícitos: `TEMPO_DA_TRANSACAO = 30s` (~19x o pior medido) e
`ESPERA_POR_CONEXAO = 10s`.

O `maxWait` é o limite **mais provável de morder**, e o padrão dele é 2s: sob
concorrência a transação que chega por último espera no pool sem ter começado a
trabalhar, e um 500 ali seria indistinguível de lote inválido para quem lê a
resposta.

Não se resolve trocando o laço por `createMany`: o JOB-50 já mediu que
`createMany({ skipDuplicates })` **não atualiza** a vaga que mudou de título, e
o critério de aceite é *"atualiza, não duplica"*.

### 11 mutações, 10 mataram teste — e a que sobreviveu ensinou

| # | Mutação | Testes mortos |
| --- | --- | --- |
| M1 | remove **todos** os `@SemCaractereDeControle` | **19** |
| M2 | só o `snapshot` perde a varredura | 4 |
| M3 | `skills`/`benefits` sem `{ each: true }` | **0 — ver abaixo** |
| M4 | tira a transação (volta ao defeito original) | **2** (exatamente os de atomicidade) |
| M5 | tira o `@UseGuards(ExigirJsonGuard)` | 4 |
| M6 | `{ strict: true }` → `@IsISO8601()` solto | 5 |
| M7 | tira os dois `@Transform` | 4 |
| M8 | profundidade excedida **ignora** em vez de recusar | 3 |
| M9 | a regex ganha a flag `g` (guarda `lastIndex` entre chamadas) | 6 |
| M10 | `idExterno` **também** ganha `toLowerCase` | 1 |
| M11 | só o `upsert` normaliza; `ReferenciaDeVagaDto` não | 1 |

**M3 sobreviveu, e o código estava errado — não o teste.** O
`@SemCaractereDeControle` varre recursivamente, então ele já desce no item do
array sozinho: o `{ each: true }` era decorativo, e o comentário ao lado dele
afirmava uma coisa que o código não fazia. Sondado isoladamente
(`semCaractereDeControle(['node', 'type\u0000script'])` → `false` sem `each`) e
**removido**, com a medição escrita no DTO. Dois caminhos para o mesmo resultado,
um deles morto, é o que faz a próxima pessoa confiar no decorador errado.

M9 é a que mais vale guardar: uma regex com `g` guarda `lastIndex`, e a segunda
chamada começaria do meio da string — o validador erraria **alternadamente**, o
pior modo de falha possível, porque o teste de um caso passa e o board real não.

### Os dois testes de atomicidade começaram errados, e isso é o registro

A primeira versão espionava `prisma.trackedJob.upsert` e **passava com 201**, não
500. O serviço corrigido chama `tx.trackedJob`, e o `tx` da transação interativa
é **outro objeto** — o spy nunca era alcançado. O teste provava que o spy não
foi chamado, e nada sobre atomicidade.

O erro estava na expectativa, não no código. A correção foi um helper
(`espionarTransacao`) que embrulha o `$transaction`: a transação de verdade
continua sendo aberta pelo Prisma — é ela que faz o **rollback**, que é o que o
teste mede —, e o que muda é só o `tx` entregue ao callback. Assim as escritas
anteriores à falha acontecem de verdade, dentro da transação, e é o banco que
tem de voltar atrás. O `expect(chamadas).toBe(3)` existe para o teste não passar
provando apenas que nada começou, o que não é rollback.

### A exceção de `@UseGuards()`, declarada

O CLAUDE.md diz que **não há `@UseGuards()` em controller nenhum**, e o
`ExigirJsonGuard` é a primeira. A razão da regra é boa: guard de controller roda
**depois** do global, então usá-lo para *autorizar* deixaria a rota passando pelo
global primeiro — foi por isso que o JOB-50 recusou esse caminho para o token.

Este guard não autoriza: confere o `Content-Type`. Rodar depois do `AuthGuard` é
o que se **quer** aqui — quem não tem o segredo leva 401 e não descobre nada
sobre o formato aceito (há teste). Seu único desfecho possível é 415 ou "segue",
então não tem como abrir porta. A razão está escrita no controller.

### Números

| | Antes | Depois |
| --- | --- | --- |
| `ingestao.e2e.spec.ts` | 39 testes | **92** |
| `sem-controle.spec.ts` | — | **22** (novo, camada 1) |
| backend inteiro | — | **659 testes, 25 suítes** (88s) |
| frontend | 450 (+1 expected fail) | **450** — nenhum arquivo do front foi tocado |

O total do backend **antes** deste card não foi medido e está como `—` de
propósito: a árvore de trabalho tem vários cards não commitados (JOB-50, o
JOB-54 de ordenação, JOB-55, JOB-57) e o número do pedido deste card (516) é o
do JOB-50, não o do estado em que este trabalho começou. O que **é** deste card
e foi medido direto: `ingestao.e2e.spec.ts` 39 → 92, e o
`sem-controle.spec.ts` com 22 testes novos — 75 testes acrescentados.

`tsc` limpo (os 2 erros de `src/jobs/grupo.spec.ts` são anteriores, conferido
voltando ao estado pré-JOB-54 e recompilando).

### ⚠️ O `qa-rapido.py` tem 2 falhas, e NENHUMA é deste card

```
FALHA  anonimo recebe so vaga com 14+ dias (60 de 60 violaram)
FALHA  salvar vaga sem token responde 200 (deu 400)
```

**Provado pré-existente**: as correções foram revertidas na árvore, a API
rebuildada, e o `qa-rapido.py` deu **as mesmas duas falhas, idênticas**. Elas
vêm de outros cards não commitados na árvore de trabalho (o script foi
modificado por eles). A segunda é o próprio script: ele posta
`{"url": "..."}` sem `title`/`company`, que `SalvarVagaDto` exige — o 400 é a
validação funcionando, não regressão. Os dois blocos de ingestão do script
passam.

### O que ficou de fora, de propósito

- **`src/jobs/job.dto.ts:645,649` tem o mesmo defeito de data e NÃO foi
  corrigido** — está em produção, e o escopo deste card era o `ingest.dto.ts`.
  Medido no ar: `POST /jobs/saved` com `postedAt`/`foundAt` em `2026-02-31`
  responde **201** e devolve `2026-03-03` nos **dois** campos. Virou o
  [JOB-58](JOB-58-data-que-nao-existe-na-rota-de-salvar.md), na raia Bugs.
  (O card pedia numerar como JOB-55, mas esse número já existe na árvore — a
  explicação está no topo do JOB-58.)
- **`INGEST_TOKEN` continua fora da tabela do `docs/DEPLOY.md`.** Era "fora do
  escopo" neste card e segue sendo; não virou card.
- **Nada de novo sobre deduplicação por URL** — continua sendo o JOB-52.
