# JOB-10 · A busca mira os ATS em vez de perguntar solto

**Estado:** feito (17/08/2026)
**Tamanho:** P

## Por quê

A busca real rodou com token válido pela primeira vez em 17/08 e entregou 6
vagas, mas gastando quase todo o teto de páginas em página errada. A medição
está em [docs/design/JOB-10-consultas-dirigidas.md](../../design/JOB-10-consultas-dirigidas.md):
23 variantes de consulta, mais 8 scrapes de validação ponta a ponta.

**Aproveitamento da consulta atual: 1 página de vaga em 20 (5%).** Com `site:`
dirigido a greenhouse/lever/ashby: **20 em 20 (100%)**. Replicado em dois
cargos diferentes (Backend Java e Data Engineer Python).

## O diagnóstico estava errado, e isso é o principal

A premissa era "o `search` devolve agregador, e por isso sobram poucas URLs".
Medido: os agregadores são só 5-7 das 20. Excluindo Indeed e LinkedIn
nativamente por `excludeDomains`, sobram 20 URLs e **ainda assim só 1 é vaga** —
o ranking preenche o buraco com mais página de categoria.

**O inimigo não é o agregador, é a página de listagem.** Consulta genérica
rankeia página de categoria, que é o que job board otimiza para SEO. O `site:`
de ATS funciona porque nesses domínios a URL indexada *é* o anúncio.

Consequência prática: **mexer na lista `AGREGADORES` não traria ganho.** A
alavanca é a consulta.

## O que fazer

Em `backend/src/jobs/busca.service.ts`:

- `montarConsulta()` passa a fechar com
  `(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com)`. O código pronto
  está no item 5 do documento, já com `tsc --strict` passando e com a string de
  saída medida (100% nos dois casos, filtro vazio e filtro cheio).
- Sai o `jobs hiring` do fim — medido neutro, 20/20 com e sem.
- `fc.search(consulta, { limit: 20 })` vira `{ limit: TETO_PAGINAS }`. Medido:
  `limit: 8` já devolve 8 de 8 páginas de vaga, e `limit: 20` custa **4
  créditos contra 2** para jogar 12 fora.
- `ehAgregador()` **fica onde está** como rede de segurança.

Três ATS e não cinco: com Workable e SmartRecruiters cai para 85%, com Workday
para 70%.

## Critérios de aceite

- [x] `montarConsulta()` devolve a consulta com o `(site:... OR ...)` no fim
- [x] `limit` da chamada de `search` é `TETO_PAGINAS`, não 20
- [x] Uma busca real pela tela devolve ao menos 6 vagas de 8 páginas abertas
- [x] O documento de medição é citado no comentário da constante `ATS`

## O que a implementação mediu (17/08/2026, contra a API rodando)

Busca real pelo endpoint depois do rebuild: **8 URLs abertas → 8 vagas**,
contra 8 → 6 antes. Nenhum descarte, nada de falha silenciosa no log.

As empresas passaram a ser empresas: Pinterest, Dash0, Oscilar, Kadmos, Sporty,
Moniepoint, Real, Remote People. Antes o campo trazia o nome do site
("Motion Recruitment") ou uma empresa sorteada entre os cards da listagem — a
mesma URL voltava com empresa diferente a cada busca.

Três achados do [JOB-09](JOB-09-auditoria-das-vagas.md) sumiram sem serem
tratados um a um, porque eram sintoma da listagem:

| Achado do JOB-09 | Agora |
| --- | --- |
| Empresa trocando entre buscas na mesma URL | não ocorre — a URL é UMA vaga |
| `postedAt: 2026-08-15` inventado (9×) | todos `null` |
| Salário de um card sob o título de outro | não ocorre |

**`postedAt` volta `null` nas 8**, e isso é o resultado correto: página de ATS
não imprime data de publicação. A consequência prática é que o filtro
`posted_within_days` não tem o que filtrar — está anotado no
[JOB-08](JOB-08-prompt-de-busca.md), não é regressão desta mudança.

## A contrapartida, dita em voz alta

A consulta dirigida troca **cobertura por precisão**. Vaga hospedada fora dos
três ATS — página de carreira própria, WeWorkRemotely, Working Nomads — deixa
de aparecer. A linha de base achou Elastic, Reddit e Photon; a dirigida não
acharia nenhuma por esse caminho.

Com teto de 8 páginas o negócio é bom (8 anúncios valem mais que 1 anúncio e 7
listagens), mas vira limitação se o produto quiser volume. O caminho para
recuperar cobertura é busca em duas frentes (uma dirigida, uma genérica), e só
paga acima de ~12 páginas — está descrito no item 5 do documento.

## Custo

Medido lendo `getCreditUsage()` antes e depois, não estimado:

| Chamada | Custo |
| --- | --- |
| `search` limit 8 ou 10 | 2 créditos |
| `search` limit 20 | 4 créditos |
| `scrape` + JSON | 5 créditos |

Busca completa: **42 créditos** (2 + 8×5), contra 44 hoje. ~23 buscas no plano
de 1000/mês. A economia é marginal e não é o argumento — **o mesmo gasto passa
a comprar 8 anúncios em vez de 1 anúncio e 7 listagens.**

Rate limit inalterado: 1 search + 8 scrapes = 9 req, dentro dos 14/min. Foi por
isso que 3 buscas separadas (11 req/min) foram descartadas, apesar de renderem
58 URLs únicas contra 20.

> Correção ao que se assumia: `search` não custa 2 créditos fixos. O preço
> escala com `limit` — 2 até 10 resultados, 4 em 20.
