# JOB-05 · Salvar vaga

**Estado:** feito (21/08/2026)
**Tamanho:** P
**Decisão do stakeholder:** "não vou querer as vagas no banco de dados, a não
ser que o usuário decida guardar a vaga para ele."

## O que faz

Uma estrela no cartão. Clicou, a vaga **sai da regra dos 15 dias** e fica para
sempre.

## Salva um retrato, não uma referência

Guardar só a URL faria a lista de salvas virar coleção de 404 — a vaga sai do ar
em semanas, e é justamente o que a pessoa vai querer reler depois.

Salva título, empresa, URL, os selos, o "por que combina" e o texto capturado.
Assim a página cair não apaga a informação, e a interpretação da IA continua
auditável contra o texto que a gerou.

## Onde ela vê depois

Painel "Minhas vagas" à esquerda, no mesmo padrão do histórico da invoice —
recolhível, com contagem visível. É o mesmo gesto e pela mesma razão: dizer
"o que você guardou está aqui" sem exigir um clique às cegas.

## Critério de aceite

- [x] A estrela salva e desfaz, sem confirmação
- [x] Vaga salva continua legível depois dos 15 dias — tabela separada, sem `expiresAt`
- [x] Salvar duas vezes não duplica — conferido: 2 POSTs, 1 registro
- [x] O painel mostra a contagem
- [x] `aria-live` anuncia "vaga salva", sem toast que some

## Verificado (21/08)

**Backend**, por `curl`:

```
POST   /jobs/saved          → grava com snapshot (salário, elegibilidade)
POST   a mesma de novo      → 201, e continua 1 registro
GET    /jobs/saved          → devolve com os campos do retrato
DELETE /jobs/saved?url=…    → 200, restam 0
DELETE de uma que não existe → 404
```

**Tela**, com Playwright:

```
25 estrelas na lista
aria-pressed  false → true
aria-label    "Save…" → "Remove…"
aria-live     "Programmeur Backend DevOps senior saved."
painel        aparece só depois de salvar, com a contagem
zero erro de console
```

## Duas decisões que fogem do card

**O painel ficou no topo, não à esquerda.** A tela de vagas já tem oito
filtros na lateral; uma terceira coluna espremeria a lista, que é o conteúdo.
Recolhido por padrão, com a contagem visível — o mesmo gesto do histórico da
invoice, e pela mesma razão.

**`upsert` em vez de erro no duplicado.** Clicar na estrela de uma vaga já
salva é engano comum (a tela pode estar desatualizada), e responder 409
transformaria um gesto inofensivo em erro na cara da pessoa. O retrato é
atualizado: se ela salvou de novo, a versão que está vendo é a que vale.

**A estrela some sem sessão.** `salvas === null` significa "não sei", e a
estrela não aparece — melhor ausente que mostrando um estado que pode estar
errado, ou falhando no clique.

## Depende de

- JOB-04 (a tela)
- PLT-02 (vaga salva precisa de dono)
