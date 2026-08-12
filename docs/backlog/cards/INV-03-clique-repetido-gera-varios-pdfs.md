# INV-03 · Clique repetido em baixar gera vários PDFs

**Estado:** backlog
**Tamanho:** P

## Por quê

Achado do QA adversarial em 12/08/2026. Três cliques rápidos geram três
downloads idênticos. Não corrompe nada, mas polui a pasta de downloads e faz
a pessoa duvidar de qual arquivo é o certo — justamente num documento que ela
vai enviar para um cliente.

Acontece porque a geração é assíncrona (o jsPDF baixa sob demanda na primeira
vez) e o botão continua clicável enquanto isso.

## O que

Impedir o segundo clique enquanto o primeiro está em andamento.

## Critério de aceite

- [ ] Durante a geração o botão fica desabilitado
- [ ] Três cliques rápidos produzem exatamente um download
- [ ] O texto do botão indica o andamento (já existe: "Preparing PDF…")
- [ ] Ao terminar, o botão volta a funcionar
- [ ] Se a geração falhar, o botão volta a funcionar (não pode travar)

## Como reproduzir hoje

1. Abrir `/invoice`, preencher os obrigatórios
2. Clicar em "Download PDF" três vezes seguidas, rápido

Esperado: 1 download
Obtido: 3 downloads

## Observações

O estado `estadoPdf` já existe em `InvoicePage.tsx` e já vale `'gerando'`
durante a operação — falta ligá-lo ao `disabled` do botão.

Cuidado com o padrão da casa: o projeto deliberadamente **não** desabilita o
botão para validação inválida, porque botão desabilitado não recebe foco nem
explica o motivo. Aqui é diferente — é bloqueio momentâneo com texto visível
dizendo o que está acontecendo, não recusa silenciosa.
