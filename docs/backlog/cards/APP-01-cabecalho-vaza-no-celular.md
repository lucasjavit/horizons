# APP-01 · O cabeçalho do App vaza a largura da tela no celular

**Estado:** feito (15/08/2026)
**Tamanho:** P

## Por quê

Achado ao verificar o JOB-04 em 390px, em 15/08/2026. **O defeito não é da tela
de vagas** — é do cabeçalho do `App.tsx`, e vale para o site inteiro.

A página fica mais larga que a janela, então o corpo rola na horizontal. No
celular isso é aquele arrastar lateral que desalinha o conteúdo todo e faz a
leitura pular.

## O que foi medido

`document.documentElement.scrollWidth` com viewport de 390px:

| Página  | Logado | Anônimo |
|---------|--------|---------|
| Trilhas | 525    | 651     |
| Invoice | 525    | 651     |
| Vagas   | 525    | 651     |

O número é **idêntico nas três**, o que já mostra que a origem é o cabeçalho
compartilhado e não o conteúdo de nenhuma delas. Escondendo o `<header>` do
`App`, o `scrollWidth` da tela de vagas cai para exatos 390 — o `#conteudo`
nunca passou da largura.

Os elementos que passam da borda, medidos no navegador:

- `nav.flex.items-center.gap-1` — as quatro abas, terminam em x=412
- `div.ml-auto.flex.items-center.gap-2` — avatar e "Sair", terminam em x=525
- anônimo é pior (651) porque o botão de login é mais largo que o "Sair"

## Como reproduzir

1. Abrir qualquer página em 390px de largura
2. Arrastar o dedo (ou o mouse) para a esquerda — a página desliza
3. Ou, no console: `document.documentElement.scrollWidth` devolve 525

## O que fazer

O cabeçalho precisa caber em 390px. Caminhos possíveis, sem decisão tomada:
rolagem horizontal só na `nav`, esconder os rótulos das abas abaixo de `sm`,
ou um menu recolhido no celular. É decisão de desenho — vale passar pelo ux
antes de implementar, porque a navegação é o que todo mundo vê primeiro.

## Critério de aceite

- [ ] `scrollWidth` igual à largura da janela em 390px, logado e anônimo
- [ ] Vale nas três abas (Trilhas, Invoice, Vagas) e no Quadro
- [ ] As abas continuam alcançáveis por teclado, com alvo ≥24px
- [ ] Os dois temas


---

## Corrigido (15/08/2026)

A causa era a `nav` das abas no cabeçalho: `flex` sem `min-w-0`, então ela não
encolhia nem rolava — empurrava a barra inteira e a página ganhava rolagem
horizontal.

`min-w-0` + `overflow-x-auto` na própria `nav`, com a barra de rolagem
escondida: quem não cabe passa a rolar **dentro da nav**, que é o conteúdo que
de fato não cabe, em vez de arrastar a página.

Medido em 390×780, antes e depois, nas três páginas:

| Rota | Antes | Depois |
| --- | --- | --- |
| `/` | 525px | **390px** |
| `/invoice` | 525px | **390px** |
| `/vagas` | 525px | **390px** |

As abas continuam clicáveis (naveguei para `/invoice` pela barra depois da
correção).
