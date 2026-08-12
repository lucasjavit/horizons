# Sprint 01 · Invoice confiável

**De:** 12/08/2026 · **Até:** 26/08/2026
**Objetivo:** fechar os achados do QA para a invoice poder ir ao ar sem
ressalva.

## Compromisso

| Card | Título | Tam. | Estado |
| --- | --- | --- | --- |
| [INV-03](../cards/INV-03-clique-repetido-gera-varios-pdfs.md) | Clique repetido gera vários PDFs | P | pronto para fazer |
| [INV-01](../cards/INV-01-total-negativo.md) | Quantidade negativa gera total negativo | P | **espera decisão** |
| [INV-02](../cards/INV-02-numero-grande-vira-zero.md) | Número grande vira $0.00 em silêncio | P | **espera decisão** |

Três cards pequenos, um só executor. É pouco de propósito: melhor terminar
três do que começar oito.

## Por que estes

Aplicando a ordem de prioridade:

1. **Está quebrado?** Os três são achados reais do QA. Nenhum derruba a
   aplicação, mas INV-01 e INV-02 produzem **número errado numa fatura que vai
   para um cliente** — que é o pior tipo de erro que este produto pode ter.
2. **Trava outra coisa?** Nenhum trava, mas todos travam a confiança: não dá
   para divulgar um gerador de invoice que aceita total negativo.
3. **Quanto vale?** A invoice é a porta de entrada global. Cada bug aqui é
   visto por quem chegou pela primeira vez.
4. **Quanto custa?** Os três são P. INV-03 é puramente técnico e pode começar
   agora.

## Fora desta sprint

**[INV-10](../cards/INV-10-clientes-salvos-e-historico.md)** — clientes salvos,
histórico e duplicar. Motivo: depende de login de verdade, que não foi
decidido. Hoje o `CurrentUserGuard` aceita qualquer `x-user-email` e nunca
rejeita; não dá para guardar dado de cliente em cima disso.

Além disso o card é G, e G quase sempre são vários cards disfarçados. Ele já
traz a sugestão de quebra em quatro (login, clientes, histórico, duplicar) —
essa quebra deve acontecer antes de entrar em qualquer sprint.

## O que está travado

**Duas decisões suas destravam dois dos três cards desta sprint.**

### 1. Quantidade negativa: rejeitar ou virar desconto?

Hoje quantidade `-5` produz total `-$500.00` e gera o PDF normalmente.

- **Rejeitar** — mais simples, e uma fatura negativa não existe mesmo.
- **Virar linha de desconto** — resolve um caso legítimo (crédito de mês
  anterior, abatimento acordado) e é mais barato do que parece, porque
  `parseAmountToCents` já trata o sinal. Custa a apresentação no PDF.

### 2. Valor grande demais: avisar ou continuar zerando?

Hoje valor acima do inteiro seguro vira `$0.00` sem dizer nada. Não quebra,
mas some com o número que a pessoa digitou.

- **Avisar** — o campo fica inválido dizendo que o valor é grande demais.
- **Manter** — assumir que ninguém digita um trilhão numa invoice de verdade.

Relacionado, e vale decidir junto: `1e9` na quantidade hoje é aceito como um
bilhão. Provavelmente foi erro de digitação de quem queria `1`.

## Andamento

```
Feito: nada ainda (sprint recém-aberta)
Pronto para pegar: INV-03
Travado: INV-01 e INV-02, esperando as duas decisões acima
Fora: INV-10, precisa da decisão de login e de ser quebrado em quatro
```
