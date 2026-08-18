# JOB-17 · Catálogo de ATS do look4job como fonte de vagas

**Estado:** medido (18/08/2026) — falta decidir
**Tamanho:** M

## O que existe

`~/projects/look4job/backend/data/companies.yaml` — **1.953 empresas**, cada uma
com `name`, `url`, `ats`, `slug`, `priority` e `hiring_countries`. Gerado por
`probe_sources.py` e verificado por `verify_companies.py`.

| ATS | Empresas |
| --- | ---: |
| greenhouse | 573 |
| ashby | 507 |
| lever | 215 |
| bamboohr | 199 |
| workable | 174 |
| workday | 173 |
| recruitee | 55 |
| rippling | 11 |

**118 empresas declaram contratar no Brasil.**

O look4job também tem **coletores prontos** em
`backend/look4job/collectors/ats_*.py` — greenhouse, lever, ashby, workable,
workday. É a resposta à pergunta "será que tem API de ATS": tem, e já estão
implementadas ali.

## As APIs, verificadas hoje

Públicas, sem chave, sem custo:

```
https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
https://api.ashbyhq.com/posting-api/job-board/{slug}
```

Medido em 18/08: GitLab devolveu **199 vagas numa chamada**; Ramp (Ashby), 137.

## A escala, e o balde de água fria

Dez empresas do Greenhouse que declaram Brasil:

| Métrica | Valor |
| --- | ---: |
| Vagas totais | 771 |
| De engenharia | 279 |
| **Com local Brasil/LATAM/global** | **4** |

**`hiring_countries` é da EMPRESA, não da vaga.** A Adyen tem 221 vagas e
escritório em São Paulo — quase todas são para Amsterdam. O catálogo diz onde a
empresa *pode* contratar, e não onde *aquela vaga* aceita.

Projeção ingênua: ~3.160 vagas nas 40 empresas Greenhouse com Brasil. Projeção
honesta: a maioria não serve, e separar exige ler cada anúncio.

## Comparação com o que o Horizons tem

| | Vagas | Custo | Elegibilidade |
| --- | ---: | --- | --- |
| Firecrawl | 7 | 42 créditos | 0 de 7 |
| IA (`web_search`) | 15 | 1 chamada | **15 de 15, citada** |
| API de ATS | ~centenas | **grátis** | precisa ler cada uma |

## A leitura

A API de ATS é **melhor fonte** e **pior filtro**. Ela resolve de vez os
problemas de origem — [JOB-11](JOB-11-listagem-dentro-do-ats.md) (listagem
virando vaga) e [JOB-12](JOB-12-url-de-vaga-nao-se-valida-por-status.md) (URL
que não se valida) deixam de existir, porque a API devolve um registro por
vaga, com URL canônica.

Mas ela não responde "aceita brasileiro?", que é a pergunta que este produto
existe para responder — e é justamente onde a IA foi bem.

**O desenho que os números sugerem:** API de ATS para achar (grátis, volume,
confiável) + IA para filtrar elegibilidade (o que ela faz bem). Deixa de existir
o passo caro e frágil no meio, que é o scraping.

## O que decidir

1. **Copiar o `companies.yaml` para cá, ou ler do look4job?** Copiar duplica um
   dado que envelhece; ler cria dependência entre dois projetos. Copiar com
   proveniência anotada parece melhor — o arquivo já diz que é gerado.
2. **Quais ATS implementar?** Greenhouse + Ashby + Lever cobrem 1.295 das 1.953.
3. **Quantas empresas consultar por busca?** 40 chamadas grátis é viável, mas
   ler 279 anúncios com IA não é.

## Não medido

- BambooHR, Workday, Recruitee e Rippling — os coletores existem no look4job,
  mas não testei as APIs.
- Se o `companies.yaml` está atualizado. O cabeçalho não tem data.
