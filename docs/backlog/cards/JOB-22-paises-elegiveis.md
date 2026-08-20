# JOB-22 · `elegivelBrasil` vira `paisesElegiveis[]`

**Estado:** feito (20/08/2026)
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

- [x] Uma vaga "LATAM only" e uma "worldwide" deixam de ser indistinguíveis
- [x] Sem citação, o campo é `null` — nunca lista vazia
- [x] `types/api.ts` espelha o backend
- [ ] O usuário escolhe o país de origem — **fica para o JOB-23**, que já
      precisa do país para cruzar com `contrata_em`

## Medido (20/08)

124 vagas de uma busca por startup + remoto + 90 dias:

| | Vagas |
| --- | ---: |
| Aceita de qualquer lugar (`elegivelGlobal`) | 3 |
| Com países listados | 22 |
| Sem resposta (`null`) | 99 |

**Zero afirmações sem trecho, zero listas vazias.**

Os países citados mostram a distinção que o booleano apagava: `Europe` (7),
`LATAM` (5), `Americas timezones` (4), `Latin & South America` (2). Antes,
tudo isso viraria o mesmo `true`/`false`.

## Um bug de ordem de regex, achado ao medir

`"LATAM [Remote]"` virava `LATAM []`: a limpeza removia a palavra "Remote"
**antes** de tratar os colchetes. A limpeza foi centralizada em
`limparLugar()`, que tira delimitadores e o conteúdo deles primeiro, e a
pontuação solta por último. Depois da correção, `LATAM` subiu de 4 para 5 —
a vaga com resíduo passou a casar com as outras.

## Compatibilidade

Vaga gravada antes de 20/08 tem `elegivelBrasil` no `snapshot` Json.
`vagas.service.ts` converte na leitura (`true` → `['Brazil']`), o que evita
migração de dados.

O motor do Firecrawl ainda devolve o booleano do prompt antigo; a conversão
acontece em `elegibilidade()`. Reescrever aquele prompt é trabalho do
[JOB-08](JOB-08-prompt-de-busca.md).
