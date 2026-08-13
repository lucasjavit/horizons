# JOB-01 · Provar o Firecrawl antes de construir tela

**Estado:** feito (13/08/2026)
**Tamanho:** P

## Por quê

É onde mora o risco da feature inteira. O `tech-lead` executou o Firecrawl na
reunião de planejamento e o resultado foi pior que a lentidão:

| O que | Medido |
| --- | --- |
| `search`, 10 resultados | 12,07 s · 2 créditos |
| `scrape` + extração por schema | 36,16 s · 5 créditos |

E dois achados que mudam o desenho:

- **O `search` não devolve vagas.** Devolve páginas *que contêm* vagas. Dos 10
  resultados reais: Indeed, Glassdoor, LinkedIn, ZipRecruiter, um post de
  Facebook. Zero vagas individuais.
- **A extração vem suja.** Numa página amigável, 19 vagas extraídas: **9 sem
  URL** (47%) e o campo `salary` preenchido com *"Mais de 100 candidatos"* — a
  IA confundiu contagem de candidatos com salário.

Descobrir a qualidade real antes de construir tela e persistência é mais barato
que descobrir depois.

## O que fazer

Um script isolado, fora do app, que:

1. faz `search` com filtros reais (o que você procuraria de verdade)
2. faz `scrape` com schema nas páginas que voltaram
3. imprime o que saiu, cru

E responde:

- **Quantas vagas de verdade** saem de uma busca? (não páginas — vagas)
- **Quantas têm URL** de candidatura?
- **O salário extraído confere** com o que está na página?
- **Dá para filtrar os agregadores** por domínio e ainda sobrar coisa?
- **Quanto tempo** leva o conjunto todo?

## Critério de aceite

- [x] O script roda e imprime o resultado bruto
- [x] Sabemos a taxa real de vagas aproveitáveis por busca
- [x] Sabemos se filtrar Indeed/LinkedIn deixa resultado suficiente
- [x] O achado está escrito no card, com número

## Observações

Se a resposta for "sobram 2 vagas boas por busca", a feature precisa ser
repensada antes de qualquer código de produção. **É um card que pode matar a
feature, e é para isso que ele vem primeiro.**

Não raspar Indeed nem LinkedIn: o look4job já decidiu evitá-los por ToS, e
reintroduzir esse risco aqui seria andar para trás.


---

# Resultado (13/08/2026)

**A feature é viável, e o prompt é o que decide a qualidade.**

## O `search` confirma o diagnóstico: não devolve vagas

10 resultados, **zero vagas individuais** — remoterocketship, arc.dev,
workingnomads, himalayas, dailyremote, golangprojects, realworkfromanywhere,
dynamitejobs, ZipRecruiter, 4dayweek.

Mas isso deixou de ser problema: **as listagens contêm as vagas com link
direto.** O caminho não é `search → vaga`, é `search → listagem → scrape`.

## A extração ficou boa quando o prompt foi explícito

Comparando com o teste da reunião, na mesma classe de página:

| | Teste da reunião | Este teste |
| --- | --- | --- |
| Vagas extraídas | 19 | **20** |
| Sem URL | 9 (**47%**) | **0** |
| Salário contaminado | "Mais de 100 candidatos" | **nenhum** |

A diferença inteira foi instruir: *"never a candidate count, never a view count
— if there is no explicit salary, use null"*. Das 20 vagas, 2 vieram com faixa
real (`€3.000–5.000/mês`, `$48K–60K/ano`) e 18 com `null` — que é a resposta
certa quando a página não informa.

**Conclusão: a alucinação de salário era do prompt, não do modelo.**

## A evidência funciona — e é o que justifica a feature

Numa vaga individual (Tether, backend):

```
eligibility:         "Open to candidates from all countries."
eligibilityEvidence: "Open to candidates from all countries."
salary:              null
salaryEvidence:      null
```

O dado que os boards escondem veio **com o trecho literal de origem**. E o
salário, ausente na página, veio `null` nos dois campos em vez de ser
preenchido por plausibilidade.

Pedir a evidência junto do valor é o que torna a afirmação verificável. Vai
para o JOB-03 como regra.

## O problema que ninguém tinha previsto

O `applyUrl` extraído foi:

```
https://himalayas.app/signup/talent?redirect=%2Fcompanies%2Ftether…
```

**É um cadastro no agregador, não o link da vaga.** A IA extraiu certo o que
estava na página; o defeito é do Himalayas, que esconde o link real atrás de
um signup.

Se isso fosse para a tela, a pessoa clicaria em "candidatar-se" e cairia num
formulário de cadastro de outro site. **Regra para o JOB-03:** URL com
`/signup`, `/login` ou `/register` não é link de candidatura — ou se busca o
link real, ou a vaga aponta para a página do anúncio.

## Custo e tempo medidos

| Operação | Créditos | Observação |
| --- | --- | --- |
| `search`, 10 resultados | 2 | |
| `scrape` de listagem (20 vagas) | 5 | cache hit |
| `scrape` de vaga individual | 5 | cache miss |

Uma rodada realista — 1 search + 3 listagens — custa ~17 créditos e rende
dezenas de vagas. Muito melhor que raspar vaga por vaga.

## O que isso muda no JOB-03

1. **Raspar listagens, não vagas individuais.** Uma página rende 20 vagas por
   5 créditos; individual rende 1 pelos mesmos 5.
2. **O prompt precisa proibir explicitamente** contagem de candidatos e de
   visualizações como salário. Foi o que resolveu.
3. **Pedir evidência junto do valor**, para salário e elegibilidade.
4. **Descartar URL de signup/login** — não é link de candidatura.
5. **Não raspar Indeed nem LinkedIn**, como já decidido.
