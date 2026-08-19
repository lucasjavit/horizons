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

### O filtro: quem paga em moeda forte (18/08/2026)

**A tese do produto é vaga remota para ganhar em moeda forte.** O usuário mora
num país emergente e quer receber em dólar ou euro — então o que decide não é
onde ele mora, é onde a empresa está ancorada.

Das 1.953 originais ficaram **839**. Roda por `scripts/filtrar-empresas.py`.

| | Empresas |
| --- | ---: |
| Pagam em moeda forte | **839** |
| **Destas, contratam em emergente** | **439** |
| Removidas (só moeda fraca) | 1.114 |

Fica quem tem ao menos um país de moeda forte em `hiring_countries`. Sai quem
só contrata em emergente — é a empresa local pagando na moeda fraca, que é
exatamente o que o produto quer evitar. Zero empresas que só contratam no
Brasil sobraram.

O campo **`contrata_em`** foi acrescentado a cada empresa: lista os emergentes
que ela alcança. É o que responde "ela contrata quem mora onde eu moro?".

| Emergente | Empresas |
| --- | ---: |
| Índia | 291 |
| México | 133 |
| Brasil | 110 |
| Espanha | 106 |
| Polônia | 99 |

**Um erro corrigido:** o filtro de 18/08 tratava a lista de países fortes como
"de onde vem o candidato" e removia Índia, Indonésia e Filipinas do arquivo.
Errado nos dois sentidos — a Índia é onde o usuário **mora** (291 empresas
contratam lá, mais que qualquer outro emergente), e o país forte é onde a
empresa **paga**.

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
