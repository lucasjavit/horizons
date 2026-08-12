# Kanban — Horizons

Um arquivo por card em [cards/](cards/). Este arquivo é o quadro: mover um
card é mover a linha de coluna, e atualizar o campo **Estado** dentro do
arquivo dele.

Prefixos: `INV` invoice · `LRN` trilhas · `PLT` plataforma (login, infra,
umbrella).

---

**Sprint atual:** [01 · Invoice confiável](sprints/01-invoice-confiavel.md)
(12/08 – 26/08) — fechar os achados do QA para a invoice poder ir ao ar.

## Backlog

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos, histórico e duplicar do mês passado | G | trava no login; quebrar em 4 antes |

## Pronto para fazer

| Card | Título | Tam. | Origem |
| --- | --- | --- | --- |
| [INV-05](cards/INV-05-retry-impossivel-apos-falha.md) | Após falha, "try again" nunca funciona | P | QA no INV-03 |
| [INV-07](cards/INV-07-status-preso-em-baixado.md) | Status fica preso em "Invoice downloaded." | P | QA no INV-03 |
| [INV-01](cards/INV-01-total-negativo.md) | Quantidade negativa gera total negativo | P | decidido: rejeitar |
| [INV-02](cards/INV-02-numero-grande-vira-zero.md) | Número grande vira $0.00 em silêncio | P | decidido: teto de 1.000.000 |
| [INV-06](cards/INV-06-foco-perdido-no-teclado.md) | Foco vai para o topo ao baixar por teclado | P | reavaliar após INV-03 |

## Esperando decisão

| Card | Título | Tam. | Decisão pendente |
| --- | --- | --- | --- |
| [INV-04](cards/INV-04-pdf-com-dados-antigos.md) | **PDF com dados antigos se editar durante a geração** | P | bloquear edição, avisar, ou regenerar? |

## Fazendo

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| [INV-03](cards/INV-03-clique-repetido-gera-varios-pdfs.md) | Clique repetido gera vários PDFs | P | 1ª tentativa reprovada pelo QA; em correção |

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
