# JOB-11 · Página de listagem dentro do ATS ainda passa

**Estado:** resolvido por outro caminho (25/08/2026)
**Tamanho:** P

## Por quê

O [JOB-10](JOB-10-consultas-dirigidas.md) tirou do caminho a listagem de job
board (`roberthalf.com/.../java-developer`, "140 results"). Sobrou uma versão
menor do mesmo problema, **dentro dos ATS**.

Medido em 17/08 na busca por `regiao: latam`, 7 vagas devolvidas:

| Veio de | O que a tela mostrou |
| --- | --- |
| `jobs.lever.co/binance?workplaceType=remote` | "Business Development - Payment (Global)" — Binance |
| `jobs.lever.co/bluelightconsulting?location=Rio...` | "Business Development Representative" |

**2 de 7 não são vagas de engenharia.** As duas URLs são o quadro de vagas da
empresa, com dezenas de cards; a extração escolheu um. É o mesmo defeito do
JOB-09 — pedir UM cargo a uma página que tem muitos —, só que confinado a uma
empresa, então a "empresa" ao menos está certa.

## O que difere de uma vaga

A URL diz. Anúncio tem id próprio no caminho:

```
jobs.lever.co/padsplit/cda4224e-1e56-4001-8c59-7bfeed55c7cc     vaga
job-boards.greenhouse.io/clara/jobs/5181974007                  vaga
jobs.ashbyhq.com/latamcent/3ae442aa-9e99-...                    vaga

jobs.lever.co/binance?workplaceType=remote                      listagem
jobs.lever.co/bluelightconsulting?location=Rio%20de%20Janeiro   listagem
job-boards.greenhouse.io/clara/jobs/5095340007 ("Jobs at Clara")  listagem
```

Padrão: **segmento de id depois do nome da empresa**. Listagem tem query string
ou para no nome da empresa.

O terceiro caso mostra que só a URL não basta — `clara/jobs/5095340007` tem id e
mesmo assim voltou como "Jobs at Clara". Para esse, o sinal é o título genérico
mais a ausência de campo de vaga; o `ehListagem` do schema já existe e **nunca
foi usado para descartar**.

## O que fazer

Em `backend/src/jobs/busca.service.ts`:

- Descartar por URL **antes do scrape** — economiza 5 créditos por página que
  não serviria.
- Ligar o `ehListagem` que o schema já extrai, como segunda barreira para o que
  passar pela URL.
- Contar no log o que foi descartado e por quê. Descarte silencioso foi o que
  escondeu o rate limit em 17/08.

## Critérios de aceite

- [x] `jobs.lever.co/<empresa>?...` não é aberta
- [x] `job-boards.greenhouse.io/<empresa>/jobs/<id>` continua sendo aberta
- [ ] Uma busca real por `regiao: latam` não devolve vaga de Business Development
- [ ] O log diz quantas URLs foram descartadas por listagem

## Cuidado ao implementar

Não transformar isto em lista de domínio proibido. Os domínios estão certos — é
a **forma da URL** que separa anúncio de índice, e `lever.co` hospeda os dois.


## Resolvido pelo caminho que o produto tomou (25/08/2026)

Não foi corrigido — **deixou de ser alcançável**. Duas mudanças posteriores
mataram o defeito pelos dois lados:

**1. O `ehListagem` passou a descartar de verdade.** O card pedia "ligar o
`ehListagem` que o schema já extrai"; ele está ligado em
`backend/src/jobs/busca.service.ts:270` — `if (j.ehListagem === true) return null`.

**2. O motor de ATS ([JOB-20](JOB-20-motor-de-ats.md)) virou o caminho
principal, e ele não consegue devolver listagem.** A URL não vem de uma busca
que pode cair num quadro de vagas: é montada a partir do id do anúncio na API
do ATS. Conferido nas 58 vagas do banco — as 58 têm id de anúncio:

```
job-boards.greenhouse.io/sonyinteractiveentertainmentglobal/jobs/6145057004
jobs.lever.co/netomi/0e6b7355-330a-4d10-b8d5-c235bd555622
jobs.ashbyhq.com/belvo/d9156c58-6c5e-4852-b9d9-00b8133d1b2d
```

Nenhuma com query string, nenhuma parando no nome da empresa — que eram
exatamente os dois padrões que o card identificou como listagem.

**O que continua valendo:** se o motor do Firecrawl voltar a ser o caminho
principal, o descarte por URL **antes** do scrape (que economizaria 5 créditos
por página inútil) segue não implementado. Fica registrado, não fechado por
esquecimento.
