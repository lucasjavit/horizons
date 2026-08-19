# JOB-30 · Os slugs brutos do Ashby valem mais que a curadoria

**Medido em 19/08/2026**, varredura completa dos 3.044 slugs de Ashby que o
catálogo curado não usa. Custo: R$ 0.

## O resultado

```
2.142 boards vivos de 3.044   (70%)
37.327 vagas abertas
12.526 de engenharia
 1.229 com alcance amplo       (9,8%)
```

Depois de separar o que é âncora do que é alcance de verdade:

| | Vagas |
| --- | ---: |
| Ancoradas nos EUA ("US Remote", "Remote - US") | 250 |
| **Brasil / LATAM / Americas** | **144** |
| Worldwide / anywhere / global | 39 |
| `"Remote"` puro — precisa de IA para decidir | 483 |

**470 das 1.229 vêm com faixa salarial estruturada.**

## Contra o que temos hoje

| Fonte | Vagas elegíveis |
| --- | --- |
| Catálogo curado (512 empresas) | **1 em 1.961** |
| Slugs brutos do Ashby | **144 + 39 globais** |

A curadoria do look4job otimizou para **empresa grande e conhecida** — que é
justamente quem tem escritório no Brasil e contrata local, não remoto
internacional. As vagas boas estavam nos 3.044 slugs que ninguém usava.

## Exemplos reais (URLs verificadas, HTTP 200)

| Empresa | Vaga | Local | Salário |
| --- | --- | --- | --- |
| Aleph | Software Engineer | Americas | $75K – $315K |
| Artsy | Senior Platform Engineer | LATAM [Remote] | $84K – $96K |
| Ando | Senior Backend Engineer | Latin & South America | $28–58/h |
| Articul8 | Software Engineer (Brazil) | Brazil/Remote | — |
| Commure | Software Engineer, RCM | Rio de Janeiro | $40K – $50K |

## Por que Ashby e não Greenhouse

Medido nos dois, mesma metodologia:

| ATS | Taxa de vaga com alcance amplo |
| --- | ---: |
| Greenhouse (curadoria) | ~0,05% |
| Greenhouse (slugs brutos) | 0,4% |
| **Ashby (slugs brutos)** | **9,8%** |

Ashby é o ATS de startup remote-first; Greenhouse é de empresa grande com RH
estruturado, que contrata por país porque tem entidade legal em cada um.

O catálogo atual tem **271 Greenhouse contra 118 Ashby** — o inverso do que a
medição indica.

## O que isso NÃO resolve

**"Alcance amplo" é o campo `location`, não a verdade.** `"Remote"` puro (483
vagas) pode ser remoto só nos EUA. Decidir isso exige ler a descrição — é onde
o motor de IA entra, e agora com um alvo dimensionado: 483 vagas a ~US$ 0,04
por lote, não 37 mil.

## O que fazer

1. Trocar a base do motor de ATS: slugs brutos do Ashby no lugar (ou ao lado)
   das 512 curadas
2. Guardar o resultado da varredura — 10 minutos para 3.044 slugs é caro demais
   por busca, mas barato uma vez por dia
3. Passar as 483 `"Remote"` puro pela IA
4. Medir BambooHR (11.316 slugs) e Lever (4.367), ainda intocados
