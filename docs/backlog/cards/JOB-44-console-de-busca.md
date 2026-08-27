# JOB-44 · O console de busca

**Estado:** feito (27/08/2026)
**Tamanho:** M

## De onde veio

O stakeholder disse que a barra da aba Jobs "ficou estranha" e pediu que **não
parecesse o freehire**. O designer entregou três direções; a **C** foi
aprovada.

O ponto do pedido: não parecer o freehire **porque a estrutura é outra**, e não
porque a cor mudou. Trocar paleta seria disfarce — a barra continuaria sendo
uma cápsula branca com ícones cinzas, que é o que se reconhece de longe.

## A direção C, em uma frase

**Duas faixas dentro de um quadro só.** Em cima, o campo e as ações que o
executam (`Location`, `All filters`, `Search`). Embaixo, em `--surface-sunken`,
**todo filtro ativo como chip removível**.

O argumento que a escolheu: quem sobe o currículo hoje vê um `3` numa bolinha e
precisa abrir o modal para descobrir o que aconteceu. Com os chips, a pessoa lê
`Senior · Management · Sales` e apaga o que não quer num clique. **O produto
mostra o resultado em vez de pedir fé.**

## O que estava medido, e o que ficou

Medido no navegador antes (bundle `index-W5TSLrUi.js`) e depois
(`index-DRAitMw3.js`), a 1280px e 390px.

### A hierarquia estava invertida

| Elemento | Antes | Depois |
| --- | ---: | ---: |
| `All filters` (o mais usado) | **38×36** | 112×36 |
| `Location` (secundário) | **125×36** | 127×36 |
| Buscar | lupa **32×32**, cinza, na borda | botão `Search` **80×36**, sólido `--brand` |

A lupa era o alvo mais fraco da barra — e era a ação de buscar. Agora os três
controles dividem o mesmo corpo (`BOTAO_ESCOPO`) e o `Search` é o objeto mais
pesado da faixa.

### Em 390px a ordem visual estava invertida

O `order-last` punha o campo de texto na **terceira linha**: viam-se seis
ícones antes de onde digitar.

```
antes:  input y=172  ·  Location/Filters y=92     <- campo em terceiro
depois: input y=144  ·  Location/Filters y=184    <- campo primeiro
```

Conferido a 320, 360, 390 e 414px: em todas o campo vem primeiro e **o corpo da
página não rola de lado** (`scrollWidth == clientWidth` nas quatro).

### O botão órfão sumiu

A etiqueta de chevron do `PainelDeFiltros` media **160×24**, era centralizada e
não tinha rótulo. Ela existia só para abrir a gaveta; sem gaveta, não há o que
abrir. Confirmado ausente nas duas larguras.

## O que mudou no código

- **`BarraDeBusca.tsx`** — vira o quadro do console, com a faixa de cima e um
  slot `faixa` para a de baixo. Ganhou `BOTAO_ESCOPO` (a forma comum dos três
  controles) e `AcoesDaBarra`, que leva para fora do quadro o que **não**
  executa a busca: limpar tudo, CV, salvas, sino e menu.
- **`PainelDeFiltros.tsx`** — deixa de ser `<aside>` com cabeçalho, `×` de
  fechar e prop `aberto`, e passa a ser a faixa sempre visível. Os grupos por
  eixo viraram uma lista plana: a faixa tem uma linha só, e títulos
  intercalados gastariam nela o espaço dos próprios chips.
- **`ListaVagas.tsx`** — morreram `painelFixado`, `painelEmHover`,
  `painelAberto`, o `Chevron` e o `useSessao` (que só servia para esconder o
  `Save filter` da gaveta — o modal tem o próprio botão de salvar).
- **`SeletorDeLocal.tsx`** — a pílula de 125px adota `BOTAO_ESCOPO`.

## A decisão de produto: sem marcação de origem

O mockup marcava em dourado os chips vindos do CV. **Não dá para fazer isso
hoje**, e por isso não foi feito.

`ListaVagas.tsx` registra que o **`origemCv` morreu com os dropdowns** (26/08),
e que a contagem passou a sair dos campos do modal justamente para não divergir
do que está marcado — a lição do [JOB-39](JOB-39-cv-nao-preenche-o-modal-de-filtros.md).

Sem poder distinguir a origem, **nenhum uso do dourado é melhor que um uso
decorativo**: dourado que não significa "veio do CV" só ensina a ignorar
dourado. Todos os chips ficam no mesmo tratamento.

**Isto é um card próprio, não um esquecimento.** O valor de marcar a origem é
responder *"de onde veio este filtro"* quando a busca traz o resultado errado —
hoje esse rastro se perde. Reintroduzir o `origemCv` exige decidir onde ele
vive sem voltar a divergir do que está marcado, que foi exatamente o bug do
JOB-39. Ver a seção "O que fica para depois".

## Critérios de aceite

- [x] Duas faixas num quadro só; a de baixo em `--surface-sunken`
- [x] Todo filtro ativo aparece como chip com `×` próprio
- [x] O `×` de cada chip remove **e rebusca** (conferido: 2 chips → 1)
- [x] `Clear all` na faixa, à direita, volta ao estado vazio
- [x] O estado vazio ensina em vez de ficar em branco
- [x] Nada sumiu sem substituto: campo (Enter busca), Location, All filters com
      contador, salvar busca, favoritos com contador, notificações, menu,
      limpar-tudo que só aparece quando há o que limpar
- [x] A lupa acende `--brand` com filtro e nada digitado (`rgb(0,112,74)`), e
      volta a `--text-muted` ao digitar
- [x] O contador do `All filters` some no desktop (os chips já dizem o quê) e
      volta no celular; o `aria-label` carrega a contagem nas duas larguras
- [x] Em 390px o campo vem primeiro, os chips rolam de lado
      (`overflow-x:auto`, `flex-wrap:nowrap`) e o corpo da página não rola
- [x] O botão órfão de 160px sumiu
- [x] Teclado: Tab alcança campo → Location → All filters → Search → cada `×` →
      Clear all, com foco visível em todos
- [x] Os dois temas, com todo par de contraste ≥ 4,5:1
- [x] `scripts/qa-rapido.py` passa

## Contraste medido (AA exige 4,5:1 para texto)

| Par | Claro | Escuro |
| --- | ---: | ---: |
| chip sobre o fundo do chip | 6,15 | 4,68 |
| `Search` sobre `--brand` | 6,15 | 5,99 |
| `Clear all` sobre a faixa afundada | 5,76 | 5,57 |

## O que NÃO foi feito

**Os três controles não ficam em terços iguais no celular.** `flex-1` está
aplicado no `<span>` do `HintWrap` (o filho flex de verdade), mas o rótulo é
`whitespace-nowrap` e o `min-width` do wrapper é `auto`, então cada botão tem
piso de min-content: 127/112/80. Ficou assim de propósito — forçar terços
exigiria `min-w-0`, e a 320px isso cortaria "All filters" no meio. Rótulo
legível ganha de coluna alinhada, e não há estouro em nenhuma das larguras.

**A leitura de CV não foi exercitada com um PDF real.** O caminho foi
verificado pelos **mesmos campos** que o `aoLerCv` escreve
(`technologies`/`seniorities`, marcados pelo modal): três valores marcados →
três chips nomeados, lupa acesa em `--brand`, `aria-label` dizendo "3 active",
e a busca rodando ("60 jobs found"). O que não foi exercitado é o upload em si.

## O que fica para depois

**Marcar a origem do filtro (chip que veio do CV).** Card próprio, pelas razões
da seção acima. O que ele precisa resolver: onde o `origemCv` vive sem voltar a
divergir do que está marcado na tela — a regra do JOB-39 é que *a contagem tem
de sair do que está marcado*, e um segundo estado paralelo é justamente o que
quebrou antes.
