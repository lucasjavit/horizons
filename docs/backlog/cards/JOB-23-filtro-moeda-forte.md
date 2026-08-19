# JOB-23 · Filtro "paga em moeda forte"

**Estado:** pronto para fazer
**Tamanho:** P

## Por quê

A tese do produto, nas palavras do stakeholder:

> "Esses usuários não querem receber na sua moeda e sim em uma moeda forte,
> essa é a base. Vagas remotas para ganhar em uma moeda forte."

E o diferencial que ele diz não existir no mercado:

> "Outra coisa que quero fazer é uma busca por LATAM, mas não seja para
> trabalhar para empresas brasileiras, nunca vi isso no mercado."

Ninguém segmenta assim porque quem constrói job board é americano — para eles
LATAM é região de custo, não origem do candidato.

## O dado já existe

`backend/data/ats/empresas.yaml`, filtrado em 18/08:

| | Empresas |
| --- | ---: |
| Pagam em moeda forte | **839** |
| Destas, contratam em emergente | **439** |
| Removidas (só moeda fraca) | 1.114 |

Cada empresa tem `contrata_em` com os emergentes que alcança.

## O que fazer

Um filtro na tela — "só empresas que pagam em moeda forte" — cruzando o país
de origem do usuário ([JOB-22](JOB-22-paises-elegiveis.md)) com `contrata_em`.

## Critérios de aceite

- [ ] Empresa que só contrata no Brasil não aparece
- [ ] Um usuário na Índia vê as 291 empresas que contratam lá
- [ ] O filtro é explicado na tela — a pessoa entende que é sobre a moeda
