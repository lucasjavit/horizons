# JOB-39 · freehire.me como primeiro motor de busca

**Estado:** feito (26/08/2026)
**Tamanho:** M

> O título dizia "terceiro motor". **Virou o primeiro** durante a
> implementação, e a medição que virou a mesa está em "A ordem mudou" abaixo.

## De onde veio

Avaliação do repositório [madslorentzen/ai-job-search](https://github.com/madslorentzen/ai-job-search)
(MIT), pedida em 26/08. O repositório **não** se encaixa aqui — é um framework de
Claude Code para uso pessoal na máquina do candidato, sem servidor, sem
multiusuário, focado em gerar CV/carta em LaTeX para o mercado dinamarquês.
Arquitetura oposta à nossa.

Mas dentro dele há seis "portal skills", e **duas são agnósticas de país**. Uma
delas aponta para uma API que resolve exatamente o gargalo do nosso motor de ATS.

**A separação importa: `freehire.me` não é do autor do repositório.** É um
serviço de terceiro que ele apenas consome; o `freehire-search/` é um cliente,
não a fonte. O repositório é MIT e roda na nossa casa; a API é uma **dependência
externa gratuita, de dono desconhecido, sem contrato** — risco diferente, tratado
na seção "O risco real" abaixo.

**E os números desta seção não vieram do repositório.** Ele não publica volume
nenhum. Deu o ponteiro — a existência da API, os endpoints e os nomes dos
parâmetros. As medições abaixo são `curl` rodado em 26/08/2026 contra o serviço
ao vivo.

## O gargalo que isso resolve

O `busca-ats.service.ts` é o nosso melhor motor (27.725 vagas por R$ 0), mas tem
um teto conhecido e escrito no próprio arquivo:

> As APIs sao publicas e sem chave. O que elas NAO tem e busca global — nao
> existe `greenhouse.io/search?q=backend` (404, verificado). Por isso o
> catalogo de `empresas.json` e indispensavel: sem o slug, a API e inutil.

**Só encontramos vaga de empresa que já está no catálogo.** São 526 hoje. Empresa
fora dele é invisível, por melhor que a vaga seja. O JOB-37 tentou resolver isso
fazendo o catálogo aprender com a busca — e a medição registrada lá mostrou que a
hipótese era falsa.

## O que foi medido (26/08/2026)

`GET https://freehire.me/api/v1/jobs/search` — JSON, **sem chave**, sem cadastro.

| Consulta | Resultado |
| --- | --- |
| `countries=br` | **16.891 vagas** |
| `regions=latam` | **49.772 vagas** |
| `q=backend engineer&regions=latam&work_mode=remote&posted_within_days=7` | **201 vagas** |
| _(controle)_ sem filtro — catálogo inteiro | 1.358.282 vagas |
| _(controle)_ parâmetro inventado `paisinventado=xx` | 1.358.310, e `meta.ignored_params` acusa |

**O controle negativo era obrigatório**, e é o próprio serviço que avisa por quê:

> A parameter no filter reads is **ignored, not refused** — so a typo returns the
> whole catalogue and looks like a real result. The response says so in
> `meta.ignored_params`. Check it.

Um filtro com nome errado devolveria 1,3 milhão e **pareceria uma busca boa**. As
três consultas acima foram conferidas: `ignored_params` veio vazio nas três, então
os filtros foram de fato aplicados. **Qualquer implementação tem de checar esse
campo a cada chamada** — é a diferença entre 16 mil vagas do Brasil e o catálogo
mundial fingindo ser isso.

E o dado já vem **classificado**, que é o trabalho que hoje fazemos com IA:
`countries[]` (ISO-2), `regions[]` (`latam`, `eu`, `us`, `apac`, `cis`, `global`),
`work_mode`, `seniority`, `category`, `salary_min/max/currency`, `skills[]`
canônicos, `posted_at`, e a `url` **real do ATS** (não um agregador).

### O número que decide

Nas 100 primeiras vagas de `countries=br`: **63 empresas distintas, das quais 60
não estão no nosso catálogo.** Só `ciandt`, `clara` e `quintoandar` coincidem.

Isso é o oposto do achado do JOB-37: ali a busca não trazia empresa nova o
bastante para alimentar o catálogo; aqui **95% do que vem é novidade**.

As fontes por trás são os mesmos ATS que já sabemos ler — lever (24), greenhouse
(14), workday (9), ashby (5), workable, smartrecruiters, personio, comeet — mais
os brasileiros que **não** temos (**gupy 9, inhire 9, solides, whatjobs-br**).

## O que NÃO foi confirmado

- **`countries=br` não é "vaga para quem mora no Brasil".** Das 40 primeiras,
  **34 tinham Brasil no `location` cru** e **7 listavam mais de um país** (ex.:
  `['ar','br','co','gt','mx']`). O facet é *alcance de contratação*, não sede.
  Para a nossa promessa do JOB-09 (a vaga só afirma o que cita), o `location`
  cru continua sendo a fonte, e a `elegibilidade.ts` continua valendo.
- **Salário quase sempre vem `null`** nas amostras de LATAM. Não substitui o
  `salaryTrecho` do JOB-34.
- **Não sabemos a frescura nem a cobertura real** do índice fora da amostra.

## Por que usar a API, e não copiar o código

O `freehire-search/cli/src/helpers.ts` do repositório é TypeScript MIT e legível,
mas é um CLI com Bun: `process.stdout`, `writeError` em stderr, flags. **O que
vale copiar é o formato do envelope e o `toResult()`**, ~40 linhas de reshape —
não o CLI. Nosso lado é um `@Injectable()` do Nest.

O `robots.txt` do freehire é explícito e convida ao uso:

> Bots and agents: you do not have to scrape these pages. The whole catalogue is
> a public, unauthenticated JSON API, and it returns more than the HTML does.
> Please send a User-Agent naming your project.

Há `openapi.yaml`, `llms.txt` e MCP publicados. **Mandar `User-Agent: horizons`
é parte do trato, não detalhe.**

Os termos proíbem só o contrário do que fazemos: *"no scraping beyond our
documented API, no attempting to bypass rate limits or authentication"*. Não há
cláusula não-comercial, e o projeto é MIT
([strelov1/freehire](https://github.com/strelov1/freehire)).

## O outro achado: `linkedin-search`

A mesma pasta tem um scraper dos endpoints públicos `jobs-guest` do LinkedIn, sem
autenticação, com paginação e backoff. Funciona, mas o próprio `url-reference.md`
avisa: *"automated access is against LinkedIn's Terms of Service"*. Serviço
multiusuário em produção não é "uso pessoal, volume baixo". **Fica registrado
como visto e descartado**, para não ser reavaliado do zero daqui a dois meses.

## O risco real: é dependência de terceiro, não código nosso

O que o serviço diz de si (`llms.txt`, lido em 26/08): agregador de vagas de TI,
grátis e open-source, **3,2 milhões de vagas de mais de 300 mil empresas**. Rastreia
os career boards direto e normaliza num schema só.

O que isso significa para nós, e que o número bonito esconde:

- **Não temos contrato.** Grátis, sem chave, sem SLA. Pode fechar, passar a cobrar
  ou mudar o schema sem aviso. Por isso o interruptor não é opcional, e por isso
  o ATS continua logo atrás.
- **Limite publicado:** 600 req/min nas leituras comuns, 300/min no
  `/agent/jobs/search`. Cada resposta traz `X-RateLimit-Remaining` — a regra deles
  é ler esse header e se conter, em vez de esperar o 429.
- **Herdamos a classificação de outra pessoa.** `countries[]` e `regions[]` são o
  julgamento *deles* sobre alcance de contratação, feito por um pipeline que não
  vemos. Entra como sinal, nunca como resposta — ver a ressalva do `countries=br`.
- **`/api/v1/jobs/facets` antes de filtrar.** É de lá que saem os valores canônicos
  (skill, país, enum). Inventar valor cai naquela armadilha do `ignored_params`.

## A ordem mudou: ele entrou na frente do ATS

O plano era entrar como fallback, depois do ATS — a intuição era que ler a fonte
primária com catálogo nosso valia mais que um agregador de terceiro.

**A medição desmentiu.** Mesma consulta, um motor de cada vez, medido em
26/08/2026 com os dois containers de pé:

| Consulta | ATS | freehire |
| --- | ---: | ---: |
| `backend engineer`, LATAM | **1** | **60** |
| `data engineer`, LATAM | 15 | 60 |
| `react developer`, LATAM | 15 | 60 |

E o tempo, que não estava na conta e decidiu junto:

| Motor | Tempo da mesma busca |
| --- | ---: |
| ATS | **128.366 ms** |
| freehire | **2.567 ms** |

**50× mais rápido e 4× mais vagas.** O ATS consulta 200 boards um a um; o
freehire já rastreou todos e responde uma consulta só.

Como os dois custam R$ 0, não havia desempate por custo — e o critério que
sobra é a vaga que chega na tela. A cascata ficou:

```
freehire (R$ 0, 2,6s)  →  ATS (R$ 0, 128s)  →  Firecrawl (5 créditos/pág) ou IA (US$ 0,04)
```

O ATS **não** foi rebaixado por ser pior: ele lê a fonte primária com dado que
controlamos, e é ele quem assume no dia em que o freehire sumir. Ficar em
segundo é o que o torna a rede de segurança.

## Como implementar

Motor ao lado do Firecrawl, da IA e do ATS — **e com interruptor próprio**, como
manda a regra da casa. Sem chave para configurar; o interruptor existe para
quando a fonte cair ou piorar.

1. `busca-freehire.service.ts`, espelhando a forma do `busca-ats.service.ts`
2. Reshape do job do freehire para o nosso `VagaDto` (o `toResult()` é o mapa)
3. `elegibilidade.ts` roda por cima do `location` cru, **como já roda hoje** —
   o `countries[]` entra como sinal, nunca como resposta
4. Dedup contra o que os outros motores trazem (mesma `url` de ATS)
5. Interruptor em `/config/vagas`, ao lado do Firecrawl
6. Backoff em 429/5xx; falha de conexão degrada rápido em vez de pendurar a busca

## Critérios de aceite

- [x] Uma busca com o motor ligado devolve vaga que o motor de ATS **não** acha
      — 60 contra 1 na mesma consulta
- [x] `User-Agent` identifica o projeto, conforme o `robots.txt` pede
      (`horizons/jobs (+…)`)
- [x] O motor desligado não derruba a busca — verificado com o interruptor
      desligado (ATS entregou 15) **e** com a API fora do ar (`FREEHIRE_API_URL`
      apontada para host morto: avisou, caiu em ~1s, o ATS assumiu, e a IA
      respondeu depois)
- [x] Vaga vinda do freehire não afirma elegibilidade que a página não cita —
      `countries[]` deles é ignorado; quem decide é `lerElegibilidade` sobre o
      `location` cru, e o trecho exibido é esse campo
- [x] **`meta.ignored_params` é checado a cada chamada** e vira `warn` no log
- [x] `X-RateLimit-Remaining` é lido; avisa quando restam menos de 20
- [ ] Dedup medido: quantas vagas os motores repetem entre si — **não medido.**
      A cascata para no primeiro motor que acha algo, então hoje os dois nunca
      rodam na mesma busca e não há sobreposição para medir. Só passa a valer se
      um dia os motores forem unidos em vez de encadeados
- [ ] As 60 empresas novas da amostra viram entrada no catálogo — **não feito**,
      e continua valendo a pena. Virou o [JOB-40](JOB-40-catalogo-aprende-com-o-freehire.md)

## O que foi entregue

| Arquivo | O quê |
| --- | --- |
| `backend/src/jobs/busca-freehire.service.ts` | o motor, novo |
| `backend/src/jobs/busca.service.ts` | o motor entra na cascata, em primeiro |
| `backend/src/jobs/jobs.module.ts` | registro do provider |
| `backend/src/settings/recursos.service.ts` | flag `jobs.freehire`, default ligado |
| `backend/src/settings/recursos.controller.ts` | `PUT /settings/recursos/freehire` |
| `frontend/src/types/api.ts` | espelho do DTO |
| `frontend/src/lib/api.ts` | `definirFreehire` |
| `frontend/src/pages/ConfigVagasPage.tsx` | interruptor, primeiro da lista |
| `frontend/src/components/vagas/LinhaVaga.tsx` | nota da decisão de não exibir a fonte |
| `docker-compose.yml`, `.env.example` | `FREEHIRE_API_URL` documentada |

**Sem migration**: a flag usa a `AppSetting` que já existe, e ausência de linha
significa ligado — como o ATS e o histórico.

## O que o QA achou, e o que virou decisão

Um QA adversarial rodou a tela em 26/08 e trouxe três coisas. Duas eram minhas
e foram corrigidas; a terceira virou decisão de produto.

**A fonte não é exibida — e é deliberado.** O QA reportou como bug grave que o
campo `fonte` chegava preenchido ao frontend e nenhum componente o mostrava. Era
verdade. A exibição chegou a ser implementada, e a decisão do stakeholder foi
**não mostrar**: quem lê julga a vaga pelo que ela diz, não pelo domínio por onde
chegou. O campo continua no `VagaDto` e no log — o que se decidiu foi não
exibi-lo, e há nota em `LinhaVaga.tsx` para o próximo QA não reabrir.

**Vaga de agregador entra.** O QA mediu que 36 das 60 vagas vinham por
`whatjobs.com`, um agregador, e não pelo board da empresa — contra o que o
comentário do código prometia. Medido antes de decidir:

| | whatjobs (36) | ATS direto (24) |
| --- | --- | --- |
| com skills | 36/36 | 24/24 |
| com local | 36/36 | 24/24 |
| com elegibilidade | 36/36 | 22/24 |
| links testados | **4 de 5 abrem (200)** | **1 de 4 deu 404** |

O controle é o que decidiu: **link ruim não é privilégio de agregador**. Entre
quatro links de ATS "direto", um deu 403 (anti-bot, ver
[JOB-12](JOB-12-url-de-vaga-nao-se-valida-por-status.md)) e outro deu **404** —
vaga morta no Lever. Filtrar por origem cortaria 60% do resultado por uma regra
que nem separa o que promete. Decisão: **mantém**.

**Comentários descreviam a ordem antiga.** O QA notou que `recursos.service.ts`
e `types/api.ts` ainda diziam "fallback do ATS" depois de o motor ter virado o
primeiro. Corrigido.

**Um achado que fica aberto, sem correção:** 1 vaga em 60 chega com o nome da
empresa corrompido (`Syngenta Prote??o de Cultivos Ltda.`), sempre vinda do
whatjobs. O mojibake vem da origem — não é bug nosso, e "consertar" acento por
heurística estragaria nome legítimo. Registrado aqui em vez de mascarado.

**Um achado pré-existente, fora do escopo:** o alvo de toque dos interruptores
mede 20×20px, abaixo dos ≥24px que o CLAUDE.md exige. Vale para os cinco
interruptores da página, não só o novo — é do componente compartilhado
`Interruptor.tsx:51` (`h-5 w-5`). O `<label>` em volta amplia a área clicável na
prática. **Não corrigido aqui** porque mexeria em toda a tela de Configurações,
que este card não tinha mandato para alterar.

## Duas decisões que o código carrega

**O salário vem sem trecho, então quase não vem.** O freehire entrega
`salary_min/max` como campo estruturado, sem a frase do anúncio de onde saiu. O
JOB-09 exige o trecho, e o JOB-34 flagrou exatamente isso no Firecrawl —
paráfrase apresentada como citação. Decisão: `salaryTrecho: null` sempre, e o
valor só passa **se houver moeda** (número sem moeda na tela é pior que "not
stated": 90.000 pode ser BRL ou USD). Na prática, em LATAM a faixa vem quase
sempre nula.

**A `fonte` guarda o host real, e nunca "freehire.me".** Seja o board da empresa
(`jobs.lever.co`) ou um agregador (`br.whatjobs.com`), o campo diz de onde a
vaga veio de fato — o agregador do meio não é apagado. Não é exibido na tela
(ver acima), mas é o que o log mostra a quem depura.

## Relacionados

- [JOB-20](JOB-20-motor-de-ats.md) — o motor que isto complementa
- [JOB-40](JOB-40-catalogo-aprende-com-o-freehire.md) — transformar o dado emprestado em catálogo nosso
- [JOB-37](JOB-37-catalogo-aprende-sozinho.md) — a tentativa anterior de crescer o catálogo
- [JOB-21](JOB-21-elegibilidade-por-campo.md) — a regra que continua valendo
- [JOB-34](JOB-34-extracao-de-vaga-fora-do-firecrawl.md) — o salário continua vindo de lá
- [JOB-12](JOB-12-url-de-vaga-nao-se-valida-por-status.md) — por que 403 não significa vaga morta
