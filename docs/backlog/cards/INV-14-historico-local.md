# INV-14 · Histórico de invoices no navegador

**Estado:** feito (13/08/2026)
**Tamanho:** M
**Pedido do stakeholder (13/08/2026):** "mas pode ter um histórico de cache do
browser, não?"

## Por quê

A pergunta corrigiu um erro meu. Ao responder sobre histórico (INV-10), eu
apresentei como se fosse **ou** local **ou** com login — e isso é falso. As
duas coisas coexistem, e o local já funciona: rascunho e empresas salvas usam
exatamente esse caminho.

Medido antes de construir: **578 bytes por invoice**, cabem ~9.000 em 5 MB.
Uma por mês daria 755 anos. O limite prático não é espaço, é o navegador ser
limpo ou trocado.

## O que faz

- Toda invoice baixada entra no histórico, na lateral, abaixo da prévia
- Clicar num registro carrega a invoice no formulário
- **Editar e baixar cria um registro novo** — a original fica intacta
- **Baixar sem mudar nada não duplica** — só traz o registro para o topo
- Excluir, com confirmação
- Aviso explícito: fica só neste navegador

## A regra de edição

Foi definida pelo stakeholder para o INV-10 e aplicada aqui, o que mantém os
dois coerentes quando o histórico com login existir.

O que a sustenta tecnicamente é uma **assinatura de conteúdo**: compara o que
vai para o documento (número, datas, moeda, partes, itens, pagamento) e ignora
o resto. É isso que faz baixar de novo não duplicar, enquanto abrir a do mês
passado, trocar o período e baixar cria um registro novo.

**Duplicar não é um botão** — é o que acontece naturalmente. O caso real de
quem fatura todo mês vira fluxo, não comando a aprender.

## Critério de aceite

- [x] Some da tela quando não há nada
- [x] Baixar registra número, cliente, total e data
- [x] Baixar de novo sem alterar não duplica
- [x] Invoice diferente entra como registro novo
- [x] Mais recente no topo
- [x] Clicar carrega a invoice no formulário
- [x] Editar e baixar cria registro novo, com a original intacta
- [x] Excluir, com confirmação
- [x] Persiste depois do F5
- [x] `localStorage` bloqueado não derruba a página

## Detalhe que evita um bug silencioso

Tanto ao registrar quanto ao carregar, o rascunho é **copiado em profundidade**
(`JSON.parse(JSON.stringify(...))`). Sem isso os dois compartilhariam o mesmo
objeto: continuar editando o formulário alteraria o registro do histórico, e
a promessa de "a original fica intacta" seria falsa.

## Relação com o INV-10

Não substitui. O INV-10 (histórico com login, sincronizado entre máquinas)
continua bloqueado pela decisão de login, e o stakeholder manteve a posição de
que histórico de verdade espera essa decisão.

Este é o que funciona hoje, sem cadastro. Quando o login existir, o passo
natural é subir o histórico local para a conta.


## Posição na tela (13/08/2026)

Por pedido do stakeholder, o histórico saiu de baixo da prévia e virou um
**painel recolhível à esquerda**. A tela ficou com três colunas:

```
┌──────────┬──────────────────┬─────────────────┐
│ History  │  formulário      │  live preview   │
│ (recolhe)│                  │                 │
└──────────┴──────────────────┴─────────────────┘
```

**Começa fechado.** Quem chega pela primeira vez não tem histórico nenhum, e
quem tem prefere a tela cheia para preencher. O botão mostra a contagem
("History (3)"), então dá para saber que há algo lá sem abrir.

**Fechado, a coluna encolhe mas não some** (3rem em vez de 18rem). Se a coluna
desaparecesse, o formulário saltaria de lugar a cada abertura — e o campo sob
o cursor mudaria de posição no meio da digitação.

O painel usa `aria-expanded` e `aria-controls`, e o conteúdo fica `hidden`
quando fechado, não desmontado — abrir e fechar não recarrega a lista.
