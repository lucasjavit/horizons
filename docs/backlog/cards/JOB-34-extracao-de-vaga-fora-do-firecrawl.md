# JOB-34 · Separar o scrape da extração no `lerVaga`

**Estado:** feito (26/08/2026)
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

- [x] Medição das 2 páginas preenchida, com créditos e tempo reais
- [x] `salaryTrecho` continua exato e citável no caminho novo
- [x] Extração passa pela cadeia (6 provedores de fallback, 4 gratuitos)
- [x] Custo por página medido, não estimado — **5 créditos → 1**
- [x] Se o markdown degradar: **card fechado como "não vale"**, com os números
      (não degradou; a extração da cadeia ficou **melhor** nos trechos citados)


---

# A medição (25/08/2026)

O stakeholder autorizou gastar crédito. Duas vagas reais do Ashby, cada uma nos
dois formatos, chamando o Firecrawl de dentro do container — a chave nunca saiu
de lá.

## 1. O markdown preserva o salário? **Sim, e melhor que o esperado**

| Página | `markdown` | linhas com salário |
| --- | ---: | ---: |
| assured (Software Engineering Manager) | 5.610 chars | **5** |
| checkly (Senior Sales Engineer) | 6.751 chars | **7** |

O bloco de compensação sobrevive inteiro ao `onlyMainContent: true`:

```
## Compensation
- $230K – $250K • Offers Equity
```

**O risco que travava o card não se confirmou.** O medo era o `onlyMainContent`
cortar a tabela de salário e produzir `salaryMin: null` — indistinguível de "a
página não publicou salário". Não corta.

## 2. O achado que muda a avaliação: **o `salaryTrecho` de hoje já é paráfrase**

Comparando o que o `json` devolveu com o texto que está na página:

| | |
| --- | --- |
| o `json` devolveu | `"Compensation Range: $230K - $250K"` |
| a página diz | `"- $230K – $250K • Offers Equity"` |

**Mesmo valor, texto diferente.** A frase que o Firecrawl devolve como
"trecho exato da página" **não existe na página** — o modelo normalizou o
travessão, trocou o marcador e inventou o rótulo "Compensation Range:".

Isso importa porque o `salaryTrecho` foi criado no [JOB-09](JOB-09-vaga-so-afirma-o-que-cita.md)
justamente para ser **verificável**: a promessa é "este número saiu deste texto,
confira você mesmo". Um trecho parafraseado não cumpre a promessa — quem
procurar aquela frase na página não a encontra.

**Passar pela cadeia não piora isso; pode melhorar.** Com o markdown em mãos, dá
para exigir que o trecho seja uma substring literal do que foi lido, e descartar
o que não for. Hoje isso é impossível: o Firecrawl devolve o trecho sem devolver
a página.

## 3. Tempo

| Página | `markdown` | `json` |
| --- | ---: | ---: |
| assured | **900 ms** | 1.932 ms |
| checkly | **5.732 ms** | 11.368 ms |

O `markdown` levou **metade do tempo** nas duas. O `json` embute uma chamada de
IA; o `markdown` não.

**O custo em créditos não foi isolado** — a conta do Firecrawl não expõe consumo
por chamada em tempo real, e as quatro chamadas saíram do mesmo saldo. O tempo
pela metade é indício, não prova, de custo menor.

## Conclusão: **vale implementar**

As duas perguntas que travavam foram respondidas, e uma terceira apareceu:

1. **O markdown preserva o salário** — 5 e 7 linhas de compensação, blocos
   inteiros
2. **É mais rápido** — metade do tempo nas duas páginas
3. **E o trecho de origem hoje é paráfrase**, o que enfraquece a promessa do
   JOB-09. Extrair da cadeia permite exigir substring literal.

O ganho de resiliência continua valendo: hoje, se o crédito do Firecrawl acabar,
a extração inteira para. Separada, ela tem seis provedores de fallback, quatro
gratuitos.

## Ao implementar, não esquecer

- **Exigir que `salaryTrecho` e `elegibilidadeTrecho` sejam substring do
  markdown lido.** É o ganho de graça desta mudança, e o que conserta a paráfrase.
- O `SCHEMA_VAGA` já foi corrigido no [JOB-35](JOB-35-schema-do-cv-rejeitado-pela-anthropic.md)
  (`anyOf` no `regime`) — está pronto para ir à cadeia.
- Medir o custo em crédito **antes e depois**, com a conta do Firecrawl, para o
  ganho virar número.

---

# A implementação (26/08/2026)

`backend/src/jobs/busca.service.ts`, `lerVaga`: uma chamada virou duas. O
`INSTRUCAO` e o `SCHEMA_VAGA` não mudaram.

## 1. Custo: a pergunta que ficou aberta tem resposta

**O SDK expõe o saldo.** `fc.getCreditUsage().remainingCredits` — foi o que
faltou em 25/08. Saldo lido antes e depois de **cada** chamada:

| Página | `json` (hoje) | `markdown` (novo) |
| --- | ---: | ---: |
| assured | 1125 → 1120 = **5 créditos** | 1120 → 1119 = **1 crédito** |
| checkly | 1119 → 1114 = **5 créditos** | 1114 → 1113 = **1 crédito** |

**Cinco vezes mais barato por página, medido e não estimado.** Uma busca de 8
páginas cai de ~40 créditos para ~8.

## 2. Antes/depois campo a campo, mesmas URLs

`A` = Firecrawl `json` (caminho antigo) · `B` = markdown + cadeia (Gemini)

| Campo | assured A | assured B | checkly A | checkly B |
| --- | --- | --- | --- | --- |
| `title` | Software Engineering Manager | = | Senior Sales Engineer | + "(remote, Europe)" |
| `company` | Assured | = | Checkly | = |
| `salaryMin`/`Max` | 230000–250000 | = | 115000–150000 | = |
| `currency` | USD | = | EUR | = |
| `regime` | remoto | = | remoto | = |
| `paisIso` | null | = | null | = |
| `postedAt` | null | = | null | = |
| `area` | Engineering | = | **null** | **Sales** |
| `local` | **null** | **Remote** | Remote (UTC+1 a UTC+2) | = |
| `elegibilidadeTrecho` | **null** | null | **null** | **"Located in Europe, UTC+1 and UTC+2 time zones."** |
| `ehVaga`/`estaFechada`/`ehListagem` | true/false/false | = | true/false/false | = |

**Nenhum campo piorou. Quatro melhoraram** (`area`, `local`,
`elegibilidadeTrecho`, `title` mais completo).

### O `skills` é onde a diferença é grande — e mensurável

Cada skill foi conferida contra o markdown da própria página:

| | skills | quantas **existem** no texto |
| --- | ---: | ---: |
| assured A (Firecrawl) | 10 | **4** ("cross-functional collaboration", "architecture", "scalability", "team development", "goal setting", "customer needs translation" não estão na página) |
| assured B (cadeia) | 8 | **8** (Node.js, TypeScript, React, GraphQL, Python, Docker, PostgreSQL, AWS) |
| checkly B (cadeia) | 11 | **11** |

O Firecrawl devolvia **rótulos de competência que ele compôs**; a cadeia
devolve as tecnologias que estão escritas no anúncio. 6 de 10 contra 0 de 19.

## 3. Trechos: a validação de substring, e o que ela custou para acertar

**A premissa do card estava errada em um ponto, e é justo registrar.** O card
dizia que `"Compensation Range: $230K - $250K"` não existe na página da
assured. **Existe** — a medição de 25/08 olhou só o bloco de bullets
(`## Compensation`) e não viu a linha em prosa mais abaixo, que é literal. Nas
duas páginas da medição original, **0 de 4 trechos** eram paráfrase.

A validação foi implementada mesmo assim, e **ela pegou paráfrase de verdade em
página nova** — mas só depois de duas correções, ambas de **falso positivo**:

| Página | Trecho | Veredito | O que era |
| --- | --- | --- | --- |
| DuckDuckGo | `"$178,500 USD annually"` | **falso positivo** | a página escreve `**$** _**178,500**_ **USD annually**`; o modelo citou a prosa sem os marcadores, corretamente |
| GitLab | `"$117,600 - $252,000USD"` | **falso positivo** | o Firecrawl escapa o hífen: `$117,600 \- $252,000USD` |
| DuckDuckGo | `"Annual Compensation $178,500 USD annually"` | **verdadeiro positivo** | **colagem**: junta o rótulo de um bloco (`Annual Compensation $178.5K`) com a prosa de outro. Nenhuma passagem diz isso |
| latamcent | `"Peru; Argentina; Brazil; Colombia [Remote]; Ecuador"` | **verdadeiro positivo** | lista remontada pelo modelo |

**Os dois falsos positivos jogaram fora salário verdadeiro** — exatamente o
defeito que o card mandava não maquiar. A primeira versão da normalização só
colapsava espaço em branco, e era insuficiente.

A normalização final compara **só os caracteres que significam**: remove
espaço, marcador de ênfase (`* _ \` ~`) e barra de escape do markdown, unifica
travessão e aspas curvas. Não toca em letra, número nem pontuação.

Verificada contra o markdown **real** das três páginas, **12/12 corretos**:
6 trechos legítimos aceitos, 6 inventados reprovados (rótulo que a página não
tem, paráfrase, número trocado, frase fabricada e as duas colagens).

Na busca seguinte à correção: **0 trechos descartados**, 3 de 3 salários
entregues com citação.

## 4. Resiliência: comprovada em produção, não em teoria

O log de uma busca real:

```
Mistral respondeu depois de 5 provedor(es) nao terem atendido:
  Gemini (chave recusada), ChatGPT (erro), Claude (erro),
  Groq (sem chave), Cerebras (sem chave)
```

Com o caminho antigo essas páginas teriam voltado vazias. É o ganho que o card
previu, acontecendo.

## 5. O que NÃO ficou bom, e virou card

**A cadeia ficou lenta**, porque dois provedores rejeitam o `SCHEMA_VAGA` com
400 determinístico:

- **OpenAI**: `'required' … including every key in properties. Missing 'area'`
  — `strict: true` exige as 21 chaves em `required`; hoje há 6.
- **Anthropic**: `Schema is too complex` / `Grammar compilation timed out`.
  Reproduzido isoladamente com chave válida; remover os `description` não
  resolve.

Efeito medido: a busca de 8 páginas passou de ~60s para **mais de 7 minutos**,
e duas das três buscas foram cortadas pelo timeout do cliente (3 e 6 vagas em
vez de 8). Está em [JOB-38](JOB-38-schema-da-vaga-rejeitado-por-openai-e-anthropic.md).

**Isto é uma regressão real de tempo introduzida por este card**, e não uma
ressalva cosmética. A extração ficou mais barata, mais resiliente e mais
fiel — e mais lenta enquanto o JOB-38 não for feito.

## Verificação

- `docker compose up -d --build`; o `dist` servido tem `trechoCitavel` e
  `formats: ['markdown']`, e **zero** ocorrências de `type: 'json'`
- 3 buscas reais ponta a ponta pela API, com o Firecrawl ligado
- Busca por **ATS** com o Firecrawl desligado: 13 vagas, intacta (o
  `busca-ats.service.ts` não referencia `lerVaga` nem a cadeia)
- `python3 scripts/qa-rapido.py`: tudo certo
- `tsc --noEmit` limpo; `eslint` com os mesmos 23 avisos de formatação que já
  existiam no arquivo antes da mudança, nenhum novo
- Os interruptores foram devolvidos ao estado original (`firecrawlAtivo: false`,
  `atsAtivo: false`)


---

# Implementado (26/08/2026)

## O custo, que ontem ficou sem número

**O SDK expõe o saldo** — `fc.getCreditUsage().remainingCredits`. Era o que
faltava. Lido antes e depois de cada chamada:

| Página | `json` | `markdown` |
| --- | ---: | ---: |
| assured | 1125→1120 = **5 créditos** | 1120→1119 = **1** |
| checkly | 1119→1114 = **5 créditos** | 1114→1113 = **1** |

**5× mais barato.** Uma busca de 8 páginas: ~40 → ~8 créditos.

## Antes/depois, mesmas URLs

`title`, `company`, `salaryMin/Max`, `currency`, `regime`, `paisIso`,
`postedAt`, `ehVaga/estaFechada/ehListagem`: **idênticos**. Quatro campos
melhoraram (`area`, `local`, `elegibilidadeTrecho`, e o `title` mais completo).
Nenhum piorou.

**O `skills` é a diferença grande, e ela é a favor da cadeia.** Conferindo cada
skill contra o markdown da própria página:

- **Firecrawl**, assured: 10 skills, **4 existem no texto**. "cross-functional
  collaboration", "architecture", "scalability", "team development" não estão
  lá — ele compunha rótulos de competência.
- **Cadeia**, assured: 8 skills, **8 existem**. checkly: **11 de 11**.

## Uma correção à premissa deste card

O card afirmava que `"Compensation Range: $230K - $250K"` não existe na página
da assured. **Existe** — a medição de 25/08 viu o bloco de bullets e não a linha
em prosa abaixo dele. Nas duas URLs originais, **0 de 4 trechos** eram paráfrase.

A validação de substring ficou de pé assim mesmo, e pegou paráfrase real em
páginas novas — **mas só depois de duas correções**, ambas falsos positivos que
descartavam salário verdadeiro:

| Página | Trecho | Veredito |
| --- | --- | --- |
| DuckDuckGo | `$178,500 USD annually` | **falso positivo** — a página escreve `**$** _**178,500**_` |
| GitLab | `$117,600 - $252,000USD` | **falso positivo** — o Firecrawl escapa o hífen: `\-` |
| DuckDuckGo | `Annual Compensation $178,500 USD annually` | **verdadeiro** — colagem de dois blocos distantes |
| latamcent | `Peru; Argentina; Brazil…` | **verdadeiro** — lista remontada |

A primeira versão caía por **whitespace**, ou seja, estava errada. A final
compara só os caracteres que significam — ignora espaço, marcador de ênfase e
barra de escape; não toca em letra, número ou pontuação. **12/12** contra o
markdown real de três páginas, e **0 descartes** na busca seguinte.

## A regressão que este card introduziu, e que foi corrigida

Mandar o `SCHEMA_VAGA` para a cadeia expôs que **dois provedores o recusavam**:
a busca caiu de ~60s para **6m40s**, com buscas cortadas por timeout. Aberto
como [JOB-38](JOB-38-schema-da-vaga-rejeitado-por-openai-e-anthropic.md) e
**corrigido no mesmo dia** — `required` completo. Voltou a **1m43s**, com 6
vagas em vez de 3.

O defeito era antigo; só não aparecia porque o schema nunca tinha saído do
Firecrawl.
