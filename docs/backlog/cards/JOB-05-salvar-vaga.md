# JOB-05 · Salvar vaga

**Estado:** backlog
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

- [ ] A estrela salva e desfaz, sem confirmação (é reversível e barato)
- [ ] Vaga salva continua legível depois dos 15 dias
- [ ] Salvar a mesma vaga duas vezes não duplica (`@@unique([userId, url])`)
- [ ] O painel mostra a contagem
- [ ] `aria-live` anuncia "vaga salva", sem toast que some

## Depende de

- JOB-04 (a tela)
- PLT-02 (vaga salva precisa de dono)
