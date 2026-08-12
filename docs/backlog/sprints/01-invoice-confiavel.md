# Sprint 01 · Invoice confiável

**De:** 12/08/2026 · **Até:** 12/08/2026 (fechada no mesmo dia)
**Objetivo:** fechar os achados do QA para a invoice poder ir ao ar sem
ressalva.

## Resultado

Objetivo atingido. Sete cards entregues — mais que os três do compromisso,
porque o QA encontrou quatro bugs novos durante a revisão e todos couberam.

| Card | Título | Estado |
| --- | --- | --- |
| INV-01 | Quantidade e valor negativos | feito |
| INV-02 | Teto de 1.000.000 por campo | feito |
| INV-03 | Clique repetido gera vários PDFs | feito |
| INV-04 | PDF com dados antigos ao editar durante a geração | feito |
| INV-06 | Foco perdido ao baixar por teclado | feito |
| INV-07 | Status preso em "Invoice downloaded." | feito |
| INV-08 | Cadastro de empresa em modal + select | feito |
| INV-05 | Retry sem F5 após falha de rede | **parado** |

## O que não fechou, e por quê

**INV-05.** As duas saídas viáveis foram testadas e medidas:

- URL dinâmica no `import()` quebra o code splitting — o bundle principal vai
  de 320 para 329 KB, com os 400 KB do jsPDF dentro.
- `fetch` com `cache: 'reload'` antes de reimportar reaquece o cache HTTP mas
  não apaga o registro de módulos do ESM, que guarda a rejeição para sempre.

O que sobra é carregar o jsPDF fora do ESM — mudança grande para um bug que
atinge só quem teve falha de rede. A mensagem já diz a verdade ("reload the
page"). Parado de propósito.

## O que esta sprint ensinou

**A separação entre quem faz e quem testa pagou.** O `tech-lead` deu o INV-03
como pronto tendo testado com cliques sintéticos no mesmo tick; o `qa` testou
com cliques humanos espaçados e o bug voltou. A janela de bloqueio durava
13ms — menos que o intervalo entre dois cliques do mesmo dedo.

**O QA achou mais bugs do que o card original tinha.** Quatro achados novos
durante a revisão de um card, incluindo o INV-04, que era mais grave que o
bug sendo corrigido: a pessoa enviava ao cliente uma fatura com valor e moeda
errados sem nada avisar.

**Três correções falharam por eu confiar no build em vez do navegador**: ref
lido durante a renderização (o `disabled` nunca chegava ao DOM), medição do
elemento errado (`input.disabled` dentro de fieldset desabilitado), e a
suposição de que o container servia build velho.

## Fora desta sprint

**INV-10** — clientes salvos, histórico e duplicar. Trava no login, que não
foi decidido, e é G demais: precisa ser quebrado em quatro antes de entrar em
qualquer sprint.
