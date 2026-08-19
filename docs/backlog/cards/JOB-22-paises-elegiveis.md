# JOB-22 · `elegivelBrasil` vira `paisesElegiveis[]`

**Estado:** pronto para fazer
**Tamanho:** P

## Por quê

O campo hoje pergunta *"aceita quem mora no Brasil?"*. O produto deixou de ser
só para brasileiros ([JOB-19](JOB-19-produto-dois-lados.md)): **a Índia tem 291
empresas** no catálogo contra 110 do Brasil.

Um booleano não representa a pergunta certa. E ele já era grosseiro antes:
"worldwide" e "contrata na LATAM" viram o mesmo `true` — problema levantado no
[JOB-08](JOB-08-prompt-de-busca.md) e nunca resolvido.

## O que fazer

`elegivelBrasil: boolean | null` → `paisesElegiveis: string[] | null`, com o
trecho de origem preservado (regra do JOB-09: sem citação, sem afirmação).

A tela passa a perguntar de onde a pessoa é, e filtra por isso.

Vive dentro de `snapshot Json?`, não é coluna do Prisma — a migração é menor
do que parece.

## Critérios de aceite

- [ ] Uma vaga "LATAM only" e uma "worldwide" deixam de ser indistinguíveis
- [ ] O usuário escolhe o país de origem
- [ ] Sem citação, o campo é `null` — nunca lista vazia interpretada como "não aceita"
- [ ] `types/api.ts` espelha o backend
