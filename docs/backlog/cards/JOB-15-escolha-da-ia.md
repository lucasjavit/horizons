# JOB-15 · Escolher a IA da busca em Configurações

**Estado:** feito (18/08/2026)
**Tamanho:** M

## Por quê

Depois do [JOB-14](JOB-14-interruptor-do-firecrawl.md), desligar o Firecrawl
levava a uma tela vazia — o motor de IA só falava com a Anthropic, e a única
chave de IA cadastrada era da **OpenAI**. O stakeholder viu o sintoma certo:
*"sem ativar firecrawl não está aparecendo nada, sendo que se eu pegar o prompt
isso vai me retornar mais"*.

Estava certo. O prompt retornava mais; faltava o motor conseguir rodá-lo.

## A decisão

Um seletor em Configurações: **qual IA faz a busca**. E, por pedido explícito,
**preferência e não exigência** — *"se não tiver uma vai ser buscada pela
outra"*.

| Preferida | Tem chave? | Roda |
| --- | --- | --- |
| Claude | sim | Claude |
| Claude | não, mas OpenAI sim | **OpenAI** |
| ChatGPT | sim | OpenAI |
| nenhuma das duas | — | erro dizendo o que cadastrar |

Escolher a que ainda não tem chave é legítimo: a pessoa diz qual quer usar
quando cadastrar, e até lá a outra atende. A tela mostra qual está valendo, para
a divergência não virar surpresa.

## O resultado, medido

Mesma busca (Backend Engineer, remoto, LATAM), 18/08:

| | Firecrawl | IA (OpenAI) |
| --- | --- | --- |
| Vagas | 7 | **15** |
| Com elegibilidade citada | 0 | **15** |
| Fora do alvo | 2 (Business Development) | 0 |

Empresas: Zapier, Hopper, RevenueCat, Resend, Remote, Swile, Oscilar, LatamCent.
**As 15 aceitam candidato no Brasil, com o trecho que prova.**

O Firecrawl entra mais fundo (salário em 5 de 8); a IA cobre muito mais
anúncios e acerta a elegibilidade, que é a pergunta que este produto existe para
responder. Salário caiu para 4 de 15 — é a contrapartida real.

## Como ficou

- `busca-ia.comum.ts` — instrução, schema e normalização compartilhados. Os dois
  provedores pedem a mesma coisa e precisam das mesmas defesas; duplicar seria
  garantir que uma cópia fica para trás.
- `busca-ia.service.ts` — os dois caminhos. Anthropic: `messages.create` +
  `output_config`. OpenAI: `responses.create` + `text.format`, e o texto sai em
  `output_text`.
- `escolherIa()` em `recursos.service.ts` — a regra do fallback, isolada e
  testável.

## Duas diferenças de API que custaram um ciclo

**A OpenAI exige `additionalProperties: false`** em todo objeto do schema —
400 sem isso (`'additionalProperties' is required to be supplied and to be
false`). A Anthropic aceita os dois jeitos. Fechar o objeto serve aos dois e
ainda evita campo extra inventado.

**A tool é `web_search` nos dois**, mas em endpoints diferentes. A doc da OpenAI
não cobre combinar `web_search` com `json_schema`; funciona, e está medido aqui.

## Critérios de aceite

- [x] O seletor aparece em Configurações
- [x] A escolha persiste (`jobs.iaDaBusca` em `app_settings`)
- [x] Sem chave da preferida, a outra é usada — e a tela diz isso
- [x] Sem nenhuma das duas, a mensagem diz o que cadastrar
- [x] Busca real pela IA devolve vagas (15, com elegibilidade citada)

## O que continua aberto

**O caminho da Anthropic não foi executado** — não há chave dela nesta máquina.
O código é simétrico e compila, mas só o caminho da OpenAI rodou de verdade.
