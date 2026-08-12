# INV-06 · Ativar o download por teclado joga o foco para o topo

**Estado:** pronto para fazer
**Tamanho:** P

## Por quê

Achado do QA em 12/08/2026. Quem navega por teclado é jogado ao topo do
documento ao baixar a invoice e precisa retabular a página inteira — que tem
mais de 30 elementos focáveis — para voltar ao botão.

O projeto trata acessibilidade como requisito, não como extra, então isto é
bug como qualquer outro.

## Como reproduzir

1. Abrir `/invoice` e preencher os obrigatórios
2. Tab até "Download PDF"
3. Pressionar Enter (ou Espaço)

Esperado: o foco permanece no botão
Obtido: `document.activeElement` vira `<body>`, e não volta ao terminar

## Causa

O navegador tira o foco de um elemento que se torna `disabled`, e o React não
o restaura quando o `disabled` sai. É consequência direta da correção do
INV-03 — antes dela o botão nunca ficava desabilitado.

## Critério de aceite

- [ ] Ativar por Enter mantém o foco no botão durante e depois da geração
- [ ] O mesmo por Espaço
- [ ] O anel de foco continua visível ao voltar
- [ ] Não quebra a ativação por mouse

## Observações

Depende de como o INV-03 for finalizado: se a solução deixar de usar
`disabled` (por exemplo, mantendo o botão habilitado e ignorando o clique
com aviso), este card pode desaparecer sozinho. **Reavaliar depois que o
INV-03 fechar.**
