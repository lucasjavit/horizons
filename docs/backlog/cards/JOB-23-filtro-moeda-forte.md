# JOB-23 · Filtro "paga em moeda forte"

**Estado:** descartado (21/08/2026) — resolvido por outros meios
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


---

## Por que foi descartado (21/08/2026)

Três coisas mudaram desde que o card foi escrito, e juntas tiram o sentido
dele.

**1. O catálogo já é só de quem paga em moeda forte.** O filtro de 18/08
removeu as 1.114 empresas que só contratam em país de moeda fraca. Um filtro
"paga em moeda forte" sobre um catálogo que já é isso não filtra nada — seria
o quinto caso do que o QA achou em 19/08, quando metade da barra era
decorativa.

**2. `contrata_em` é enganoso, e está medido.** Ele diz onde a empresa **tem
gente**, não onde contrata para trabalho remoto. A Adyen tem escritório em São
Paulo e 222 vagas para Amsterdam. Em 25 empresas que declaravam Brasil: 1.961
vagas, 36 com local BR/LATAM, **1 de engenharia**
(`docs/design/JOB-21-quantas-vagas-aceitam-brasil.md`).

**3. Metade do catálogo não tem o campo** — 262 de 526. As startups vieram dos
slugs brutos e as brasileiras foram adicionadas em 21/08; nenhuma tem
`contrata_em`.

## O que resolveu o problema de verdade

O diferencial que este card prometia — *"busca por LATAM, mas não para
empresa brasileira"* — foi entregue melhor por dois outros:

- **[JOB-30](JOB-30-porte-da-empresa.md)** separa startup remote-first de
  empresa grande, que é a divisão que realmente prediz elegibilidade (144 em
  1.229 contra 1 em 1.961).
- **`Company origin`** (21/08) usa a **sede real** da empresa em vez de
  inferir por `contrata_em`, e responde a pergunta oposta e mais útil:
  empresa do meu país contratando para fora.

Fica a lição: o dado que parecia servir (`contrata_em`) não sobreviveu à
medição, e o filtro certo veio de um dado novo — a sede.
