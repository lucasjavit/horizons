# JOB-20 · Motor de ATS — a busca passa a consultar a fonte

**Estado:** pronto para fazer
**Tamanho:** M

## Por quê

O catálogo e as APIs de ATS estão no repositório desde 18/08 e **nenhuma linha
de código os consome**. Enquanto isso a busca usa Firecrawl ou IA, que custam
mais e entregam menos.

| Motor | Vagas | Custo | Tempo |
| --- | ---: | --- | --- |
| Firecrawl | 7 | 42 créditos | ~60s |
| IA (`web_search`) | 15 | US$ 0,04 | ~40s |
| **ATS** | **27.725** | **R$ 0** | **58s** |

Não é ganho de eficiência, é ordem de grandeza. Medido em 18/08: 545 empresas,
zero 429; e numa amostra menha, 30 empresas → 1.739 vagas em 15s.

## O que fazer

Portar os coletores de `~/projects/look4job/backend/look4job/collectors/`
(Python) para TypeScript em `backend/src/jobs/`:

```
https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
https://api.lever.co/v0/postings/{slug}?mode=json
```

Os sete respondem 200: greenhouse, ashby, lever, bamboohr, workable, recruitee
e workday (este só com slug completo `tenant.wdN.../site` — 2 de 8 deram 422).

Ler `backend/data/ats/empresas.yaml` (839 empresas) para saber slug e ATS.

**Concorrência 20 com backoff.** O teto não foi alcançado em ~700 requisições,
mas "não achei o limite" não é "não existe".

## Por que isso resolve três cards de uma vez

| Card | Como some |
| --- | --- |
| [JOB-11](JOB-11-listagem-dentro-do-ats.md) | a API devolve um registro por vaga — não há listagem para confundir |
| [JOB-12](JOB-12-url-de-vaga-nao-se-valida-por-status.md) | a URL vem canônica no campo |
| salário fraco (4 de 15) | Ashby: **137 de 137** com faixa estruturada |

## Critérios de aceite

- [ ] Uma busca real devolve mais de 1.000 vagas
- [ ] Custo zero — nenhum crédito de Firecrawl, nenhum token de IA
- [ ] Slug morto (`plaid`) responde vazio sem derrubar a busca
- [ ] O motor aparece junto de Firecrawl e IA na escolha
- [ ] `qa-rapido.py` passa

## Cuidado

**Slug morre.** O catálogo é de 27/07; board fecha e empresa troca de ATS.
Resposta vazia é normal, não erro — ver `backend/data/ats/LEIA-ME.md`.
