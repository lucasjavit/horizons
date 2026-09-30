# JOB-46 · O currículo não preenche mais os filtros

**Estado:** feito (30/09/2026) — corrigido junto com o QA-04 em 01/09; o selo
de origem foi **cortado com razao registrada** (ver o final do card)

> Renumerado de JOB-39 para JOB-46 em 01/09: o número colidia com
> `JOB-39-freehire-como-motor-de-busca.md`, que já estava feito.
**Tamanho:** P

## O defeito

Subir o currículo **diz** que preencheu os filtros e **não preenche**.

Medido em 26/08, com um CV de backend Java:

```
a caixa diz:  "Read cv.pdf — we ticked 13 filters marked CV.
               Uncheck anything we got wrong."
na tela:      nenhum filtro marcado
```

A API responde certo — `201`, com 11 tecnologias, `senioridade: senior` e 3
cargos. O rascunho no `ListaVagas` é preenchido, e é por isso que a contagem
diz 13. **O que sumiu foi onde isso aparecia.**

## A causa

A barra de 8 dropdowns foi substituída por um modal de filtros, em trabalho
ainda não commitado (26/08):

```
 D frontend/src/components/vagas/BarraFiltros.tsx
 D frontend/src/components/vagas/DropdownFiltro.tsx
?? frontend/src/components/vagas/ModalFiltros.tsx
?? frontend/src/components/vagas/BarraDeBusca.tsx
```

O `aoLerCv` continua produzindo `{ selecao, origem }` como antes — o
`aplicarCv` de `vaga-filtro.ts` não foi tocado. **Falta o modal ler esse
estado**, e mostrar o selo `CV` nas opções que vieram do currículo.

Medido na página: `button[aria-haspopup=listbox]` devolve **0**. Os botões
visíveis hoje são "Location" e "All filters".

## O que é pior que o defeito

**A caixa afirma algo falso sobre dados que vão para a busca.** "We ticked 13
filters" com zero marcado é da mesma família do bug que o QA pegou em 25/08 (o
acúmulo entre currículos, que dizia "8 filters" nomeando só o último arquivo).

A regra que vale aqui: **a contagem tem de sair do que está marcado na tela**,
não de um estado que a tela não mostra mais. Se o número não pode ser
verificado olhando, ele não deve ser exibido.

## O que fazer

1. O modal lê o rascunho preenchido pelo CV, e o selo `CV` aparece nas opções
   que vieram dele — é o que permite desmarcar só o que a IA errou.
2. **Se o modal está fechado, a pessoa precisa saber que há filtro marcado lá
   dentro.** Com os dropdowns, o selo era visível sem abrir nada; num modal,
   não é. O contador no botão "All filters" resolve; o selo de origem precisa
   de decisão de desenho.
3. A contagem da caixa passa a refletir o que está marcado.

## Critérios de aceite

- [x] Subir o CV e abrir o modal: os filtros do currículo estão marcados
- [~] O selo `CV` distingue o que veio do currículo do que a pessoa escolheu
      — **cortado**, com a razão no fim do card
- [x] Com o modal fechado, dá para saber que há filtro aplicado
- [x] A contagem da caixa bate com o que está marcado — se nada foi marcado,
      a caixa diz isso (o estado "nothing matched" já existe)
- [x] Desmarcar um valor do CV tira o selo dele (comportamento do JOB-02)

## De onde veio

O stakeholder, em 26/08: *"quando o usuário fizer o upload do CV deve preencher
no filtro do front, pois quando eu clicar no filtro deve estar lá."*

Reproduzido no mesmo dia. **Não é regressão do JOB-02** — o preenchimento
continua funcionando; é a tela que mudou por baixo dele.


---

## Como fechou (30/09/2026)

**O defeito já não existia.** Ele foi corrigido em 01/09, dentro do QA-04 —
que nasceu para *testar* a `ListaVagas` e acabou consertando o que os testes
acharam. Este card ficou aberto porque ninguem voltou para fecha-lo.

### A premissa do card venceu

O card culpava "trabalho ainda nao commitado". Conferido hoje: arvore limpa,
`BarraFiltros.tsx` e `DropdownFiltro.tsx` **removidos de vez**, `ModalFiltros.tsx`
no repositorio.

### A correcao, e por que ela satisfaz a regra do card

O `aoLerCv` deixou de escrever num `rascunho` invisivel e passou a escrever em
`avancadosDaBarra` — **o mesmo estado que o modal renderiza**. E a contagem da
caixa e derivada dele:

```ts
const filtrosDoCv = useMemo(
  () => (['technologies','seniorities'] as const).reduce(
    (total, campo) => total + (avancadosDaBarra[campo]?.length ?? 0), 0),
  [avancadosDaBarra],
)
```

E literalmente o que o card exigia: *"a contagem tem de sair do que esta
marcado na tela"*. Nao ha mais como o numero divergir, porque nao ha mais dois
estados.

### Tres coisas que o card nao previa, e que a medicao de 26/08 achou

O consertar exigiu mais que ligar dois estados — o vocabulario nao casava:

| defeito | medido | efeito na tela |
| --- | --- | --- |
| cargo ia para `roles` (faceta fechada) em vez de `job_titles` (full-text) | `roles=["Backend Engineer"]` → **0** vagas; `job_titles` → **80.403** | zerava todas as facetas, e o modal lia isso como "indisponivel": abria **vazio** |
| senioridade ia no vocabulario brasileiro (`pleno`) | a faceta fala `middle` | mesmo sintoma — 25 facetas zeradas |
| stack sem corte | `ArrayMaxSize(20)` do `FiltrosDto` | CV com 21 techs devolvia **400**, e a tela dizia "Something went wrong with this filter combination" |

O primeiro e o mais instrutivo: **o zero nao dava erro**. Filtro que nao casa
com nada e indistinguivel, na resposta, de motor fora do ar.

### Verificado hoje (30/09), na aplicacao de pe

- o bundle servido contem `job_titles` — a correcao esta no ar
- `GET /settings/recursos/produto` → `{"leituraCvAtiva":true,...}`
- `POST /jobs/facets` com o que o CV produz (`technologies:["Java","Spring"]`,
  `seniorities:["senior"]`) → **HTTP 201, 26.320 vagas**, facetas cheias, e
  `seniority: [{valor: "senior", total: 26320}]`. **E o caso que antes zerava.**
- **31 testes** na `ListaVagas.spec.tsx`, passando em 5,96s — tres `describe`
  cobrem exatamente os tres bugs desta familia, incluindo "a contagem do CV
  zera quando os filtros sao limpos" e "desmarcar um chip do CV derruba a
  contagem junto"

### O selo `CV` foi cortado, e a razao importa

Zero ocorrencia de selo/origem em `ModalFiltros.tsx`, `modal-filtro.ts` e
`ChipFiltro.tsx`. Nao foi esquecimento — **o selo resolvia um problema que
deixou de existir.**

Ele servia para *"desmarcar o que a IA errou"* quando o estado do CV era
invisivel na tela. Hoje os valores do curriculo aparecem como **chips
removiveis na faixa**, iguais aos marcados a mao, e saem com um clique. O que
o selo ainda acrescentaria e saber **de onde veio** cada valor — informacao
legitima, mas isso e *feature*, nao correcao de defeito.

E o proprio card reconhecia que o item *"precisa de decisao de desenho"*.
Decisao do stakeholder em 30/09: **nao entra agora**. Se um dia entrar, entra
como card proprio, com o desenho resolvido antes.
