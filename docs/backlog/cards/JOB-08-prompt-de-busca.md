# JOB-08 · O prompt do stakeholder vira o motor da busca

**Estado:** pronto para fazer
**Tamanho:** G
**Origem:** *"vai ter duas buscas, com o firecrawl e tb com o prompt que eu tinha te passado que vai usar a ia para fazer a busca"* (15/08/2026)

## O que existe hoje, e é pouco

O prompt do stakeholder tem ~126 linhas. **O que roda em produção são 12** —
a `INSTRUCAO` em `busca.service.ts:41-52`. Cerca de **6%**.

Nunca foram implementados: o motor de matching, a taxonomia remota de sete
níveis, a validação de vaga fechada, a dedup e a prioridade de URL oficial.

O texto original está guardado em
[`docs/design/prompt-busca-original.md`](../../design/prompt-busca-original.md) —
ele só existia no chat.

## O que dois agentes acharam, e eu verifiquei no código

### O ataque inverteu: **vagas boas estão sendo descartadas**

O QA rodou a busca de verdade (~34 créditos, páginas reais). Eu esperava
alucinação; o que acontece é o oposto.

**Easyship — vaga aberta, salário `$50,000-$75,000`, 13 skills extraídas
corretamente — voltou `ehVaga: false` e foi jogada fora.** Três de três páginas
hospedadas no Getro morreram assim: o modelo classifica **o site que hospeda**
("Search job openings across the network"), não a vaga.

Isso atinge exatamente Greenhouse, Lever e Ashby — as fontes que o prompt manda
preferir.

### Uma listagem virou vaga inventada, diferente a cada rodada

`weworkremotely.com/remote-jobs` voltou `ehVaga: true` **duas vezes com empresas
diferentes** ("Remote Talent Cloud", depois "Braze"), com `elegivelBrasil:
false` e `elegibilidadeTrecho: null` — afirmação sobre elegibilidade **sem
evidência** — e `salaryTrecho: "Anywhere in the World"`, texto de elegibilidade
dentro do campo de origem do salário.

O schema de objeto único **força uma vaga a sair de N**: `required` vence
`ehVaga: false`.

### Três coisas que o código promete e não faz

| O comentário diz | O código faz |
| --- | --- |
| "Vaga sem título, empresa ou **URL** não entra" (cita os 47% do JOB-01) | `if (!titulo || !empresa)` — **não testa URL** |
| `salaryTrecho` guarda o texto de origem | **Não é renderizado** em `LinhaVaga.tsx` — não chega à pessoa |
| `posted_within_days` é um filtro | `postedAt: null` fixo (`busca.service.ts:169`) — não pode funcionar |

Vaga fechada não tem campo nem regra: `grep -ci "closed|no longer"` → **0**.

## O padrão que decide o desenho

> **As regras que sobreviveram foram as que viraram campo de schema ou
> validação de faixa. As que ficaram como prosa — "never invent…" — são
> exatamente as que falharam.**

O que não vira estrutura não se sustenta. Isso vale mais que qualquer item da
lista, e é o critério para adaptar o prompt: **cada regra crítica precisa virar
um campo, uma enum ou uma validação em código** — ou aceitar que é decorativa.

Foi assim que as defesas que funcionaram funcionaram: `null` autorizado no
schema, faixa de plausibilidade do salário, lista fechada de ISO.

## As duas perguntas do stakeholder, respondidas

### "Vale a pena ter o score?"

**Não como número na tela. Sim como critério interno.**

Ele disse que **não necessariamente vai ter um CV**. Sem currículo, 55 dos 100
pontos do modelo (skill 35 + role 20) comparam a vaga com um candidato que não
existe. Sobram 45 pontos de senioridade, localização, salário e frescor — que
são propriedades **da vaga**, não da adequação a alguém.

Um "72" calculado assim parece medição e não é. E ninguém pergunta "72 sobre o
quê?" — a pessoa confia.

**A IA usa os critérios para decidir o que trazer e o que descartar**; a vaga
fraca não aparece, em vez de aparecer com um número ao lado. Mesma inteligência,
sem a falsa precisão.

Se um dia houver CV e fizer sentido ordenar por aderência, o score ganha base
real — e aí entra como **rótulo** ("Strong match"), nunca como número.

### "Qual o melhor, na sua visão e no mercado?" (elegibilidade)

**Os sete níveis, com folga.** É onde o `true/false/null` de hoje joga fora
informação real:

| A vaga diz | Hoje vira | Deveria ser |
| --- | --- | --- |
| "Remote — worldwide" | `true` | **Worldwide** |
| "Remote — LATAM" | `true` | **LATAM** |
| "Remote — US only" | `false` | **US only** |
| "Remote" (sem dizer) | `null` | **Unknown** |

As duas primeiras são a mesma coisa para o booleano e decisões diferentes para
quem procura. E a última linha é a mais importante: **"não disse" não é "não
aceita"** — hoje as duas levam ao mesmo descarte, e a pessoa perde vaga boa.

É o dado que o JOB-04 chama de "o mais valioso da tela": a pergunta que mata 70%
das vagas e quase nenhum site responde na listagem.

## O que fazer, em ordem

**1. Consertar o que está quebrado antes de acrescentar** — não adianta prompt
melhor num pipeline que descarta vaga boa:

- [ ] `ehVaga` deixa de decidir sozinho o descarte: hoje um falso negativo mata
      uma vaga aberta e completa
- [ ] Página de listagem tratada como listagem — o schema de objeto único força
      uma vaga a sair de N
- [ ] Campo e regra de **vaga fechada**
- [ ] A checagem de URL que o comentário promete
- [ ] `postedAt` extraído de verdade, ou `posted_within_days` sai da tela
- [ ] `salaryTrecho` e `elegibilidadeTrecho` **renderizados** — sem isso o
      mecanismo de verificação do JOB-01 não existe para quem usa

**2. Transportar o prompt, em duas etapas** (~75% dele encaixa):

- [ ] `PROMPT_PLANEJAMENTO` — expansão de títulos e variações geográficas
- [ ] `PROMPT_EXTRACAO` — 13 das 17 regras críticas; as outras 4 viram mecanismo
- [ ] Sete níveis de elegibilidade + `verification_status`, como **colunas**
      com default conservador (`unknown`, `unverified`)

**3. O que fica sem dono e precisa de card próprio:**

- [ ] **Dedup** — nenhum dos prompts vê o conjunto, e o backend só dedupa por
      URL exata. A mesma vaga no Greenhouse e no LinkedIn aparece duas vezes.

## Custo e latência

~59s contra teto de 60s — **empate técnico, não folga**. E ~$0,47 de IA por
busca, mais caro que o próprio Firecrawl.

**Correção de uma afirmação minha:** eu disse ao stakeholder que eram "duas
chamadas de IA". São **1 + N** — uma de planejamento e uma extração por página
(`busca.service.ts:119`). O custo cresce com o número de páginas.

Corte recomendado: 15 → 8 páginas. O rate limit quebra o paralelismo antes de o
relógio estourar.

## O que NÃO foi medido

- A injeção de prompt está documentada como buraco, **não como falha
  observada** — o QA não publicou página de ataque, e Firecrawl não alcança
  localhost.
- Dos quatro números da estimativa de latência, **só dois são medidos**
  (`search` 12s, `scrape` 36s, do JOB-01). Os outros são estimativa.
