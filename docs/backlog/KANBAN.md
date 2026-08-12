# Kanban — Horizons

Um arquivo por card em [cards/](cards/). Este arquivo é o quadro: mover um
card é mover a linha de coluna, e atualizar o campo **Estado** dentro do
arquivo dele.

Prefixos: `INV` invoice · `LRN` trilhas · `PLT` plataforma (login, infra,
umbrella).

---

## Backlog

Achados do QA adversarial de 12/08/2026 — nenhum quebra a aplicação, os três
esperam decisão de produto antes de virar código.

| Card | Título | Tam. |
| --- | --- | --- |
| [INV-01](cards/INV-01-total-negativo.md) | Quantidade negativa gera invoice com total negativo | P |
| [INV-02](cards/INV-02-numero-grande-vira-zero.md) | Número grande demais vira $0.00 em silêncio | P |
| [INV-03](cards/INV-03-clique-repetido-gera-varios-pdfs.md) | Clique repetido em baixar gera vários PDFs | P |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos, histórico e duplicar do mês passado | G |

## Pronto para fazer

_(vazio — INV-01 e INV-02 entram aqui assim que a decisão de produto sair;
INV-03 já está pronto para pegar, se quiser resolvê-lo direto)_

## Fazendo

_(vazio)_

## Feito

| Card | Título | Quando |
| --- | --- | --- |
| — | Gerador de invoice, camada 1 (formulário, PDF, rascunho local) | 12/08/2026 |
| — | Trilhas, progresso e 75 aulas autorais de System Design | 11/08/2026 |

---

## O que trava o resto

**Login de verdade.** O `CurrentUserGuard` é um stub: lê `x-user-email`, cria
a conta se não existir, nunca rejeita. Serve para um app pessoal e não serve
para guardar dado de cliente de outra pessoa.

O INV-10 depende dele por inteiro, e ele não é só da invoice — vale para o
Learning e para o Beyond. Enquanto não for decidido, a Camada 2 da invoice não
começa.

## Decisões já tomadas

Para não serem rediscutidas sem motivo novo:

- **Cobrança fica para depois.** Sem informação para precificar; primeiro usar
  e medir.
- **A invoice é anônima por padrão.** Exigir cadastro para gerar um PDF perde
  a corrida contra um formulário que gera na hora.
- **A invoice é em inglês, as trilhas em português.** A invoice é porta de
  entrada global; as trilhas são para o dev brasileiro.
- **O PDF é gerado no navegador.** Custo zero de servidor, funciona anônimo.
