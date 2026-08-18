# JOB-13 · Busca pela IA quando o Firecrawl está desligado

**Estado:** feito (18/08/2026) — falta verificar com chave real
**Tamanho:** M

## Por quê

Pedido do stakeholder: *"vamos desabilitar o firecrawl e vamos usar somente a
IA"*. Antes disso, desligar o Firecrawl produzia **uma mensagem de erro e mais
nada** — não havia caminho alternativo escrito.

## A restrição que define o desenho

**IA sem web não sabe vaga.** Medido em 18/08, com as 8 vagas reais da busca do
dia anterior como gabarito: perguntado sobre Dash0, Oscilar, Kadmos, Moniepoint
e Pinterest sem nenhuma ferramenta, o modelo **acertou as 5 empresas** e **não
soube 1 vaga** — nem título, nem salário, nem URL. Nas palavras dele:

> "IDs de vaga em Greenhouse/Lever/Ashby são opacos e não memorizáveis; eu
> produziria uma URL bem formada que dá 404. Esse é o modo de falha mais
> perigoso porque parece verificável."

Confirmado por outro caminho: perguntado onde a Elastic publica vagas, respondeu
`boards.greenhouse.io/elastic` — errado, redireciona para `jobs.elastic.co`.

**Fato de empresa sobrevive ao treino; URL de vaga apodrece.** Some-se o corte
de treino (maio/2026) contra a data de hoje: três meses de cegueira num dado que
vira em dias.

Por isso o motor de IA usa a ferramenta `web_search`. Quem busca é a IA — mas na
web de agora, não na memória.

## O que foi feito

`backend/src/jobs/busca-ia.service.ts`, motor novo:

- `web_search` como ferramenta, com o mesmo `output_config.format` do extrator
  de CV (schema obriga o formato, em vez de pedir JSON com jeitinho).
- As mesmas defesas do motor do Firecrawl, reescritas aqui porque **o schema
  obriga o formato, não a verdade**: salário só com trecho, elegibilidade só com
  citação (JOB-09), listagem descartada (JOB-10), URL tem de ser http(s) real.
- Instrução explícita contra montar URL a partir de padrão — é o modo de falha
  que a medição encontrou.

`busca.service.ts` escolhe o motor: sem chave do Firecrawl, cai para a IA. Sem
nenhum dos dois, diz o que falta em vez de falhar em silêncio.

`recursos.service.ts`: a busca passa a valer com **qualquer um** dos dois
motores. Antes exigia Firecrawl.

## Os dois motores, e por que os dois existem

| | Firecrawl | IA |
| --- | --- | --- |
| Como acha | `search` + abre cada página | `web_search` |
| Teto | 8 páginas (rate limit 14 req/min) | até 15 vagas |
| Custo | 2 + 5×8 = 42 créditos | 1 chamada |
| Tempo | ~60s | mais rápido |
| Profundidade | página inteira | trecho do resultado |

Firecrawl entra mais fundo em cada anúncio; a IA cobre mais anúncios. Não é um
substituindo o outro — é escolher entre profundidade e alcance.

## Critérios de aceite

- [x] Sem Firecrawl e com chave de IA, a busca roteia para a IA (log prova)
- [x] Sem nenhuma das duas chaves, a mensagem diz o que cadastrar
- [x] O interruptor de Configurações aceita qualquer um dos dois motores
- [x] Falha da IA é registrada em log, não engolida
- [ ] **Uma busca real pela IA, com chave válida da Anthropic**

## O que NÃO foi verificado

**Não há chave da Anthropic nesta máquina** — nem no banco, nem no ambiente. O
roteamento foi provado com uma chave inválida de propósito:

```
LOG   [BuscaService]   Firecrawl ausente — buscando pela IA
ERROR [BuscaIaService] busca por IA falhou: 401 API key is invalid
```

Isso prova que o motor certo foi escolhido e que a falha é tratada. **Não prova
que a busca pela IA devolve vaga boa.** Falta cadastrar uma chave em
Configurações e rodar — é o único critério aberto.

Quando rodar, conferir contra o que o Firecrawl entrega hoje: quantas vagas,
quantas com salário **e trecho**, e se alguma URL dá 404 (o modo de falha
previsto). Cuidado com o [JOB-12](JOB-12-url-de-vaga-nao-se-valida-por-status.md):
status 200 não prova que a vaga existe.
