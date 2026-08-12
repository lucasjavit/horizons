# INV-07 · O status fica preso em "Invoice downloaded."

**Estado:** feito (12/08/2026)
**Tamanho:** P

## Por quê

O QA levantou isto como pergunta ("é intencional?") em 12/08/2026. Verifiquei:
**não é intencional, é bug.**

Depois de baixar uma vez, a mensagem "Invoice downloaded." fica na tela para
sempre, mesmo editando todos os campos. Ela ocupa o mesmo espaço do aviso de
autosave, então "Draft saved in this browser." nunca mais reaparece na sessão
— e a pessoa perde a única confirmação de que o rascunho está sendo salvo.

Pior: a mensagem passa a mentir. Ela diz que a invoice foi baixada, enquanto
a que está na tela já é outra, ainda não baixada.

## Como reproduzir

1. Abrir `/invoice`, preencher e baixar → status: "Invoice downloaded."
2. Editar qualquer campo (por exemplo, o número da invoice)

Esperado: volta a "Draft saved in this browser." (ou fica em branco)
Obtido: continua "Invoice downloaded." indefinidamente

Medido:
```
antes de baixar:       Draft saved in this browser.
depois de baixar:      Invoice downloaded.
apos editar um campo:  Invoice downloaded.
```

## Causa

`estadoPdf` vira `'pronto'` ao terminar a geração e nunca volta a `'ocioso'`.
Nada observa a edição do rascunho para limpá-lo.

## Critério de aceite

- [ ] Editar qualquer campo depois de baixar volta o status ao de autosave
- [ ] A mensagem de autosave volta a funcionar normalmente
- [ ] "Invoice downloaded." continua aparecendo logo após baixar
- [ ] O `role="status"` continua anunciando as mudanças a leitor de tela, sem
      tagarelar a cada tecla

## Observações

Existe desde a primeira versão da feature; não foi introduzido pelo INV-03.
