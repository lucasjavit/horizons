# JOB-56 · CV não lido por falta de crédito diz isso, e não "tente de novo"

**Estado:** feito (06/10/2026)
**Tamanho:** P
**Relatado pelo Lucas (06/10/2026):** "por que a aplicação não está conseguindo
ler o CV?" — e a tela não dizia.

## Por quê

Medido em 06/10, no log da API, em três uploads seguidos (12:26, 12:29, 12:30):

```
CadeiaEsgotada: todos os 6 provedores falharam: Mistral (chave recusada),
ChatGPT (OpenAI) (chave recusada), Gemini (Google) (erro),
Claude (Anthropic) (erro), Groq (sem chave), Cerebras (sem chave)
```

A tela mostrou *"We could not read the resume right now. Try again in a
moment"*. **Tentar de novo não resolve conta sem crédito** — a pessoa tentou
três vezes. O motivo estava só no log.

Dois defeitos:

1. `CvExtratorService` só distinguia "ninguém tem chave" de "todo o resto". Chave
   recusada e sem crédito caíam no genérico, que promete o que não acontece.
2. O 400 da Anthropic com *"Your credit balance is too low"* era classificado
   como `erro` (transitório), porque `ehChaveMorta` olha só o status
   (401/402/403/429). É conta a pagar com status de pedido inválido.

## Decisão

- Cadeia esgotada com **alguma** chave recusada ou sem crédito: a mensagem diz
  isso e manda conferir as chaves em Settings. O detalhe por provedor continua
  em `/config/ia`, que é onde se age — a mensagem do upload não lista
  provedores, porque quem sobe o CV nem sempre é quem administra.
- Só falhas transitórias (500, timeout): continua "try again in a moment",
  que aí é verdade.
- `ehChaveMorta` reconhece o 400 de saldo da Anthropic.

## Critérios de aceite

- [x] Com chave recusada ou sem crédito, o upload do CV diz que é a chave
- [x] Só com erro transitório, a mensagem continua mandando tentar de novo
- [x] Sem nenhuma chave, a mensagem antiga ("precisa da chave") não muda
- [x] O 400 de saldo da Anthropic conta como chave morta; outro 400 não
- [x] A mensagem nova sai em inglês na tela (`erros-do-servidor.ts`)
- [x] Testes automatizados

## Não resolvido

- O log chama o 429 de "sem crédito" de `chave recusada`: a cadeia tem um
  motivo só para os dois, enquanto a tela de `/config/ia` separa
  (`chave_recusada` / `sem_cota`). É só o texto do log; não mexi.
