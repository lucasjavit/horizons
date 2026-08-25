# JOB-34 · Separar o scrape da extração no `lerVaga`

**Estado:** avaliado, não implementado (25/08/2026) — falta uma medição de 2 páginas
**Tamanho:** M

## O que é

`backend/src/jobs/busca.service.ts:256` faz scrape e extração **numa chamada só**:

```ts
const doc = await fc.scrape(url, {
  formats: [{ type: 'json', prompt: INSTRUCAO, schema: SCHEMA_VAGA }],
  onlyMainContent: true,
  timeout: 45_000,
});
```

O `INSTRUCAO` e o `SCHEMA_VAGA` são **nossos** — quem roda o modelo é o
Firecrawl, a **5 créditos por página**.

Isso é exatamente a capacidade "schema obrigatório, sem web search", que os seis
provedores da cadeia do [JOB-33](JOB-33-cadeia-de-ia.md) atendem. É o **terceiro
uso de IA** do backend, e o único que ainda não passa pela cadeia.

## A ideia

Separar em dois passos:

1. Firecrawl entrega só o markdown (`formats: ['markdown']`) — mais barato
2. A extração passa pela cadeia de IA, como os outros dois usos

**O ganho não seria só custo.** Hoje, se o crédito do Firecrawl acabar, a
extração inteira para. Separada, ela teria seis provedores de fallback — dos
quais quatro são gratuitos.

## O que já está resolvido

**O desenho cabe sem esforço.** O `IaService.pedir('estruturada', …)` já aceita
exatamente esse pedido: instrução, schema, entrada. Seria passar o markdown como
`entrada` e reusar `INSTRUCAO` e `SCHEMA_VAGA` como estão.

**O SDK suporta.** Verificado em `firecrawl@4.32.2`: `formats: ['markdown']` é
um `FormatString` válido e `Document.markdown?: string` existe.

## O que falta, e por que não foi feito

**Duas perguntas decidem, e nenhuma se responde lendo código:**

### 1. O markdown preserva o que o schema exige?

`SCHEMA_VAGA` pede `salaryTrecho` e `elegibilidadeTrecho` como **texto exato da
página**, e o `busca.service.ts` valida o número contra o trecho
(`salarioConfere`). Isso existe porque o JOB-09 mediu o estrago de afirmar
salário sem citação.

Se o markdown com `onlyMainContent: true` perder a tabela de salário ou o bloco
de elegibilidade, **o defeito é silencioso**: a vaga aparece com `salaryMin:
null`, que é indistinguível de "a página não publicou salário". Ninguém percebe
até conferir vaga por vaga.

### 2. Quanto o `markdown` custa de fato contra o `json`?

"Mais barato" é a premissa do pedido, não um número medido. O `json` cobra pela
extração; o `markdown` pode cobrar menos, mas a diferença precisa ser um número
antes de virar justificativa.

### Por que não medi

Medir exige gastar créditos reais do Firecrawl com a chave cadastrada. A
tentativa de descriptografar a chave do banco para o teste foi bloqueada — e
**corretamente**: extrair segredo em claro para rodar um experimento não é uma
decisão que quem implementa toma sozinho.

## Como medir (é barato)

Duas páginas de vaga real, uma do Greenhouse e uma do Lever, com salário
publicado. Para cada uma, os dois caminhos lado a lado:

| | `json` (hoje) | `markdown` + cadeia |
| --- | --- | --- |
| Créditos gastos | | |
| Tempo | | |
| `title` / `company` | | |
| `salaryMin` / `salaryMax` | | |
| `salaryTrecho` **presente e exato** | | |
| `elegibilidadeTrecho` | | |
| `ehListagem` / `estaFechada` | | |

**O critério de decisão é a linha do `salaryTrecho`.** Se ela degradar, não
vale: um caminho que não funciona é pior que o custo atual.

## Critérios de aceite

- [ ] Medição das 2 páginas preenchida, com créditos e tempo reais
- [ ] `salaryTrecho` continua exato e citável no caminho novo
- [ ] Extração passa pela cadeia (6 provedores de fallback, 4 gratuitos)
- [ ] Custo por página medido, não estimado
- [ ] Se o markdown degradar: **card fechado como "não vale"**, com os números
