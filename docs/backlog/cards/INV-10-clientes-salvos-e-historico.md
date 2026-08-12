# INV-10 · Clientes salvos, histórico e duplicar do mês passado

**Estado:** backlog
**Tamanho:** G — provavelmente são três cards, ver observações

## Por quê

Hoje o gerador é anônimo e roda inteiro no navegador. Isso foi decisão
deliberada: quem chega do Google gera o PDF sem cadastro, e o login vira
consequência do valor entregue, não pedágio.

O passo seguinte é reter quem voltou. Quem fatura o mesmo cliente todo mês
redigita tudo — nome, endereço, e-mail, itens — e só muda o número e a data.
"Duplicar do mês passado" é o caso de uso real de quem trabalha por contrato
recorrente, e é ele que justifica criar conta.

## O que

Quem estiver logado ganha: clientes salvos, histórico de invoices emitidas,
numeração automática e duplicar uma invoice anterior. Quem não estiver
continua gerando PDF normalmente, sem perder nada do que existe hoje.

## Critério de aceite

**Anônimo (não pode regredir):**
- [ ] Sem login, `/invoice` continua gerando PDF exatamente como hoje
- [ ] O rascunho do navegador continua funcionando
- [ ] Nada exige cadastro para chegar ao PDF

**Logado — clientes:**
- [ ] Salvar os dados do cliente atual
- [ ] Escolher um cliente salvo preenche nome, endereço e e-mail
- [ ] Lista vazia mostra mensagem, não uma lista em branco
- [ ] Apagar pede confirmação

**Logado — histórico:**
- [ ] Invoice gerada aparece no histórico
- [ ] O histórico mostra número, cliente, data, total e moeda
- [ ] Dá para baixar de novo o PDF de uma invoice antiga
- [ ] Ordenado da mais recente para a mais antiga

**Logado — recorrência:**
- [ ] "Duplicar" cria uma nova a partir de uma anterior, com número novo e
      datas atualizadas
- [ ] O número é sugerido em sequência, e dá para editar

## Casos de borda

- Duas abas emitindo ao mesmo tempo: o número não pode repetir
- Cliente apagado que já foi usado numa invoice antiga: o histórico mantém os
  dados como estavam na emissão (não pode sumir da fatura já enviada)
- Rascunho anônimo quando a pessoa faz login: aproveitar ou descartar? Decidir
- Moeda diferente entre invoices do mesmo cliente

## Fora de escopo

- Cobrança e planos (adiado por decisão de produto — sem informação para
  precificar)
- Enviar a invoice por e-mail
- Marcar como paga / controle de recebimento
- Importar cliente de CSV

## Depende de

- **Login de verdade.** Hoje o `CurrentUserGuard` é um stub que lê
  `x-user-email` e nunca rejeita — qualquer um vira qualquer um mandando um
  header. Não dá para guardar dado de cliente em cima disso.

## Observações

**Isto é grande demais para um card.** Sugiro quebrar em:

- INV-10 login de verdade (bloqueia todo o resto)
- INV-11 clientes salvos
- INV-12 histórico de invoices
- INV-13 duplicar e numeração automática

A decisão que trava tudo é o login: sem ela, nenhuma das outras três existe.
E ela é maior que a invoice — vale para o Learning e para o Beyond também,
o que foi discutido mas não decidido.

Referência: o plano da Camada 2 está em
`/home/legion/.claude/plans/squishy-gliding-yeti.md`.
