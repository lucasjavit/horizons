# INV-09 · Redesenhar a tela do gerador de invoice

**Estado:** esperando decisão — três direções propostas, falta escolher
**Tamanho:** M (a decisão), G (a execução, dependendo da direção)
**Pedido do stakeholder (12/08/2026):** "não está do meu agrado".

## Por quê

A invoice é a **porta de entrada global** do Horizons: quem chega buscando
"invoice generator" no Google encontra esta tela antes de qualquer outra
coisa. Hoje ela funciona — sete cards de correção fecharam nesta semana — mas
parece ferramenta interna, não produto.

Isso importa mais aqui do que numa tela qualquer: é o primeiro contato de
alguém que não conhece o Horizons e não tem motivo nenhum para ficar.

## O que o stakeholder apontou

Os quatro, em conjunto:

1. Parece formulário de sistema, sem personalidade
2. Não dá para ver o que vai receber antes de baixar
3. Buraco vazio e desequilíbrio entre as colunas
4. É longo demais

## Diagnóstico medido (12/08/2026)

Estado vazio, que é o primeiro contato de todo visitante:

| O quê | Medido |
| --- | --- |
| Altura no desktop (1440px) | **1.495px** — mais de uma tela e meia |
| Altura no celular (390px) | **2.355px** — seis telas de rolagem |
| Campos visíveis de uma vez | 13 |
| Vazio sob o bloco "From" | ~250px, porque a coluna ao lado tem o dobro de campos |

Outros problemas visíveis na captura:

- **Sem hierarquia.** "Free invoice generator", "Invoice details", "From" e
  "Items" competem pelo mesmo peso visual. O olho não sabe onde começar.
- **O total está solto.** É a informação mais importante da tela e aparece
  como texto no meio da página, sem moldura nem destaque estrutural.
- **Nada diz Horizons** além do verde do botão. Um visitante não associa a
  ferramenta a marca nenhuma.
- **O estado vazio não ensina.** Mostra campos em branco, não o que vai sair.

## O que está bom e precisa sobreviver

- Funciona sem cadastro, e isso é a maior vantagem competitiva
- As correções da sprint 01: validação, bloqueio durante a geração, foco por
  teclado, rótulos por linha para leitor de tela
- O PDF em si ficou bom — o problema é a tela, não o documento
- Os dois temas funcionam

## O que fazer neste card

**Acionar o agente `ux`** para:

1. Abrir a tela no navegador (vazia e preenchida, desktop e celular)
2. Confirmar ou corrigir o diagnóstico acima
3. Propor **2 ou 3 direções distintas**, cada uma com esboço, o que resolve,
   o que custa e para quem é melhor
4. Recomendar uma, deixando a decisão para o stakeholder

Direções já cogitadas, para o `ux` avaliar e não se limitar a elas:

- **Prévia ao vivo ao lado** — formulário à esquerda, documento montando à
  direita. Resolve o "não vejo o que vou receber", e nenhum concorrente faz.
- **Wizard em etapas** — quem cobra → quem paga → o que cobra. Resolve o
  comprimento, mas adiciona cliques.
- **Mesma estrutura, melhor desenhada** — uma página, com hierarquia real,
  blocos em cartão e o vazio resolvido. Menos ambicioso, mais rápido.

## Restrições (não negociáveis)

- **Cor só por token** (`var(--surface)`, `var(--brand)`…), nunca classe
  Tailwind de cor — é o que faz o tema escuro sair de graça
- `<main id="conteudo" tabIndex={-1}>` continua sendo o contrato do skip link
- Acessibilidade não regride: label em todo campo, alvo ≥24px, erro por borda
  + `aria-invalid` + texto, rótulo de linha com a descrição da linha
- Continua funcionando **sem cadastro**
- jsPDF continua em `import()` dinâmico
- Interface em inglês

## Critério de aceite (da decisão, não da execução)

- [x] O `ux` viu a tela de verdade, nos dois tamanhos e nos dois temas
- [x] O diagnóstico foi confirmado ou corrigido com medida
- [x] Há 2 ou 3 direções distintas, com esboço e custo
- [x] Há uma recomendação explícita
- [ ] O stakeholder escolheu uma direção

Depois da escolha, a execução vira card próprio — o tamanho depende do que for
escolhido.

## Observações

Não fazer nada também é uma opção defensável: a tela funciona e o produto não
tem usuário ainda. Mas como é a porta de entrada, e o próprio dono não gostou,
provavelmente vale a pena.


---

# Resultado do `ux` (12/08/2026)

Viu 8 combinações: vazia/preenchida × 1440/390 × claro/escuro.

## Duas correções ao meu diagnóstico

**1. O buraco é só do desktop.** No celular as colunas empilham e não existe
buraco nenhum. Ou seja, o incômodo 3 e o incômodo 4 são de **telas
diferentes**: resolver o buraco não encurta o celular, e encurtar o celular
não conserta o buraco. São duas correções, não uma.

**2. A causa do buraco não é "a coluna ao lado tem o dobro de campos".**
Medido: conteúdo do From = 108px (um select e um botão), Bill to = 349px.
O CompanyPicker (INV-08) escondeu nome/endereço/email/taxId num modal — o
buraco é a **sombra do modal** que eu mesmo introduzi na entrega anterior.

## O que ele achou e eu não tinha visto

**O estado vazio pede cadastro.** Quem chega do Google querendo uma invoice
agora encontra, no primeiro bloco, "No companies saved yet" e um botão
"+ Add company". A vantagem competitiva é *não precisar de cadastro*, e a
tela abre pedindo um. É o problema mais caro da lista.

**Contraste passa em tudo** — 5,92:1 na legenda, 6,15:1 no total e no botão,
pior caso 5,30:1 no escuro. Nada a corrigir.

## As três direções

| | A — prévia ao lado | B — uma página redesenhada | C — documento editável |
| --- | --- | --- | --- |
| Incômodo 1 (personalidade) | resolve | parcial | resolve |
| Incômodo 2 (ver o resultado) | **resolve** | metade (modal) | resolve |
| Incômodo 3 (buraco) | resolve | **resolve pela raiz** | some, nasce outro |
| Incômodo 4 (comprimento) | 1.220px / 1.037px mobile | 1.435px (−60px só) | resolve |
| Custo | alto | **baixo** | alto + risco de a11y |

**A** — formulário à esquerda, documento montando à direita. Blocos em
acordeão fecham com resumo, o que derruba o mobile de 2.355 para 1.037px.
Custo: exige um segundo renderizador da invoice (HTML, além do jsPDF), que
**vai divergir** em algum momento.

**B** — mesma estrutura, com hero, cartões numerados e barra de ação fixa.
Resolve o buraco pela raiz: devolve os campos do From à página, então as duas
colunas ficam com 3 campos cada. Mas **não resolve o comprimento no desktop**
(1.435px contra 1.495px de hoje) e só mostra o resultado por modal.

**C** — a pessoa edita o próprio documento, sem formulário. O `ux`
desaconselha: rótulo visível vira placeholder, e placeholder não é rótulo —
briga direta com a regra "todo campo com `<label htmlFor>`".

## Recomendação do `ux`: A, com o bloco 2 de B dentro

A é a única que resolve os quatro incômodos e a única com resposta para "por
que usar isto em vez do nagringa.dev" — formulário contra formulário quem
ganha é quem tem mais SEO, não quem desenha melhor.

Mas A sozinha herda o erro do estado vazio. **Pegar o bloco "Who is billing
whom" de B** (campos do From na página, empresa salva como atalho) mata o
buraco pela raiz e faz o primeiro contato não pedir cadastro.

## Perguntas de produto que ficaram abertas

1. **A prévia mostra o documento real ou uma aproximação?** Se for
   aproximação, a tela precisa dizer isso. É escolha entre custo de
   manutenção e promessa ao usuário.
2. **A porta de entrada deve vender as trilhas com mais força?** Hoje é uma
   linha no rodapé, que é onde ninguém olha.

## Mockups

No scratchpad da sessão: `mock-a-desktop.png`, `mock-a-desktop-dark.png`,
`mock-a-mobile.png`, `mock-b-desktop.png`, mais o estado atual em
`light-desktop-empty.png` e `light-mobile-empty.png`.

São HTML descartável, fora do repositório. Nenhum arquivo do projeto foi
tocado.
