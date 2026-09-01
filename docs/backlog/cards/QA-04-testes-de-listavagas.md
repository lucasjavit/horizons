# QA-04 · Testes de componente para `ListaVagas`

**Estado:** aberto
**Tamanho:** M

Fecha a lacuna que o [QA-03](QA-03-camadas-2-3-4.md) deixou explícita: a camada
4 entregou `Paginacao` (15 testes) e `DadosPessoais` (14), e **`ListaVagas`
ficou de fora** — apesar de ser a primeira da lista do card e a que tem mais bug
medido.

## Por que ficou de fora, e por que volta como card

São **1.053 linhas** (`frontend/src/components/vagas/ListaVagas.tsx`), com
upload de arquivo, filtros, paginação sob demanda e histórico — muitas
dependências de rede para dublar. Testá-la bem custa mais do que coube na leva
do QA-03, e testá-la mal produziria a "cobertura sem teste real" que o QA-03
existe para não fazer.

A infraestrutura agora existe e não precisa ser refeita: `jsdom`,
`@testing-library/react`, `/user-event`, `/jest-dom`, o `setupFiles` com
`cleanup()`, e o `include` já aceitando `*.spec.tsx`.

## Os três bugs medidos que os testes têm de cobrir

1. **Perda de escolha durante o upload do CV** — o que a pessoa marcou some
   quando a leitura do currículo volta e preenche os filtros.
2. **O selo `CV` mentindo depois de "Clear filters"** — o selo continua
   dizendo que os filtros vieram do currículo depois de eles terem sido
   limpos.
3. **A contagem divergindo dos selos** — o número de filtros ativos não bate
   com os selos desenhados.

Cada um vira teste **visto falhar** com o bug reintroduzido, como manda o
QA-01. Um teste que passa com o bug presente não testa nada.

## Uma armadilha já conhecida

O `DadosPessoais.spec.tsx` custou uma rodada de testes intermitentes por
esperar só o formulário aparecer: o componente monta assim que o `useAsync`
resolve, mas quem aplica os dados ao estado é um `useEffect` que roda **depois**
— e entre os dois há um render com o estado vazio. A espera tem de ser pelo
**valor assentado**, e não pela presença do elemento. `ListaVagas` tem o mesmo
formato e vai repetir a armadilha.

## Critérios de aceite

- [ ] Os três bugs acima cobertos, cada um **visto falhar** com o bug de volta
- [ ] Tabela de mutações no card, como o QA-01 e o QA-03 fizeram
- [ ] `npm test` passa no frontend, sem teste intermitente (rodar 3x seguidas)
- [ ] Nenhum teste depende de dado que outro criou

## Depende de

- [QA-03](QA-03-camadas-2-3-4.md) — a infraestrutura de teste de componente
