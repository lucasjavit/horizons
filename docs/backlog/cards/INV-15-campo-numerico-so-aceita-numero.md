# INV-15 · Campo numérico aceitava letra

**Estado:** feito (13/08/2026)
**Tamanho:** P
**Achado pelo stakeholder (13/08/2026)**, com print: `1eee` digitado no campo
Hours e aceito pela tela.

## Por quê

Os campos de Hours e Rate são `type="text" inputMode="decimal"` — decisão
deliberada do INV-01, porque `type="number"` descarta entrada inválida em
silêncio, muda de valor com a roda do mouse e tem setinhas de alvo minúsculo.

Só que ninguém filtrava o que era digitado. `1eee` ficava na tela, o parse
lia `1`, e o campo mostrava uma coisa enquanto o cálculo usava outra.

## O que foi feito

`somenteNumero` filtra no `onChange`: **a letra nem chega a aparecer.** Melhor
que aceitar e reclamar depois.

O que passa: dígito, **um** separador decimal (ponto ou vírgula), e o sinal
de menos no começo.

O que não passa: letra, símbolo, segundo separador, sinal no meio.

Negativo continua sendo aceito na digitação de propósito — rejeitá-lo é
trabalho da validação (INV-01), que já explica o erro. Bloquear na digitação
deixaria a pessoa sem entender por que a tecla não funciona.

## Verificado no navegador

| Digitado | Vira |
| --- | --- |
| `1eee` | `1` |
| `abc` | vazio |
| `12abc34` | `1234` |
| `1e9` | `19` |
| `Infinity` | vazio |
| `2.5.7` | `2.57` |
| `1-2` | `12` |
| `26,50` | `26,50` |
| `-5` | `-5` |

E o uso normal segue intacto: `44 × 26,50 = $1.166,00`, e `2.5` continua
valendo como fração de hora.

Colar também filtra — o `onChange` cobre digitação e colagem.
