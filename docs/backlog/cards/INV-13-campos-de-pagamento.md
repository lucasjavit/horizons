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


## Posição no documento (13/08/2026)

Por decisão do stakeholder, o bloco PAYMENT DETAILS passou a ficar **acima da
tabela de itens**, entre FROM/BILL TO e DESCRIPTION.

Faz sentido além da estética: quem recebe a fatura precisa saber para onde
pagar, e essa informação não deve estar depois de uma tabela que pode ocupar
a página inteira — numa invoice com trinta linhas, os dados bancários ficariam
na segunda página.

No PDF virou função própria (`desenharPagamento`), com rótulo à esquerda e
valor à direita: alinhado nas duas bordas, a lista é lida como tabela e não
como parágrafo. A prévia espelha a mesma ordem.


## Zebra e fio dourado (13/08/2026)

O bloco ganhou a **mesma zebra da tabela de itens** e o **fio dourado do
cabeçalho** logo acima do título.

A zebra não é enfeite: são sete linhas de código bancário, e sem o trilho o
olho pula de linha entre o rótulo à esquerda e o valor à direita. Errar o
IBAN por ler a linha errada é o tipo de falha que só aparece quando o
pagamento não chega.

No PDF a faixa é desenhada antes do texto — se fosse depois, cobriria o que já
tinha sido escrito.
