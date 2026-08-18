# Catálogo de ATS

**Origem: `look4job`, copiado em 18/08/2026.** O look4job vai ser
descontinuado — este diretório é a cópia que sobrevive a ele, e não um espelho.
Não há nada a sincronizar; a partir daqui o dado é do Horizons.

Os arquivos foram gerados lá por `probe_sources.py` e verificados por
`verify_companies.py`. O `companies.yaml` original tinha a data de 27/07/2026.

## O que tem aqui

| Arquivo | O que é | Itens |
| --- | --- | ---: |
| `empresas.yaml` | empresas **curadas**, com ATS, slug e países | 1.953 |
| `slugs-greenhouse.json` | todo board conhecido do Greenhouse | 8.333 |
| `slugs-bamboohr.json` | idem, BambooHR | 11.316 |
| `slugs-lever.json` | idem, Lever | 4.367 |
| `slugs-ashby.json` | idem, Ashby | 3.161 |

`empresas.yaml` é o dado rico: `name`, `url`, `ats`, `slug`, `priority` e
`hiring_countries`. **118 empresas declaram contratar no Brasil.**

Os `slugs-*.json` são listas cruas de identificador de board — sem nome de
empresa, sem país. Servem para descobrir boards que a curadoria não alcançou.

## As APIs, verificadas em 18/08/2026

Públicas, sem chave, sem custo:

```
https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
https://api.lever.co/v0/postings/{slug}?mode=json
```

Medido: GitLab (greenhouse) devolveu 199 vagas numa chamada; Ramp (ashby), 137 —
e **137 de 137 com faixa salarial estruturada**
(`"$211.4K – $290.6K • Offers Equity"`), em vez de lida do texto. O Lever traz
`workplaceType: "remote"` pronto.

Isso é o oposto do problema que o [JOB-09](../../../docs/backlog/cards/JOB-09-vaga-so-afirma-o-que-cita.md)
tratou: aqui o salário **vem do campo**, não de uma citação que precisa ser
conferida.

## Duas armadilhas medidas

**`hiring_countries` é da EMPRESA, não da vaga.** Em 10 empresas com "Brazil"
declarado: 771 vagas, 279 de engenharia, e **apenas 4** com local Brasil/LATAM.
A Adyen tem 221 vagas e escritório em São Paulo — quase todas para Amsterdam.
Usar esse campo como filtro de elegibilidade daria uma lista errada.

**Slug morre.** `plaid` respondeu vazio e `netflix` não existe no Lever. O
catálogo é de julho; board fecha e empresa troca de ATS. Quem consumir precisa
tratar resposta vazia como normal, não como erro.
