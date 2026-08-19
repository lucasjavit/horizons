# JOB-21 · Elegibilidade resolvida por campo, sem IA

**Estado:** pronto para fazer
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

- [ ] Vaga com `location: "Remote, US"` é classificada sem chamar IA
- [ ] Vaga com `location: "Remote"` puro vai para a IA
- [ ] O custo por busca cai para centavos
- [ ] Nenhuma vaga é marcada como elegível sem base — a regra do
      [JOB-09](JOB-09-vaga-so-afirma-o-que-cita.md) continua valendo

## Não medido

**A acurácia do Haiku nesta pergunta.** Foi medido o *custo*, não a *precisão*.
Precisa de um lote rotulado à mão antes de confiar no modelo pequeno.

Os tokens foram estimados por caracteres (4 chars/token), não com
`count_tokens` — HTML pode desviar isso em ~20%.
