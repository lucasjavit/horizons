# JOB-50 · O Horizons recebe vagas rastreadas

**Estado:** feito (01/10/2026)
**Tamanho:** M
**Pai:** [JOB-49](JOB-49-rastreador-de-vagas-arquitetura.md)

## Por quê

O rastreador envia; alguém precisa receber. Este card é o lado do Horizons do
contrato, e vem primeiro porque dá para construir e testar sem o rastreador
existir: um `curl` com um lote de exemplo basta.

## O que fazer

**Uma tabela nova**, separada de `FoundJob`. `FoundJob` é cache de uma rodada
de busca, com `grupo` e `expiresAt` de 15 dias; a vaga rastreada não pertence
a grupo nenhum e não expira por idade, só por fechamento ou falta de
confirmação.

Campos: os de conteúdo que `FoundJob` já tem (título, empresa, url, local,
regime, skills, área, `postedAt`, snapshot) mais:

- `fonte` + `idExterno`, com `@@unique` — a chave da idempotência;
- `confirmadaEm` — a última vez que o rastreador mencionou a vaga.

**Um endpoint**, `POST /api/ingest/jobs`, que recebe um lote com três listas:

| Lista | O que o Horizons faz |
| --- | --- |
| `upsert` (vaga completa) | aplica `lerElegibilidade`, grava por `(fonte, idExterno)`, marca `confirmadaEm = agora` |
| `confirmar` (só ids) | atualiza `confirmadaEm` |
| `fechar` (só ids) | **apaga** a linha |

A resposta diz quantos de cada foram aceitos; é com ela que o rastreador tira
os itens da fila.

**Uma limpeza agendada** que apaga a vaga com `confirmadaEm` mais antiga que N
dias (N configurável; sugestão 7).

## As armadilhas que este card tem de fechar

- **O token não pode depender do `AuthGuard`.** Com `AUTH_DISABLED=true`
  nenhuma rota exige token (estado atual), e este endpoint grava no banco.
  Ele precisa de segredo próprio (`INGEST_TOKEN`), conferido no handler mesmo
  com o login desligado. Sem a variável, a rota responde 503 — não aceita
  tudo.
- **`forbidNonWhitelisted` rejeita campo sem decorador.** O DTO do lote
  precisa de `@ValidateNested` + `@Type` nas listas, senão o lote inteiro dá
  400 ou, pior, passa sem validar os itens.
- **Lote grande.** Teto de itens por chamada, e o limite de corpo do Nest
  conferido contra ele.
- **`fechar` de id que não existe** é sucesso, não erro: reenvio de lote é o
  caso normal.
- **Não tocar em `SavedJob` nem `JobHistory`.** Apagar a vaga rastreada não
  pode mexer no que é do usuário.

## Critérios de aceite

- [x] O mesmo lote enviado duas vezes deixa o banco idêntico
- [x] `upsert` de vaga existente atualiza, não duplica
- [x] `confirmar` muda só `confirmadaEm`
- [x] `fechar` apaga a linha; `SavedJob` da mesma URL continua lá
- [x] Sem token, ou com token errado: 401 — **inclusive com
      `AUTH_DISABLED=true`**
- [x] Sem `INGEST_TOKEN` configurado: 503, e nada é gravado
- [x] A elegibilidade gravada vem de `lerElegibilidade` sobre o `local` cru,
      nunca de campo enviado pelo rastreador
- [x] A limpeza apaga a vaga vencida e poupa a que foi confirmada ontem
- [x] Teste e2e no repositório cobrindo os itens acima
- [x] `scripts/qa-rapido.py` conhece a rota nova
- [x] Migration nova (o fluxo é `migrate deploy`, não `db push`)

## Fora do escopo

A busca ainda **não lê** desta tabela — isso é o
[JOB-52](JOB-52-busca-le-da-copia-local.md). Aqui a tabela só enche.

## O que foi feito (01/10/2026)

**O desenho que resolveu a armadilha do token: um terceiro decorador.**

`@TokenDeIngestao()`, em `backend/src/auth/current-user.ts`, conferido **dentro
do `AuthGuard` e antes do desvio de `AUTH_DISABLED`**. As três alternativas
foram pesadas e as duas primeiras recusadas:

| Caminho | Por que não |
| --- | --- |
| `@Public()` + checagem no handler | com `AUTH_DISABLED=true` a checagem no handler seria a **única** camada de uma rota que escreve. E o `ValidationPipe` roda depois do guard: corpo vazio sem token daria **400**, e o `fail-closed.e2e.spec.ts` exige 401 — 400 ali é indistinguível de "o pipe correu antes do guard" |
| `@UseGuards()` próprio no controller | roda **depois** do guard global, então com `AUTH_DISABLED=false` o rastreador precisaria de um JWT de usuário, que ele não tem |
| **`@TokenDeIngestao()` no guard global** | **escolhido.** Roda antes de tudo, inclusive de `@Public()` e do `AUTH_DISABLED`, e a rota **continua fora** das listas de públicas/opcionais — então o piso do `fail-closed` (*toda rota protegida responde 401 ao anônimo*) passa a valer sobre ela **sem exceção nomeada** |

**Nenhum teste foi afrouxado.** Os pisos do `fail-closed.e2e.spec.ts`
continuam `>50` rotas e `>40` protegidas, e as listas `PUBLICAS_ESPERADAS`
(sete) e `OPCIONAIS_ESPERADAS` (três) **não ganharam linha**.

### Os três estados da porta, e nenhum é "aceita tudo"

| Estado | Resposta |
| --- | --- |
| `INGEST_TOKEN` ausente, vazio, ou com menos de 32 caracteres | **503** |
| token ausente, errado, sem `Bearer`, ou um JWT de sessão válido | **401** |
| token igual (comparação em tempo constante, `timingSafeEqual`) | 201 |

O 503 vem **antes** da comparação de propósito: com a variável vazia, um
`recebido === esperado` casaria com header ausente, e a rota de escrita
atenderia qualquer um.

### O que foi medido no ar, com os containers de pé

Com `AUTH_DISABLED=true` no container — o estado atual do projeto:

```
/api/settings/tokens sem token  -> HTTP 200   (o login está desligado)
POST /api/ingest/jobs sem token -> HTTP 401   {"message":"Token de ingestao invalido."}
POST /api/ingest/jobs c/ errado -> HTTP 401
```

E com `INGEST_TOKEN` vazio, ainda em `AUTH_DISABLED=true`, com **qualquer**
token no header: **503**, e `select count(*) from tracked_jobs` inalterado.

O lote de exemplo, que é o que o card diz bastar para testar sem o rastreador:

```
POST /api/ingest/jobs  (upsert de 2 + fechar de 1 id inexistente)
  -> 201 {"gravadas":2,"confirmadas":0,"fechadas":0}
o MESMO lote de novo
  -> 201 {"gravadas":2,"confirmadas":0,"fechadas":0}   (banco idêntico)
confirmar (1 existente + 1 inexistente)
  -> 201 {"gravadas":0,"confirmadas":1,"fechadas":0}
fechar (1 existente + 1 que já tinha ido)
  -> 201 {"gravadas":0,"confirmadas":0,"fechadas":1}
campo `paisesElegiveis` no item
  -> 400 ["upsert.0.property paisesElegiveis should not exist"]
```

A elegibilidade no banco, calculada pelo **Horizons** sobre o `local` cru:
`Remote, Canada` → `["Canada"]` / `global: false`; `Remote — Worldwide` →
`null` / `global: true`.

### O teto de itens contra o limite de corpo — e o teste que passava por sorte

Medido: 200 vagas realistas dão **152,9 KB**; as três listas cheias, **171,7
KB**. O padrão do body parser é **102.400 bytes**
(`body-parser/lib/utils.js:62`), então o lote morreria com **413 antes do
`ValidationPipe`**. Daí `LIMITE_DO_CORPO = '2mb'`, numa constante
compartilhada entre `main.ts` e `test/aplicacao-de-teste.ts` — o helper de
teste copia a configuração à mão, e o número escrito duas vezes faria o 413
aparecer só em produção.

**A primeira versão do teste do teto não detectava a mutação**: ele mandava 200
vagas enxutas, 97,3 KB, passando raspando nos 100 KB do padrão. Corrigido para
o lote cheio do card, com um `expect(bytes).toBeGreaterThan(102_400)` para não
voltar a passar por sorte.

### Onde o card errou, e vale registrar

**A armadilha do `@Type` é o contrário do que o card supõe.** O card previa que
a falta dele fosse o pior caso — *"passa sem validar"*, com o `whitelist`
apagando os campos e gravando vazio com 200. Sonda direta nesta versão
(class-validator 0.15, class-transformer 0.5):

```
ComType -> erros: 0  {"itens":[{"id":"abc"}]}
SemType -> erros: 1  {"itens":[{"id":"abc"}]}
```

O objeto **não** é esvaziado, e a validação falha **alto**: a rota responde 400
para todo lote, inclusive o válido (a mutação que removeu os `@Type` reprovou
**22 dos 39** testes). Quem silencia é a falta de **`@ValidateNested`** — aí os
decoradores do item não rodam, um `idExterno` vazio entra, e a resposta é 201.
As duas continuam necessárias; o risco é que inverte de lugar.

**O `INGEST_TOKEN` teve de entrar no `test/ambiente.ts`.** Sem ele o
`fail-closed.e2e.spec.ts` recebia **503** onde exige 401 e acusava a rota de
vazar — quando o que faltava era configuração. Definir no ambiente de teste
**não afrouxa nada**: com a variável presente o anônimo bate na comparação do
segredo e leva 401 como qualquer rota protegida, e o 503 continua provado no
`ingestao.e2e.spec.ts`, que apaga a variável de propósito.

**Este card mexeu no frontend, ao contrário do previsto.** O
`erros-do-servidor.spec.ts` (APP-02) lê `backend/src/` do disco e reprova
mensagem em português sem tradução — as duas novas caíram nele. Nenhuma tela
mostra essas mensagens (quem chama é o rastreador), mas abrir exceção por
julgamento é o que faz a trava parar de pegar a próxima, então as duas foram
traduzidas.

### Números

| | Antes | Depois |
| --- | --- | --- |
| backend | 477 testes, 20 suítes | **516 testes, 21 suítes** (59s) |
| frontend | 361 | **363** (as duas traduções novas) |
| migrations | 21 | **22** (`20261001160000_vagas_rastreadas`) |
| tabelas no banco | 15 | **16** (`tracked_jobs`, **sem nenhuma FK**) |

`tsc` limpo (os dois erros de `grupo.spec.ts` são anteriores a este card —
conferido com `git stash`), `npm run build` limpo, `qa-rapido.py` **tudo
certo** com as duas checagens novas.

### 17 mutações, 17 mataram teste

As três que mais importam: a checagem do token movida para **depois** do
`AUTH_DISABLED` matou exatamente os 3 testes de `AUTH_DISABLED=true`, e só
eles; `@Public()` no lugar do decorador próprio matou **11 testes da suíte +
a lista fechada do `fail-closed`**; e `@Public()` no servidor **no ar** fez a
rota responder **201** a quem não tem token, com o `qa-rapido.py` reprovando.

Duas ensinaram antes de matar: o teto de corpo (acima), e o
`createMany({ skipDuplicates })` no lugar do `upsert` — que **não** quebrou o
teste de idempotência, porque ignorar duplicata também é idempotente. Quem o
pegou foi *"upsert de vaga existente atualiza"*. Idempotência sozinha não prova
que atualiza.

### O que ficou de fora, de propósito

- **A busca não lê desta tabela** — é o JOB-52, como o card diz. A tabela só
  enche.
- **Os prazos continuam não medidos.** Os 7 dias são a sugestão do JOB-49;
  `INGEST_DIAS_SEM_CONFIRMACAO` existe para o número certo aparecer quando o
  rastreador existir. Valor ausente, zero, negativo ou não-numérico cai no
  padrão — **nunca em zero**, que apagaria o acervo na primeira limpeza.
- **Nenhuma tela.** Não há onde ver o acervo rastreado nem o resultado da
  última limpeza; só o log da API.
- **Sem versionamento do contrato.** O JOB-49 diz que *"o contrato de envio é
  a API do produto, vale versionar desde o começo"*; a rota é
  `/api/ingest/jobs`, sem `/v1`. Fica anotado como dívida consciente — o
  rastreador ainda não existe, e versionar agora seria escolher o formato da
  versão sem nenhum cliente para validá-lo.
