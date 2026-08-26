# JOB-39 · O currículo não preenche mais os filtros

**Estado:** aberto (26/08/2026)
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

- [ ] Subir o CV e abrir o modal: os filtros do currículo estão marcados
- [ ] O selo `CV` distingue o que veio do currículo do que a pessoa escolheu
- [ ] Com o modal fechado, dá para saber que há filtro aplicado
- [ ] A contagem da caixa bate com o que está marcado — se nada foi marcado,
      a caixa diz isso (o estado "nothing matched" já existe)
- [ ] Desmarcar um valor do CV tira o selo dele (comportamento do JOB-02)

## De onde veio

O stakeholder, em 26/08: *"quando o usuário fizer o upload do CV deve preencher
no filtro do front, pois quando eu clicar no filtro deve estar lá."*

Reproduzido no mesmo dia. **Não é regressão do JOB-02** — o preenchimento
continua funcionando; é a tela que mudou por baixo dele.
