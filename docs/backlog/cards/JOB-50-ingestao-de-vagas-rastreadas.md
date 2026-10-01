# JOB-50 · O Horizons recebe vagas rastreadas

**Estado:** backlog (01/10/2026)
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

- [ ] O mesmo lote enviado duas vezes deixa o banco idêntico
- [ ] `upsert` de vaga existente atualiza, não duplica
- [ ] `confirmar` muda só `confirmadaEm`
- [ ] `fechar` apaga a linha; `SavedJob` da mesma URL continua lá
- [ ] Sem token, ou com token errado: 401 — **inclusive com
      `AUTH_DISABLED=true`**
- [ ] Sem `INGEST_TOKEN` configurado: 503, e nada é gravado
- [ ] A elegibilidade gravada vem de `lerElegibilidade` sobre o `local` cru,
      nunca de campo enviado pelo rastreador
- [ ] A limpeza apaga a vaga vencida e poupa a que foi confirmada ontem
- [ ] Teste e2e no repositório cobrindo os itens acima
- [ ] `scripts/qa-rapido.py` conhece a rota nova
- [ ] Migration nova (o fluxo é `migrate deploy`, não `db push`)

## Fora do escopo

A busca ainda **não lê** desta tabela — isso é o
[JOB-52](JOB-52-busca-le-da-copia-local.md). Aqui a tabela só enche.
