# JOB-21 · Elegibilidade resolvida por campo, sem IA

**Estado:** feito (19/08/2026)
**Tamanho:** P

## Por quê

Medido em 18/08 sobre o corpus do ATS: **86,4% das vagas se resolvem por campo
estruturado**, com **0% de falso positivo** e 6,8% de falso negativo.

| Caso | Fatia | Como |
| --- | ---: | --- |
| Não-remotas | 76% | `location` diz a cidade |
| Remotas com restrição | 10,4% | `"Remote, US"` |
| **`"Remote"` puro** | **13,2%** | **irredutível — precisa de IA** |

As 3.668 vagas do terceiro grupo são onde o custo de IA deve ser gasto — e só
ali. Regex resolve apenas 3,1% delas.

## O que fazer

- Classificar por `location`, `workplaceType` (Lever) e `isRemote` (Ashby)
- Só as indeterminadas vão para a IA
- A IA cara (Opus) só nas finalistas

Custo medido: corpus inteiro em Opus = **US$ 341**. Só as indeterminadas em
Haiku = **US$ 3,89**. Busca típica (Java/Spring, 39 indeterminadas): **US$ 0,04**.

## Critérios de aceite

- [x] Vaga com `location: "Remote, US"` é classificada sem chamar IA
- [x] Vaga com `location: "Remote"` puro vai para a IA
- [x] O custo por busca cai para centavos — **95,6% resolvido sem IA**
- [x] Nenhuma vaga é marcada como elegível sem base — conferido: **zero
      afirmações sem trecho** em 46 vagas

## Medido (19/08)

**95,6% por campo, 4,4% para IA** — melhor que os 86,4% estimados.

A ordem dos sinais é o que decide, e minha primeira versão errou: eu tratava
"remoto sem país" antes de tentar ler o lugar do texto, e caía para **15,6%**
resolvido. `"Serbia"` com `isRemote: true` ia para a IA quando o país estava
ali. Corrigido: o lugar nomeado é lido primeiro.

O campo booleano vem antes do texto — 32 das 45 vagas tinham `regime: 'remoto'`
com o `location` mostrando escritório ("San Francisco HQ"). Classificar pelo
texto marcaria 71% como presencial, todas erradas.

## O achado que mudou o card

Ao medir, descobri que **1 vaga de engenharia em 1.961** aceita brasileiro
neste catálogo. Está em
[docs/design/JOB-21-quantas-vagas-aceitam-brasil.md](../../design/JOB-21-quantas-vagas-aceitam-brasil.md)
— e muda o papel do ATS de "motor de elegibilidade" para "motor de volume".

## Não medido

**A acurácia do Haiku nesta pergunta.** Foi medido o *custo*, não a *precisão*.
Precisa de um lote rotulado à mão antes de confiar no modelo pequeno.

Os tokens foram estimados por caracteres (4 chars/token), não com
`count_tokens` — HTML pode desviar isso em ~20%.
