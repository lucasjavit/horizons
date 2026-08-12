# INV-05 · Depois de uma falha, "Please try again" nunca funciona

**Estado:** pronto para fazer
**Tamanho:** P

## Por quê

Achado do QA em 12/08/2026, durante a revisão do INV-03. A mensagem de erro
instrui a pessoa a fazer exatamente o que não pode dar certo: clicar de novo
nunca funciona, por mais que a rede tenha voltado. Só recarregar a página
recupera.

Quem teve um soluço de rede fica sem conseguir emitir a invoice, e a interface
mente sobre a saída.

## O que

Depois de uma falha ao carregar o jsPDF, toda tentativa seguinte falha
instantaneamente sem tocar a rede.

## Como reproduzir

1. Abrir `/invoice` e preencher os obrigatórios
2. Derrubar a rede (ou bloquear `/assets/jspdf*`)
3. Clicar em "Download PDF" → "Could not generate the PDF. Please try again."
4. Restaurar a rede
5. Clicar de novo, quantas vezes quiser

Esperado: gera o PDF
Obtido: zero downloads, mesma mensagem, e **zero requisições de rede novas**

O QA contou as requisições ao chunk: a primeira tentativa dispara 2, todas as
seguintes disparam 0. Depois de F5 com a rede liberada, baixa normalmente.

## Causa

Um `import()` que rejeita fica cacheado permanentemente no registro de módulos
do ESM. Toda retentativa rejeita a partir do cache, sem nova requisição.

## Critério de aceite

- [ ] Após uma falha por rede, com a rede restaurada, clicar de novo gera o PDF
- [ ] A retentativa dispara requisição de rede de verdade
- [ ] Se falhar de novo, a mensagem continua aparecendo (sem travar)
- [ ] Não é preciso recarregar a página em nenhum caso

## Observações

O caminho usual é forçar uma URL nova a cada tentativa (ex.: acrescentar um
parâmetro de cache-busting ao especificador), o que faz o navegador tratar
como outro módulo. Confirmar que isso não quebra o code splitting do Vite —
o jsPDF **precisa continuar em chunk separado**, senão o INV-05 conserta um
bug e cria outro pior.

Alternativa mais simples: manter o `import()` como está e apenas trocar a
mensagem para dizer a verdade ("recarregue a página e tente de novo"). Resolve
a mentira sem resolver o problema.

Não foi introduzido pelo INV-03 — existe desde a primeira versão da feature.
