# INV-13 · Dados de pagamento em campos, não em texto livre

**Estado:** feito (13/08/2026)
**Tamanho:** M
**Pedido do stakeholder (13/08/2026):** mostrou uma invoice real com IBAN,
SWIFT, beneficiário e banco em linhas rotuladas, e pediu "um campo para cada
parte do payment method". Depois esclareceu: **não obrigatórios, e o usuário
pode renomear ou excluir**.

## Por quê

O Payment era um `<textarea>` solto. Quem escrevia lá tinha que formatar à
mão, e o PDF imprimia o bloco como um parágrafo — não como as linhas
"rótulo → valor" que uma invoice de verdade tem.

A imagem que o stakeholder mostrou é o formato usado por quem recebe
transferência internacional: sete linhas, cada uma com seu nome.

## O que foi feito

Os dados de pagamento viraram **linhas de rótulo + valor, as duas editáveis**.
Vêm sete prontas (Payment Method, IBAN, Beneficiary Name, Beneficiary Address,
SWIFT Code, Bank, Bank Address), e a partir daí:

- **renomear** o rótulo — "Bank" vira "Banco", ou o que a pessoa quiser
- **excluir** a linha que não usa, inclusive todas
- **acrescentar** linha nova
- **deixar em branco** — a linha vazia simplesmente não aparece no documento

A decisão central: **o rótulo é dado, não código.** Quem recebe por
transferência precisa de IBAN e SWIFT; quem recebe por Wise precisa só de um
e-mail. Sete campos fixos serviriam bem a um caso e mal a todos os outros.

## Critério de aceite

- [x] Sete campos vêm prontos, com os nomes da invoice de referência
- [x] Nenhum é obrigatório
- [x] Dá para renomear o rótulo
- [x] Dá para excluir qualquer linha, inclusive ficar sem nenhuma
- [x] Dá para adicionar linha nova
- [x] Campo em branco não aparece na prévia nem no PDF
- [x] O PDF imprime "Rótulo: valor", uma por linha
- [x] Quem tinha texto livre salvo não o perde

## Compatibilidade com o rascunho antigo

O campo `paymentDetails` (texto livre) continua no modelo. Quem tinha algo
escrito lá vê um textarea extra rotulado "Older free-text details", com a
dica de mover para os campos novos e limpar. Some sozinho quando esvaziado.

Sem isso, quem já usava a ferramenta abriria a página e encontraria seus dados
bancários desaparecidos.

## Verificado no navegador

Preencher só 4 das 7 linhas, renomear uma, excluir outra, adicionar uma nova,
e conferir no PDF extraído com `pdftotext`:

```
PAYMENT DETAILS
Payment Method: International Wire
SWIFT Code: BKCOBRSP
Banco: TRAVELEX BANCO DE CAMBIO SA
```

As linhas vazias não aparecem, e "Banco" saiu com o nome que foi digitado.
