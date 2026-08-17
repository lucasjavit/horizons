# JOB-10 — Consultas dirigidas a ATS melhoram o aproveitamento da busca?

**Resposta: sim, e por uma margem grande.** O aproveitamento sai de **5%** para
**100%** das URLs devolvidas. Medido em 17/08/2026 com token real do Firecrawl,
23 variantes de consulta, mais 8 scrapes de validação ponta a ponta.

Este documento é medição, não implementação. Nada foi alterado em
`backend/src/jobs/busca.service.ts`.

---

## 1. O que foi medido, e como

Cada variante roda um `search` e classifica as URLs devolvidas em três grupos:

- **agregador** — cortada por `ehAgregador()` (lista `AGREGADORES` do serviço).
- **vaga** — página de UM anúncio.
- **lista** — categoria, busca, índice, raiz de board.
- **indef** — a heurística não decidiu.

A classificação é por formato de URL. Antes de gastar crédito, o classificador
foi validado contra 24 URLs de classe conhecida: **22/24 corretas**, e as duas
falhas caem em `indef`, nunca numa classe errada com confiança. Por isso `indef`
aparece como coluna própria em vez de ser somado a um dos lados.

O harness está em `medir.mjs` / `validar.mjs` no scratchpad da sessão; a saída
bruta das 23 variantes, com todas as URLs, em `todas.json`.

**A métrica que interessa é `vaga / total`** — quantas das URLs devolvidas pelo
`search` são realmente aproveitáveis pela fase 2. É ela que decide se o teto de
8 páginas é gasto em anúncio ou em página de categoria.

---

## 2. A tabela

`tot` = URLs devolvidas · `agr` = cortadas como agregador · `sob` = sobrevivem
ao filtro · `aprov%` = `vaga / tot`.

Consulta base em todas: `Backend Engineer Java remote`.

| # | Variante | tot | agr | sob | **vaga** | lista | indef | **aprov%** |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A1 | **Linha de base atual** (`... jobs hiring`) | 20 | 6 | 14 | **1** | 9 | 4 | **5%** |
| A2 | Linha de base sem `jobs hiring` | 20 | 7 | 13 | **2** | 6 | 5 | **10%** |
| B1 | `site:greenhouse.io` | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| B2 | `site:boards.greenhouse.io` | 20 | 0 | 20 | **19** | 1 | 0 | **95%** |
| B3 | `site:job-boards.greenhouse.io` | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| B4 | `site:lever.co` | 20 | 0 | 20 | **16** | 2 | 2 | **80%** |
| B5 | `site:jobs.lever.co` | 20 | 0 | 20 | **18** | 1 | 1 | **90%** |
| B6 | `site:ashbyhq.com` | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| B7 | `site:jobs.ashbyhq.com` | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| C1 | **OR de 3 ATS** (greenhouse, lever, ashby) | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| C2 | OR de 5 ATS (+ workable, smartrecruiters) | 20 | 0 | 20 | **17** | 1 | 2 | **85%** |
| C3 | OR de 3 ATS **+ `jobs hiring`** | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| D1 | `includeDomains` nativo, 3 ATS | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| D2 | **`excludeDomains` dos agregadores** | 20 | 0 | 20 | **1** | 11 | 8 | **5%** |
| E1 | OR 3 ATS + `remote LATAM` | 20 | 0 | 20 | **16** | 4 | 0 | **80%** |
| E2 | OR 3 ATS + `worldwide remote` | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| E3 | OR 3 ATS + `work from anywhere` | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| E4 | `remote LATAM` **sem** `site:` | 20 | 7 | 13 | **1** | 8 | 4 | **5%** |
| F1 | Outro cargo (Data Engineer Python), base | 20 | 5 | 15 | **3** | 4 | 8 | **15%** |
| F2 | Outro cargo, OR 3 ATS | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| G1 | OR 3 ATS + senioridade + Kubernetes AWS | 20 | 0 | 20 | **20** | 0 | 0 | **100%** |
| H1 | OR workday + smartrecruiters + workable | 20 | 0 | 20 | **14** | 3 | 3 | **70%** |
| I1 | **OR 3 ATS com `limit: 8`** | 8 | 0 | 8 | **8** | 0 | 0 | **100%** |
| J1 | Saída real da função proposta, filtros vazios | 8 | 0 | 8 | **8** | 0 | 0 | **100%** |
| J2 | Saída real da função proposta, filtros cheios | 8 | 0 | 8 | **8** | 0 | 0 | **100%** |

As duas últimas linhas não são consultas escritas à mão: são a string que a
`montarConsulta()` proposta no item 5 realmente produz, copiada da saída dela e
medida. J1 é o caso de filtro vazio (`software engineer`), J2 é o caso cheio
(dois cargos em OR, senioridade, 4 techs, `remote`, `LATAM`). A função também
passa `tsc --strict`.

### Validação ponta a ponta

A tabela mede formato de URL. Para confirmar que formato certo vira vaga de
verdade, 8 URLs da variante C1 passaram pelo `scrape` + extração JSON, o mesmo
caminho que o `lerVaga()` usa:

**7 de 8 viraram vaga aproveitável, 5 com salário.**

| Empresa | Título | Resultado |
|---|---|---|
| Real | Senior Backend Engineer - Java | ok, com salário |
| Remote People | Senior Back-End Engineer (Java) | ok |
| Pinterest | Sr. Software Engineer, Backend | ok, com salário |
| Dash0 | Staff Product Engineer, Backend (Go, Java) | ok |
| LivePerson | — | **descartada: vaga fechada** |
| Smarsh | Sr. Software Engineer - Java | ok, com salário |
| Camunda | Senior Software Engineer, Backend | ok, com salário |
| Gremlin | Senior Backend Engineer | ok, com salário |

A única perda foi a LivePerson, e foi o sistema funcionando: `estaFechada:
true`, descartada pela regra que já existe. Não é falha da consulta.

Comparação honesta com a linha de base: ela também entregou 6 vagas de 8 páginas
(5 com salário). **A diferença não está na taxa de conversão da fase 2 — está em
quantas URLs boas a fase 1 consegue oferecer.** A base precisou de 14
sobreviventes para achar 8 candidatas decentes; a dirigida entrega 20 candidatas
limpas, e as 8 primeiras já servem.

---

## 3. Leitura dos números

**A hipótese se confirma, e com folga.** `site:` dirigido a ATS leva o
aproveitamento de 5% para 100%. Não é ajuste fino: é a diferença entre gastar o
teto de 8 páginas em categoria de job board e gastá-lo em anúncio.

**O diagnóstico do card estava incompleto — e essa é a descoberta mais útil
aqui.** A premissa era "o `search` devolve majoritariamente agregador, e sobram
poucas URLs boas". Os agregadores são só 5-7 das 20. O problema real aparece na
variante **D2**: excluindo os agregadores nativamente por `excludeDomains`,
sobram 20 URLs — e ainda assim **só 1 é página de vaga** (11 listas, 8 indef). O
ranking apenas preenche o buraco com mais página de categoria: `dice.com/jobs/q-...`,
`workingnomads.com/remote-java-jobs`, `builtinaustin.com/jobs/remote/dev-engineering/java`.

Ou seja: **cortar agregador não resolve, porque o inimigo não é o agregador — é
a página de listagem.** Uma consulta genérica em linguagem natural rankeia
páginas de categoria, que é exatamente o que os job boards otimizam para SEO. O
`site:` de ATS funciona porque nesses domínios a URL indexada *é* o anúncio.
Isso também significa que mexer na lista `AGREGADORES` não traria ganho
relevante; a alavanca é a consulta.

**Outros achados:**

- **`jobs hiring` no fim é neutro.** C1 e C3 dão 20/20 idênticos. Na base o
  efeito é ruído (A1 5% vs A2 10%, um caso de diferença). Pode ficar ou sair;
  sugiro sair, por ser texto sem função comprovada.
- **Domínio de topo basta.** `site:greenhouse.io` (100%) cobre
  `job-boards.greenhouse.io` e `job-boards.eu.greenhouse.io`, inclusive vagas
  europeias que `site:boards.greenhouse.io` não alcança. Não vale listar
  subdomínio: é mais frágil e não rende mais.
- **`includeDomains` nativo (D1) empata com `site:` no texto (C1)**: 20/20 nos
  dois. Prefiro `site:` no texto — é uma string só, mais fácil de logar e de
  reproduzir manualmente no navegador quando alguém for depurar.
- **Geografia só funciona junto do `site:`.** `remote LATAM` sozinho (E4) dá 5%;
  com ATS (E1) dá 80%. `worldwide remote` e `work from anywhere` (E2, E3) dão
  100%. Atenção: E1 perde 4 pontos porque `LATAM` puxa página de agência de
  recrutamento LATAM; ainda assim é 16x melhor que sem `site:`.
- **Os três ATS grandes são melhores que cinco.** C2 (5 ATS) cai para 85% e C1
  (3 ATS) fica em 100%. Workday e SmartRecruiters (H1, 70%) têm URL mais
  poluída e trazem raiz de board. Ficar nos três é mais limpo.
- **`limit: 8` já entrega 8/8** (I1). O código pede `limit: 20` e descarta 12.

---

## 4. Recomendação

**Use uma consulta única com OR dos três ATS grandes, `limit: 8`.**

```
<cargos> <senioridade> <techs> <geo> (site:greenhouse.io OR site:lever.co OR site:ashbyhq.com)
```

Por quê essa e não as alternativas:

- **Contra a consulta atual:** 100% vs 5% de aproveitamento, medido em dois
  cargos diferentes (C1/F2 vs A1/F1). Não há defesa para manter a atual.
- **Contra uma busca por ATS (B1+B4+B6):** as três buscas separadas devolvem 58
  URLs únicas contra 20 da OR, e a OR é quase subconjunto delas (19 das 20
  aparecem na união). **A breadth é real, mas só paga se você for abrir mais de
  8 páginas** — e não vai, porque o teto é 8. Três buscas custariam 3x o
  crédito para alimentar o mesmo teto. Se um dia o teto subir, essa é a porta.
- **Contra `excludeDomains`:** medido, não ajuda (D2, 5%).
- **Contra 5 ATS:** 85% < 100%, sem ganho compensatório.

**Ressalva honesta sobre o que isso custa:** a consulta dirigida troca cobertura
por precisão. Vagas hospedadas fora de greenhouse/lever/ashby — a página de
carreira própria da empresa, os boards remotos como WeWorkRemotely — **deixam de
aparecer por completo**. A linha de base achou Elastic, Reddit e Photon; a
dirigida não acharia nenhuma dessas por esse caminho. Com teto de 8 páginas isso
é um bom negócio (8 anúncios bons valem mais que 1 anúncio e 7 listagens), mas
não é um ganho sem contrapartida, e vira limitação se o produto um dia quiser
volume. O caminho para recuperar cobertura é a busca em duas frentes descrita
no item 5, não voltar à consulta genérica.

### Sobre abrir os agregadores

O card levantou a possibilidade de que a página de vaga do LinkedIn seja útil.
**Não medi isso** — precisaria de scrape em domínio bloqueado, e o corte também
é decisão de ToS, não só de qualidade (está no comentário de `AGREGADORES`).
O que os dados dizem é que **a pergunta perdeu urgência**: as 6 URLs de
agregador da linha de base eram todas página de BUSCA
(`indeed.com/q-java-backend-developer-jobs.html`,
`linkedin.com/jobs/java-remote-jobs`), não anúncio individual. Abri-las traria
listagem, não vaga. E com a consulta dirigida sobram zero agregadores para
decidir. Sugiro não mexer.

---

## 5. Implementação proposta para `montarConsulta()`

Uma busca só, um `search`. Substitui a função atual em
`backend/src/jobs/busca.service.ts`.

```ts
/**
 * Os ATS que a busca mira.
 *
 * Medido em 17/08/2026 (JOB-10): a consulta em linguagem natural devolvia 5%
 * de pagina de vaga — o resto era pagina de CATEGORIA de job board, que e o
 * que esses sites otimizam para SEO. Cortar agregador nao resolvia: excluindo
 * Indeed e LinkedIn nativamente, o aproveitamento continuava em 5%, so que com
 * mais listagem no lugar. Mirar o ATS resolve porque nesses dominios a URL
 * indexada E o anuncio: 100% de pagina de vaga, 20 de 20.
 *
 * Sao tres, e nao cinco: incluir Workable e SmartRecruiters derrubou para 85%,
 * e Workday para 70% — a URL deles e mais poluida e traz raiz de board.
 *
 * Dominio de topo, nao subdominio: `greenhouse.io` cobre `job-boards.` e
 * tambem `job-boards.eu.`, onde estao as vagas europeias.
 */
const ATS = ['greenhouse.io', 'lever.co', 'ashbyhq.com'];

/** A consulta que vai para o `search`, montada dos filtros da tela. */
function montarConsulta(f: FiltrosDto): string {
  const partes: string[] = [];
  if (f.job_titles?.length) partes.push(f.job_titles.join(' OR '));
  else partes.push('software engineer');
  if (f.seniority) partes.push(f.seniority);
  if (f.technologies?.length) partes.push(f.technologies.slice(0, 4).join(' '));
  if (f.remote === 'remoto') partes.push('remote');
  if (f.locations?.length) partes.push(f.locations[0]);
  // O `site:` fica no fim e entre parenteses: sem os parenteses o OR se liga
  // so ao ultimo termo, e a consulta deixa de ser restrita aos tres.
  //
  // Saiu o "jobs hiring" que ficava aqui: medido, e neutro (20/20 com e sem).
  partes.push(`(${ATS.map((d) => `site:${d}`).join(' OR ')})`);
  return partes.join(' ');
}
```

E na chamada, `limit: 20` vira `limit: TETO_PAGINAS`:

```ts
// limit: 8 ja devolve 8 de 8 paginas de vaga (JOB-10), e o codigo descarta
// tudo depois do teto de qualquer jeito. Pedir 20 custava o dobro de credito
// (4 contra 2) para jogar 12 fora.
const achados = await fc.search(consulta, { limit: TETO_PAGINAS });
```

O filtro `ehAgregador()` **fica onde está**. Ele para de ter trabalho na prática
(zero agregadores em todas as variantes com `site:`), mas é a rede de segurança
para o dia em que a consulta mudar. Custa um `includes`.

### Se um dia o teto de páginas subir

Duas frentes, aí sim com custo maior: uma consulta dirigida a ATS (precisão) e
uma genérica (cobertura), unindo as URLs. Só vale acima de ~12 páginas, porque
abaixo disso a dirigida sozinha já enche o teto com anúncio bom. Custo: +2
créditos e +1 req/min por consulta extra.

---

## 6. Custo e rate limit

**Créditos medidos**, lendo `getCreditUsage()` antes e depois de cada chamada —
não estimados:

| Chamada | Custo medido |
|---|---|
| `search`, `limit: 8` | **2 créditos** |
| `search`, `limit: 10` | **2 créditos** |
| `search`, `limit: 20` | **4 créditos** |
| `scrape` + extração JSON | **5 créditos** |

> Correção ao enunciado do card: `search` **não** custa 2 créditos fixos. Custa
> 2 até 10 resultados e 4 em 20 — o preço escala com `limit`. O código hoje pede
> 20 e usa 8, então paga 4 onde 2 bastavam.

**Custo por busca completa** (1 search + 8 scrapes), plano de 1000 créditos/mês:

| Estratégia | Créditos | Buscas no mês |
|---|---:|---:|
| Hoje (`limit: 20` + 8 scrapes) | 4 + 40 = **44** | ~22 |
| **Proposta (`limit: 8` + 8 scrapes)** | 2 + 40 = **42** | ~23 |
| Se fossem 3 buscas por ATS | 6 + 40 = **46** | ~21 |

A economia de crédito é marginal (2 em 44), e é honesto dizer: **a proposta não
se paga em custo, se paga em qualidade.** O mesmo gasto passa a comprar 8
anúncios em vez de 1 anúncio e 7 listagens. O gargalo do plano é o scrape (40
dos 42 créditos), não a busca.

**Rate limit — 14 req/min no plano gratuito.** É daqui que sai o teto de 8:

```
1 search + 8 scrapes = 9 req  →  sobram 5 req/min de folga
```

O `LOTE = 3` do serviço continua correto e não precisa mudar. A proposta **não
altera o consumo de rate limit** (continua 1 search), e é por isso que a
alternativa de 3 buscas separadas foi descartada: 3 + 8 = 11 req/min encosta
perigosamente no teto que já derrubou a busca uma vez em 17/08/2026.

Se o teto de páginas subisse para 12: 1 + 12 = 13 req/min. Cabe, mas sem folga
para retry — não recomendo sem antes subir de plano.

---

## 7. O que não foi medido

Em voz alta, para não virar conclusão emprestada:

- **Frescor.** Nada aqui mede se o anúncio de ATS é mais recente que o de job
  board. O `tbs` do `SearchRequest` permitiria filtrar por data e não foi testado.
- **Página de vaga de agregador.** Não scrapeei LinkedIn/Indeed (bloqueados por
  ToS e pelo filtro). A afirmação de que "abrir agregador traria listagem" vale
  para as URLs que o `search` devolveu, que eram todas de busca — não é um
  veredito sobre a página de anúncio individual deles.
- **Volume real de vagas únicas.** Medi URLs devolvidas, não vagas distintas no
  mercado. Duas buscas podem devolver o mesmo anúncio.
- **Só um idioma e um mercado.** Consultas em inglês, cargos de engenharia. Não
  sei se vale para outras famílias de cargo.
- **Estabilidade no tempo.** Uma sessão, 17/08/2026. Ranking de busca muda.
