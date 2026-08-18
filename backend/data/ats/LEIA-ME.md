# Catálogo de ATS

**Origem: `look4job`, copiado em 18/08/2026.** O look4job vai ser
descontinuado — este diretório é a cópia que sobrevive a ele, e não um espelho.
Não há nada a sincronizar; a partir daqui o dado é do Horizons.

Os arquivos foram gerados lá por `probe_sources.py` e verificados por
`verify_companies.py`. O `companies.yaml` original tinha a data de 27/07/2026.

## O que tem aqui

| Arquivo | O que é | Itens |
| --- | --- | ---: |
| `empresas.yaml` | empresas **curadas e filtradas por país**, com ATS e slug | 866 |
| `slugs-greenhouse.json` | todo board conhecido do Greenhouse | 8.333 |
| `slugs-bamboohr.json` | idem, BambooHR | 11.316 |
| `slugs-lever.json` | idem, Lever | 4.367 |
| `slugs-ashby.json` | idem, Ashby | 3.161 |

`empresas.yaml` é o dado rico: `name`, `url`, `ats`, `slug`, `priority` e
`hiring_countries`. **118 empresas declaram contratar no Brasil.**

### O filtro por país (18/08/2026)

Das 1.953 originais ficaram **866**, pelas regiões que interessam ao produto:
United States, Australia, Brazil, LATAM, Europa, Canada e United Arab Emirates.
Roda por `scripts/filtrar-empresas.py`.

| ATS | Empresas |
| --- | ---: |
| greenhouse | 276 |
| workday | 136 |
| lever | 127 |
| ashby | 121 |
| workable | 90 |
| bamboohr | 88 |
| recruitee | 22 |

**"Latam" e "Europe" não existem no arquivo** — `hiring_countries` só tem país
individual (139 valores distintos). O script expande as duas em 17 e 34 países.

O critério é **união**: fica quem contrata em ao menos um dos alvos. Empresa que
só contrata nos EUA continua valendo — quem decide é o `elegivelBrasil` da
vaga, não este arquivo.

**Das 1.087 removidas, 1.012 não tinham `hiring_countries` preenchido.** Ou
seja: a maioria saiu por falta de dado, e não por país errado. As demais eram
Índia, Indonésia, Turquia e Japão. Se um dia faltar volume, essas 1.012 são o
primeiro lugar a olhar — provavelmente há empresa boa entre elas, só não
verificada.

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

## `fontes.yaml` — a configuração de fontes

Veio de `config/sources.yaml` do look4job, e tem o que o `empresas.yaml` não
tem: **de onde buscar quando não há ATS+slug**.

### `apis` — cinco APIs de vagas remotas, sem chave

Testadas em 18/08/2026:

| API | Devolveu | Campo que interessa |
| --- | ---: | --- |
| Arbeitnow | 175 | `remote`, `location` |
| Remotive | 17 | **`candidate_required_location`** |
| Himalayas | ok | `locationRestrictions`, `currency`, `expiryDate` |
| RemoteOK | não testado | — |
| WeWorkRemotely | RSS, não testado | — |

**`candidate_required_location` é a pergunta de elegibilidade como campo.** Em
40 pedidas / 17 devolvidas, 6 diziam "Worldwide". Não precisa de IA para ler.

Ressalva medida: o Remotive é fraco para dev — das 17, a maioria era marketing,
freelance writer e sales. Volume pequeno e categoria mista. O Arbeitnow devolveu
175 numa chamada e merece um teste melhor.

### `search_profile` — o Horizons descrito em YAML

```yaml
stack: ["Java", "Spring Boot"]
remote: ["Worldwide", "LATAM"]
must_accept: "Brazil"
scope: "somente vagas internacionais"
```

É a mesma decisão de produto que o filtro LATAM (JOB-04) implementou na tela.

### `watchlist` — ~90 startups sem API

Cursor, Baseten, Cognition, Dub, Distyl. Página de carreira própria, sem ATS
consultável. **É aqui que o Firecrawl continua fazendo sentido** — e só aqui.

### `linkedin` — desligado, e deve continuar

`enabled: false`, com o risco anotado no próprio arquivo: endpoint não
documentado, rate limit por IP. O Horizons já decidiu evitar LinkedIn e Indeed.

## Duas armadilhas medidas

**`hiring_countries` é da EMPRESA, não da vaga.** Em 10 empresas com "Brazil"
declarado: 771 vagas, 279 de engenharia, e **apenas 4** com local Brasil/LATAM.
A Adyen tem 221 vagas e escritório em São Paulo — quase todas para Amsterdam.
Usar esse campo como filtro de elegibilidade daria uma lista errada.

**Slug morre.** `plaid` respondeu vazio e `netflix` não existe no Lever. O
catálogo é de julho; board fecha e empresa troca de ATS. Quem consumir precisa
tratar resposta vazia como normal, não como erro.
