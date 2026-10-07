# JOB-58 · `2026-02-31` entra na vaga salva e vira 3 de março

**Estado:** pronto para fazer (06/10/2026)
**Tamanho:** P
**Achado por:** [JOB-54](JOB-54-ingestao-grava-lote-pela-metade.md) — o mesmo
defeito, no lugar que **já está em produção**

> ⚠️ **Sobre o número.** O pedido deste card dizia "numere como JOB-55", mas
> `JOB-55-ia-verifica-remoto-do-meu-pais.md` já existe na árvore, e o `JOB-54`
> já está duplicado (`JOB-54-ingestao-grava-lote-pela-metade` e
> `JOB-54-ordenacao-e-filtro-de-data`). Um terceiro número repetido faria o
> quadro mentir sobre qual card é qual. Daí **JOB-58**, o primeiro livre. A
> duplicata do JOB-54 ficou como está: renomear card fechado quebraria os links
> que já apontam para ele, e isso é decisão de outra pessoa.

## O problema

`src/jobs/job.dto.ts:645,649` usa `@IsISO8601()` **sem `{ strict: true }`** em
`postedAt` e `foundAt` do `SalvarVagaDto`. A biblioteca aceita dia que não
existe no mês, e o `new Date()` do serviço rola para o mês seguinte, calado.

O JOB-54 corrigiu o `ingest.dto.ts` e **deixou este de propósito**: mexer em
código de produção fora do escopo do card era o que o card proibia. Mas o
defeito é o mesmo, e aqui ele atinge dado **do usuário**.

## Medido no ar (06/10/2026, API em :3333, `AUTH_DISABLED=true`)

```bash
curl -s -X POST http://localhost:3333/api/jobs/saved \
  -H 'Content-Type: application/json' \
  -d '{"title":"QA JOB-55","company":"C","url":"https://e.com/job55-probe",
       "postedAt":"2026-02-31T00:00:00Z","foundAt":"2026-02-31T00:00:00Z"}'
```

**Obtido:** `201`, e na resposta (e no banco):

```json
"postedAt":"2026-03-03T00:00:00.000Z","foundAt":"2026-03-03T00:00:00.000Z"
```

**Os dois campos** corrompem, não só o `postedAt`. Sonda na lib (`validator`,
dentro do container):

| Entrada | `@IsISO8601()` | `{ strict: true }` | O que gravava |
| --- | --- | --- | --- |
| `2026-02-31` | aceita | **recusa** | `2026-03-03` |
| `2026-02-30` | aceita | **recusa** | `2026-03-02` |
| `2026-04-31` | aceita | **recusa** | `2026-05-01` |
| `2026-02-28` | aceita | aceita | `2026-02-28` ✅ |

## Por que importa mais aqui que no ingest

Na ingestão quem escreve é um processo e ninguém olha a tabela. Aqui o dado vai
para a **lista de vagas salvas da pessoa**, com a data aparecendo na tela: a
vaga publicada em 31 de fevereiro (que o ATS às vezes manda, por bug dele) passa
a dizer 3 de março, e a ordenação por data — que o
[JOB-54 de ordenação](JOB-54-ordenacao-e-filtro-de-data.md) acabou de
introduzir — ordena por um valor que ninguém escreveu.

**É a terceira vez que este defeito aparece.** O CLAUDE.md registra *"o RFC
aceitando 31 de fevereiro"* como bug de 31/08; o JOB-54 o achou no
`ingest.dto.ts`; e ele continua aqui. A causa é sempre a mesma: `@IsISO8601()`
sem a flag é o padrão que se copia do arquivo vizinho.

## O que fazer

1. **`@IsISO8601({ strict: true })`** nos dois campos de
   `src/jobs/job.dto.ts:645,649`.
2. **Varrer o resto**: `grep -rn "@IsISO8601()" backend/src/` e decidir campo
   por campo — o defeito se espalha por cópia, então corrigir um lugar sem
   olhar os outros garante a quarta vez.
3. **Conferir se alguma vaga já salva tem data rolada.** Não dá para distinguir
   `2026-03-03` corrompida de `2026-03-03` legítima depois do fato, então o
   que cabe é medir quantas existem e registrar; não há migração de dados
   possível.

## Critérios de aceite

- [ ] `postedAt: "2026-02-31"` em `POST /jobs/saved` → **400**
- [ ] `foundAt: "2026-02-31"` → **400**
- [ ] O que já dava 400 continua dando: `"banana"`, `"01/08/2026"`, mês 13,
      ano de 5 dígitos, epoch numérico
- [ ] Data válida continua entrando, **incluindo bissexto de verdade**
      (`2028-02-29`) e data com fuso (`2026-09-20T12:00:00-03:00`)
- [ ] Nenhum outro `@IsISO8601()` sem `strict` sobrou em `backend/src/`, ou o
      que sobrou tem a razão escrita
- [ ] Teste no repositório, **visto falhar** com a flag removida
- [ ] A tela de vagas salvas continua funcionando (é dado do usuário)

## Risco: este é código em produção

Diferente do `ingest.dto.ts`, esta rota tem cliente real — a estrela da lista de
vagas. O `strict: true` **recusa** o que antes entrava, então vale conferir que
nenhum motor de busca do Horizons produz data no formato que a flag rejeita
antes de subir. O JOB-54 mediu que `2026-09-20` (data sem hora),
`2026-09-20T12:00:00.000Z` e `2026-09-20T12:00:00-03:00` **passam** no strict —
são os três formatos que os motores usam hoje —, mas a conferência cabe aqui
porque é aqui que quebrar custa.
