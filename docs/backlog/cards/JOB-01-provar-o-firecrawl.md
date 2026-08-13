# JOB-01 · Provar o Firecrawl antes de construir tela

**Estado:** pronto para fazer
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

- [ ] O script roda e imprime o resultado bruto
- [ ] Sabemos a taxa real de vagas aproveitáveis por busca
- [ ] Sabemos se filtrar Indeed/LinkedIn deixa resultado suficiente
- [ ] O achado está escrito no card, com número

## Observações

Se a resposta for "sobram 2 vagas boas por busca", a feature precisa ser
repensada antes de qualquer código de produção. **É um card que pode matar a
feature, e é para isso que ele vem primeiro.**

Não raspar Indeed nem LinkedIn: o look4job já decidiu evitá-los por ToS, e
reintroduzir esse risco aqui seria andar para trás.
