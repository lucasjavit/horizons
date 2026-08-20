# JOB-30 · Startup ou empresa grande — dois mercados

**Estado:** feito (19/08/2026)
**Tamanho:** M

## Por quê

São dois mercados com taxas 200× diferentes, medido em 19/08:

| Origem | Vaga elegível |
| --- | --- |
| Curadoria do look4job (512 empresas) | **1 em 1.961** |
| Slugs brutos do Ashby (407 empresas) | **144 em 1.229** |

A empresa grande tem entidade legal em cada país e contrata **por país** — a
Adyen tem escritório em São Paulo e 222 vagas para Amsterdam. A startup
remote-first não tem entidade em lugar nenhum e contrata de onde a pessoa
estiver.

Detalhe em `docs/design/JOB-30-slugs-brutos-do-ashby.md`.

## O que foi feito

Dois catálogos e um dropdown **Company type**:

```
empresas.json          512 grandes   (curadoria)
empresas-startup.json  407 startups  (slugs brutos do Ashby)
```

Os conjuntos são **disjuntos** — nenhuma das 407 aparece nas 512. Sem porte
escolhido, a busca consulta os dois.

## Medido

| | Vagas | BR/LATAM/global | Com salário |
| --- | ---: | ---: | ---: |
| Startups | **220** | **29** | **61** |
| Grandes | 58 | 4 | 8 |

## A hipótese que a medição derrubou

Ia usar o **tamanho do board** como proxy de porte. Não separa nada: a taxa
fica em ~13% em todas as faixas (1 vaga, 2-4, 5-14, 15+), e a maior de todas
— Truelogic, 35 vagas todas LATAM — é uma agência de staffing, não uma
empresa grande.

O que separa é a **origem do catálogo**.

## Critérios de aceite

- [x] Dropdown Company type na tela
- [x] `porte: startup` consulta só o catálogo de startups
- [x] Sem porte, consulta os dois
- [x] `qa-rapido.py` passa
