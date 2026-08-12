# INV-09 · Redesenhar a tela do gerador de invoice

**Estado:** esperando decisão — o agente `ux` propõe, o stakeholder escolhe
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

- [ ] O `ux` viu a tela de verdade, nos dois tamanhos e nos dois temas
- [ ] O diagnóstico foi confirmado ou corrigido com medida
- [ ] Há 2 ou 3 direções distintas, com esboço e custo
- [ ] Há uma recomendação explícita
- [ ] O stakeholder escolheu uma direção

Depois da escolha, a execução vira card próprio — o tamanho depende do que for
escolhido.

## Observações

Não fazer nada também é uma opção defensável: a tela funciona e o produto não
tem usuário ainda. Mas como é a porta de entrada, e o próprio dono não gostou,
provavelmente vale a pena.
