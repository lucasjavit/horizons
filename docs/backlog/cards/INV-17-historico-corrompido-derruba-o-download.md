# INV-17 · Registro corrompido no histórico derruba o download

**Estado:** aberto
**Tamanho:** P
**Achado pelo QA-04 (01/09/2026)**, escrevendo os testes de `invoice/history.ts`.

## Por quê

**O download é o gesto que não pode falhar.** É o único desfecho da tela de
Invoice: a pessoa preencheu tudo e clica em baixar. Um registro velho e
malformado no `localStorage` faz `recordDownload()` lançar `TypeError` antes de
o PDF sair — e o histórico, que é uma conveniência, derruba a função principal.

O `storage.ts` já se protege disso: descarta o rascunho cujo `version` não é o
atual. O `history.ts` **não tem checagem de versão nenhuma** — a mesma chave
`horizons.invoice.history.v1` é lida de volta qualquer que seja o formato que a
escreveu. A assimetria entre os dois módulos é a causa de fundo.

## Como reproduzir

1. No console de `/invoice`:
   ```js
   localStorage.setItem(
     'horizons.invoice.history.v1',
     JSON.stringify([{ id: 'velho', savedAt: '2026-09-01T00:00:00.000Z', draft: {} }]),
   )
   ```
2. Preencher uma invoice válida e clicar em baixar.

Esperado: o PDF sai, e o registro inválido é ignorado.
Obtido: **`TypeError: Cannot read properties of undefined (reading 'trim')`**.

Medido fora do navegador, com a lógica dos dois trechos isolada:

| passo | resultado |
| --- | --- |
| a entrada passa no filtro do `ler()` | `true` |
| `assinatura()` sobre ela | `TypeError: ... (reading 'trim')` |

## Causa

Duas metades que discordam sobre o que é um registro válido.

O filtro do `ler()` (`frontend/src/invoice/history.ts`) valida só a casca:

```ts
typeof (e as HistoryEntry).id === 'string' &&
typeof (e as HistoryEntry).draft === 'object'
```

`{}` é um objeto, então `{draft: {}}` **passa**. E a `assinatura()` assume todo
campo preenchido, já na primeira linha:

```ts
n: d.invoiceNumber.trim(),
```

`recordDownload()` chama `assinatura()` sobre **cada registro guardado** para
achar a duplicata — então basta um registro ruim na lista para derrubar o
download de uma invoice nova e perfeitamente válida.

## Por que chega nesse estado

Três caminhos, nenhum exótico:

- **Formato antigo.** A chave é `.v1` fixa e nunca é comparada com nada. Um
  `HistoryEntry` escrito por qualquer versão anterior do `InvoiceDraft` é lido
  como se fosse do formato de hoje.
- **Escrita parcial.** `localStorage` cheio pode truncar; o JSON sobrevive e o
  conteúdo não.
- **Extensão ou script de terceiro** escrevendo na mesma origem.

## O teste

Entra **antes da correção**, como `it.failing`, seguindo o QA-02:

`frontend/src/invoice/history.spec.ts` → `registro guardado com draft
corrompido nao quebra a assinatura`

Quando a correção entrar, tirar o `.failing` — e o teste passa a guardar a
regressão.

## Critérios de aceite

- [ ] `recordDownload()` não lança com registro malformado no histórico
- [ ] O registro inválido é descartado, e não propagado para a lista nova
- [ ] O download acontece normalmente com lixo no `localStorage`
- [ ] O `it.failing` do `history.spec.ts` vira `it` e passa

## Caminho sugerido

Duas opções, e a segunda parece melhor:

1. Blindar a `assinatura()` com `?? ''` em cada campo. Resolve o sintoma e
   deixa a validação frouxa de pé.
2. **Apertar o filtro do `ler()`** para exigir os campos que a `assinatura()`
   lê (`invoiceNumber`, `items` como array), e versionar o histórico como o
   `storage.ts` já faz. Um registro que não serve para assinar não serve para
   nada — descartá-lo na leitura mantém uma fronteira só, em vez de espalhar
   `?? ''` por todo lado.
