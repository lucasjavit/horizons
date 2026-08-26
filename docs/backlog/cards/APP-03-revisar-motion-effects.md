# APP-03 · Revisar motion effects e referências de interface

**Estado:** aberto (26/08/2026)
**Tamanho:** P (só a revisão; o que ela gerar vira card próprio)

## Por quê

O app hoje é estático: nada anima, nada responde ao ponteiro além do `hover` de
cor. Isso é barato de manter e nunca atrapalha, mas também não ajuda em nada —
não indica que algo carregou, não mostra que uma vaga entrou na lista durante a
busca ao vivo, não dá peso ao botão que gera o PDF.

Existe uma leva de bibliotecas de efeito **copy-paste, open-source, sem
dependência de runtime** — CSS puro ou quase. Isso muda o cálculo: o custo
histórico de animação era o pacote de JS, e nesses casos não há pacote.

## O que revisar

| Fonte | O que é | Interesse aqui |
| --- | --- | --- |
| [kinetics.colorion.co](https://kinetics.colorion.co) | Motion effects, open-source, feitos para copiar | O alvo principal |
| [animatedbuttons.colorion.co](https://animatedbuttons.colorion.co) | Botões CSS animados | Ação primária (gerar PDF, buscar vagas) |
| [vibeprompts.dev](https://vibeprompts.dev) | Biblioteca de prompts de UI | Insumo para o agente `ux`, não código |
| [iconcreator.dev](https://iconcreator.dev) | Desenhador de ícones grátis | Os ícones de hoje são glifos soltos |
| [invoicegenerator.io](https://invoicegenerator.io) | Gerador de invoice grátis | **Concorrente direto do nosso Invoice** — revisar como benchmark, não como fonte |

## O que a revisão precisa responder

- **Onde falta movimento**, com o lugar nomeado — não "o app podia animar mais".
  Candidatos óbvios: vaga entrando na lista durante a busca ao vivo (JOB-07),
  estado `salvando/salvo` do autosave, estrela de salvar vaga (JOB-05), o
  `LoadingState`.
- **O efeito passa nas regras da casa?** Cor por token CSS, nunca classe
  Tailwind de cor; funciona nos dois temas; alvo de toque ≥24px continua válido.
- **`prefers-reduced-motion` é obrigatório.** Acessibilidade não é opcional
  aqui, e efeito copiado da internet quase nunca traz esse guard. Efeito que não
  respeita a preferência **não entra**.
- **Custo de bundle, medido.** O Invoice já paga 400 KB de jsPDF por
  `import()` dinâmico justamente para não onerar quem só lê uma aula. Efeito que
  peça runtime de animação precisa justificar o número.
- **O invoicegenerator.io faz o que o nosso não faz?** É a única fonte da lista
  que é concorrente, e vale olhar com essa lente.

## Critérios de aceite

- [ ] Cada uma das cinco fontes revisada, com veredito de uma linha
- [ ] Lista dos lugares do app onde movimento resolve algo, com o arquivo
- [ ] Cada efeito candidato tem o guard de `prefers-reduced-motion` conferido
- [ ] Cada efeito candidato tem o custo de bundle anotado (0 KB, se for CSS)
- [ ] O que sobreviver vira card de implementação; o que for descartado fica
      registrado aqui **com o motivo**

## Nota

Este card é de **revisão**, não de implementação. Fechar significa ter a
decisão escrita — inclusive se a decisão for "nada disso entra". Efeito que
entra sem decidir onde resolve o quê vira enfeite, e enfeite é dívida que
ninguém consegue remover depois.
