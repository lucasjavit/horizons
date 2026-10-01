# JOB-40 · O catálogo aprende com o freehire

**Estado:** feito (01/10/2026)
**Tamanho:** M

## Por quê

O [JOB-39](JOB-39-freehire-como-motor-de-busca.md) ligou o freehire e ele virou
o primeiro motor da busca. Resolveu o problema de hoje e **criou um de amanhã**:
a melhor fonte de vagas do produto agora é o servidor de outra pessoa, de graça,
sem contrato.

O card do JOB-38 registra o risco e o interruptor. O que ele **não** resolve é
o que fica se o freehire fechar: nada. Volta tudo ao catálogo de 526 empresas.

## A oportunidade que a medição mostrou

Na amostra de 26/08, nas 100 primeiras vagas de `countries=br`: **63 empresas
distintas, e 60 fora do nosso `empresas.json`.** Só `ciandt`, `clara` e
`quintoandar` coincidiam.

E as fontes por trás são ATS que já sabemos ler — lever, greenhouse, workable,
ashby, comeet, smartrecruiters, personio — mais os brasileiros que não temos:
**gupy, inhire, solides**.

Ou seja: o freehire não é só um motor de busca. É um **descobridor de
empresas**, e a descoberta é a parte que pode virar nossa para sempre.

## O que fazer

Toda vaga que o freehire devolve carrega `company_slug` e a `url` do ATS real.
Dá para extrair dali o par (ATS, slug) e conferir contra o catálogo:

1. Da `url` da vaga, extrair o ATS e o slug (`jobs.lever.co/**acme**/…`)
2. Descartar o que já está no `empresas.json`
3. Verificar que o slug responde na API pública daquele ATS
4. Entrar no catálogo, com a origem anotada

Os passos 3 e 4 **já existem**: é o `VerificacaoDeAtsService` do
[JOB-37](JOB-37-catalogo-aprende-sozinho.md). O que muda é de onde vem a fila.

## Por que isso é diferente do JOB-37

O JOB-37 tentou o mesmo alimentando a fila com o que a **própria busca** já
achava — e a medição registrada lá mostrou que a hipótese era falsa: a busca
quase não trazia host desconhecido, porque só consultava empresas conhecidas. A
fila nascia vazia por construção.

**O freehire quebra esse círculo.** Ele não está preso ao nosso catálogo, então
o que ele traz é majoritariamente novo — 60 em 63 na amostra, contra o que o
JOB-37 media.

O mecanismo do JOB-37 está pronto e funcionando. Faltava a fonte.

## Critérios de aceite

- [x] Uma busca pelo freehire alimenta a fila de descobertas com os slugs novos
      — **já estava funcionando**, e era a parte do card que ninguém tinha
      conferido. A captura do JOB-37 envolve a busca INTEIRA (`busca.service.ts`,
      no `finally` do gerador), não um motor, então o freehire passou a
      alimentá-la sozinho quando o JOB-39 o ligou. Medido em 01/10: as buscas
      deste card inseriram **45 linhas em 40 minutos**, de hosts que só o
      freehire alcança (`umauma.gupy.io`, `london-drugs-internal.careerplug.com`,
      `larkhotels.rec.pro.ukg.net`)
- [x] Medido: quantas empresas novas entram no catálogo depois de N buscas —
      **453 pares (ats, slug) novos**, de 457 linhas `confirmada` (4 duplicadas
      entre si). **Zero** delas estava no `empresas.json`: o estado
      `ja_no_catalogo` já havia separado essas 6
- [x] Medido: **quantas vagas o motor de ATS passa a achar** por causa delas —
      é a métrica que importa, não o tamanho do catálogo. **447 → 682 na busca
      ampla (+53%) e 35 → 111–115 em "Backend Engineer" (+217%)**, com o
      mesmo tempo e as mesmas 200 consultas. O filtro LATAM **não melhorou**
      (95 → 96), e o porquê está medido abaixo
- [x] Os ATS brasileiros (gupy, inhire, solides) são lidos, ou fica escrito aqui
      por que não valeu — **não valeu, e está escrito**: ver "Os ATS brasileiros:
      por que não". Os três somam 52 empresas na fila, e nenhum tem API pública
      (medido: `portal.gupy.io` e `radix.inhire.app` devolvem HTML, não JSON)
- [x] Desligar o freehire não quebra a colheita do que já foi aprendido — e
      agora há teste. O interruptor da colheita é `jobs.descobertas`, e ele
      governa o que **sai para a rede**; a leitura do que já está no banco não
      consulta flag de motor nenhuma

## O teste que decide se valeu

Desligar o freehire depois de N semanas e comparar o rendimento do motor de ATS
com o de antes. Se não subir, o catálogo cresceu sem servir para nada — e isso
precisa ser dito no card, como o JOB-37 disse.


---

## O que a remedicao achou (01/10/2026)

Stakeholder: *"temos que ficar independentes"*. Antes de comecar, medi o
estado real — e o card de 26/08 estava desatualizado num ponto que **inverte a
ordem do trabalho**.

### A fila nao esta vazia. Ja tem 1.297 linhas

| estado | empresas | vagas atras delas |
| --- | ---: | ---: |
| **confirmada** | **457** | **37.030** |
| desconhecida | 761 | — |
| nova (nao verificada) | 58 | — |
| morta | 15 | 0 |
| ja_no_catalogo | 6 | 1.837 |

O mecanismo do JOB-37 **rodou e funcionou**. A premissa deste card ("o que fica
se o freehire fechar: nada. Volta tudo ao catalogo de 526 empresas") nao vale
mais: ha 457 empresas confirmadas a mais, com 37 mil vagas atras.

### E o motor de busca nao le nenhuma delas

`busca-ats.service.ts:556` le **`empresas.json`** — o arquivo de 526. As 457
confirmadas vivem na tabela `ats_discoveries`, e **nada as consulta**.

O trabalho de descoberta foi feito, esta guardado, e **nao virou busca**. E
exatamente o criterio que este card chama de *"a metrica que importa, nao o
tamanho do catalogo"*.

### A ordem correta, entao

1. **O motor passa a ler as confirmadas** — 457 empresas e 37.030 vagas que
   **ja existem** e estao paradas. E o passo que entrega independencia hoje,
   sem depender de nenhuma busca nova.
2. **O freehire alimenta a fila** — o que o card ja descrevia, para continuar
   aprendendo.

O passo 1 nao estava no card, e e o que tem o maior retorno por esforco. O
passo 2 sem o passo 1 continuaria enchendo um deposito que ninguem abre.

### Por que isso aconteceu

O JOB-37 entregou o mecanismo e mediu que a hipotese dele era falsa (a fila
nascia vazia porque a busca so consultava empresas conhecidas). O JOB-39 ligou
o freehire e **quebrou esse circulo sem que ninguem reparasse** — a fila passou
a encher sozinha, pelo motor novo, e o card que esperava por isso continuou
aberto.

E a ponta solta ficou: ninguem ligou o deposito de volta na busca.

---

## O que foi entregue (01/10/2026)

### O passo 1 era o card inteiro, e o passo 2 já estava pronto

A remedição acertou a ordem e **errou o tamanho do passo 2**: ele não precisava
ser feito. A captura do JOB-37 envolve a busca inteira — `busca.service.ts`
guarda as vagas de passagem e chama `anotar()` no `finally` do gerador —, então
o dia em que o JOB-39 pôs o freehire na frente da cascata, a fila passou a ser
alimentada por ele sem que ninguém escrevesse uma linha. É por isso que havia
1.297 linhas esperando.

O que faltava era só a outra ponta: **ninguém ligava o depósito de volta na
busca.**

| Peça | Onde |
| --- | --- |
| Leitura das confirmadas | `BuscaAtsService.aprendidas()` |
| União das duas fontes, com dedup | `juntar()`, no mesmo arquivo |
| Catálogo exposto para teste | `BuscaAtsService.catalogoDaBusca()` |
| Testes do catálogo (25) | `backend/src/jobs/busca-ats.catalogo.spec.ts` |
| Testes do extrator (23) | `backend/src/jobs/descobertas.spec.ts` |

### Os números, medidos contra a aplicação de pé

Só o motor de ATS (`jobs.freehire = false`), com sessão, três rodadas de cada:

| Busca | Antes | Depois | |
| --- | ---: | ---: | --- |
| ampla (`{}`) | **447** vagas / 144 empresas | **672–686** / 185–188 | **+53%** |
| `job_titles: ["Backend Engineer"]` | **35** / 18 | **109–115** / 48–50 | **+217%** |
| `regions: ["latam"]` | **95** / 39 | **95–96** / 36–37 | **+1%** |

As faixas são de cinco rodadas; o "antes" foi 447/447/438 em três. A variação
vem de board que responde ou não dentro do timeout de 12s, não do código.

Tempo: 21–60s antes, 29–55s depois. **Não piorou, e não podia piorar** — o
`TETO_EMPRESAS` continua em 200, então o número de consultas por busca é o
mesmo. O catálogo foi de 933 para 1.386 empresas; o que mudou foi **quais 200
são consultadas**, não quantas.

### A ordem é a feature, e isso foi medido rodando as duas variantes

`escolher()` corta em 200 **por posição** na fila de cada ATS. Anexar as 453
confirmadas no fim da lista as deixa inalcançáveis — e não é dedução, é
medição: a variante foi compilada, subida e medida.

| Variante | Busca ampla | Backend Engineer |
| --- | ---: | ---: |
| baseline (sem as confirmadas) | 447 | 35 |
| confirmadas **anexadas no fim** | **451** | **35** |
| confirmadas **na frente** | **682** | **111** |

Pôr na frente não é preferência: o arquivo é alfabético (o próprio `escolher`
registra que essa ordem "não diz nada") e a confirmada traz `vagas` **medido
contra a API real** nas últimas três semanas. É o único sinal de vivacidade que
o catálogo tem — o código já dizia que "slug morto é o caso NORMAL" entre os
curados.

### Por que o LATAM não melhorou — e por que não foi "consertado"

Com `regions: ['latam']`, `escolher()` ordena por `contrataEm.length`. A
confirmada chega com `contrataEm: []` (a colheita não sabe em que países a
empresa contrata), então ela fica atrás das 933 do arquivo e nunca entra nas
200. Só 264 das 933 curadas têm o campo preenchido.

**Preencher `contrataEm` por adivinhação seria pior que a lacuna.** Esse campo é
o que faz o filtro significar algo: o JOB-20 mediu **1 vaga elegível em 1.961**
na curadoria de grandes contra **144 em 1.229** nas startups remote-first, e a
diferença está em quem contrata por país. Chutar "latam" em 453 empresas encheria
o filtro de vaga que não aceita quem mora aqui — o resultado **parece** melhor e
é pior. O caminho certo é a verificação passar a gravar os países que a vaga diz
aceitar, e isso é card próprio.

### O teste de independência: metade do objetivo, e a outra metade é do JOB-47

O stakeholder pediu independência do freehire. Com `jobs.freehire = false`:

| Quem busca | Antes | Depois |
| --- | ---: | ---: |
| **com sessão** | 447 vagas | **682 vagas** |
| **anônimo** | **0 vagas** | **0 vagas** |

**O anônimo continua em zero, e este card não muda isso.** Não é regressão: é o
desenho do JOB-47, escrito com estas palavras em `busca.service.ts` — *"se o
admin desligou o freehire, o anônimo não tem motor nenhum, e o certo é lista
vazia"*. A cascata para em `limites.somenteFreehire` antes de chegar ao ATS,
porque rota aberta que alcance motor pago é um script contra a chave de quem
paga, e o projeto não tem rate limiting.

Ou seja: **quem entrou ficou independente hoje; quem não entrou não.** Mexer
nisso é decisão de produto com custo real (o ATS é gratuito, mas são 200
requisições a APIs que são um favor de terceiros, sem rate limiting nosso), e
fica registrado aqui em vez de ser resolvido de passagem.

## As 761 `desconhecida`: o que são, de verdade

A pergunta do briefing era se é ATS brasileiro faltando, host que não é ATS, ou
bug de parsing. **São as três coisas, e em proporções que surpreendem.**

| Família | Empresas | Aparições |
| --- | ---: | ---: |
| site próprio / outro | 306 | 44.104 |
| **workday** | **184** | **18.086** |
| oracle cloud | 41 | 4.098 |
| whatjobs (agregador) | 37 | 8.540 |
| **gupy (BR)** | **28** | **187** |
| ATS que já lemos, slug deu 404 | 27 | 112 |
| personio | 24 | 53 |
| bamboohr | 21 | 178 |
| **inhire (BR)** | **19** | **94** |
| breezy | 15 | 174 |
| icims | 14 | 2.312 |
| ukg/ultipro | 12 | 950 |
| teamtailor | 9 | 82 |
| recruitee | 7 | 110 |
| **solides (BR)** | **5** | **6** |
| smartrecruiters | 1 (!) | 18.560 (!) |

**Os 27 "ATS que já lemos" não são bug de parsing.** Conferido na API real:
`greenhouse:clickhouse`, `greenhouse:zenvia`, `greenhouse:wiz`, `lever:ubiminds`
e `lever:flex` dão **404 de verdade** — a empresa mudou de ATS ou fechou o
board. O que há aqui é um **estado mal nomeado**: `desconhecida` significa hoje
duas coisas diferentes ("host que não sabemos ler", 705 linhas, e "slug conhecido
que não respondeu", 56 linhas), e a segunda deveria ser `morta`. Não foi mexido
porque muda dado existente e não afeta a busca — as duas são igualmente
excluídas do catálogo.

### O bug que apareceu olhando essa tabela: JOB-48

`jobs.smartrecruiters.com` com **1 empresa e 18.560 aparições** não é uma
empresa produtiva: é **todas as empresas do smartrecruiters empilhadas numa
linha**. O extrator só tira slug do caminho para greenhouse/lever/ashby; para
qualquer outro host multiempresa ele devolve `slug: ''`, e a chave da fila é
`(host, slug)`.

E o slug estava ali: `jobs.smartrecruiters.com/LiftedanUpworkCompany/374399...`

Vale mais que um detalhe: **`aparicoes` é o número que o JOB-37 usa para decidir
se vale escrever um adaptador**, e para esses hosts ele está inflado pelo número
de inquilinos, não de vagas. Mesmo defeito em `mycareersfuture.gov.sg` (15.153),
`europa.eu` (5.089), `jobs.dayforcehcm.com` (4.334), `recruiting.paylocity.com`
(1.627). Virou card: [JOB-48](JOB-48-host-multiempresa-colapsa-numa-linha.md).

## Os ATS brasileiros: por que não — e o critério de aceite que isso fecha

O card pedia "são lidos, ou fica escrito aqui por que não valeu". **Não valeu, e
por dois motivos independentes.**

**1. O volume não justifica.** Gupy, inhire e solides somam **52 empresas e 287
aparições** na fila — contra 184 empresas e 18.086 aparições do Workday. Se
houvesse orçamento para um adaptador, o número manda escrever o do Workday, não
os três brasileiros juntos.

**2. Nenhum dos dois maiores tem API pública.** Medido em 01/10:

```
portal.api.gupy.io/api/v1/jobs          → 404
pagseguro.gupy.io/api/v1/jobs           → 404
portal.gupy.io/api/v1/jobs              → 200, mas devolve HTML (não é API)
radix.inhire.app/api/jobs               → 200, mas devolve HTML (não é API)
api.inhire.app/jobs/radix               → 406
```

Ler esses dois exigiria raspagem de HTML, que é outra classe de trabalho:
quebra em toda mudança de layout, e o motor de ATS existe justamente por ser o
contrário disso — API pública, estável, custo zero. O Firecrawl já é a peça que
raspa, e o JOB-20 mediu que ele dá 7 vagas por 42 créditos.

**O que mudaria essa conclusão:** o JOB-48. Com os hosts multiempresa
destrinchados, a contagem por família volta a ser confiável, e pode ser que
smartrecruiters ou workday passem a mostrar um caso óbvio. Hoje a lista que
alguém leria para decidir está ordenada por um número corrompido.

## Testes — 48 novos, e as mutações

Backend **429 → 477**. Frontend 361, intacto (nenhum arquivo de frontend foi
tocado). `tsc` sem erro novo — os 2 de `grupo.spec.ts` são anteriores e foram
conferidos com `git stash`.

**Nenhum teste passou sem ter sido visto falhar.** 20 mutações, 20 mataram
teste:

| # | Mutação | Testes que caíram |
| --- | --- | ---: |
| M1 | confirmadas anexadas no fim, não na frente | 2 |
| M2 | sem dedup (não pula par repetido) | 4 |
| M3 | dedup sensível a caixa | 1 |
| M4 | aceita qualquer estado, não só `confirmada` | 4 |
| M5 | deixa entrar confirmada com `ats` nulo | 1 |
| M6 | não exige `vagas > 0` | 1 |
| M7 | ordena por vagas crescente | 1 |
| M8 | usa o `slug` cru em vez do `slugTestado` | 8 |
| M9 | sem o filtro de slug vazio | 2 |
| M10 | banco fora derruba o motor (sem `catch`) | 1 |
| M11 | confirmadas entram no filtro de porte | 1 |
| M12 | `paresConhecidos` volta a somar as confirmadas | 1 |
| D1 | `gh_jid` antes do host conhecido (o bug do JOB-37) | 12 |
| D2 | `ehSlug` sempre verdadeiro | 1 |
| D3 | sem o corte do slug puramente numérico | 1 |
| D4 | host sem normalizar (mantém `www.` e caixa) | 1 |
| D5 | aceita qualquer protocolo | 1 |
| D6 | slug perde o hífen | 1 |
| D7 | palpites sem teto de 2 | 1 |
| D8 | palpites sem descartar rótulo genérico | 1 |

**Duas mutações ensinaram antes de matar**, e as duas viraram correção no teste:

- **M4 matou só 1 de 4 na primeira tentativa.** Os testes de `nova`, `morta` e
  `desconhecida` usavam o `vagas` realista de cada estado (`null`, `0`, `null`),
  e quem os barrava era o `vagas: { gt: 0 }` da consulta — **não** o filtro de
  estado que eles diziam testar. Com `vagas: 500` em todos, o estado passou a
  ser a única coisa que pode barrar a linha, e os 4 caem juntos. Era exatamente
  o teste que o briefing chamou de "o que impede o motor de perder tempo com
  slug que não responde", e ele estava passando pelo motivo errado.
- **D2, D3 e D4 "passaram" numa primeira rodada em que a mutação nunca foi
  escrita** — o escape da regex no shell falhou e o `sed` não casou nada.
  Refeitas por script Python com `assert old in s`, as três mataram teste. Fica
  registrado porque o modo de falhar é traiçoeiro: a saída dizia "23 passed",
  que é indistinguível de uma mutação que sobreviveu.

Um defeito real saiu da escrita dos testes: **`slugTestado: ''` passa pelo
`not: null` do Prisma**, e um slug vazio montaria
`boards-api.greenhouse.io/v1/boards//jobs` — consulta gasta que nenhum log
denunciaria. Não ocorre hoje (0 linhas em 1.297), e o filtro ficou.

**O extrator de descobertas não tinha teste nenhum** — o JOB-37 o entregou sem
um. Os 23 novos usam **URLs reais tiradas da tabela de produção**, uma por ATS,
e fixam o bug que o JOB-37 pagou para achar (host conhecido ganha do `gh_jid`).

## Verificado no navegador

Com `jobs.freehire = false` e sessão, nos dois temas: **"684 jobs found"** no
claro e **"680 jobs found"** no escuro, `main#conteudo` presente, **zero erro de
console**.

E a prova de que o ganho vem da colheita, não de outra coisa: as três primeiras
vagas da lista são de `redbee`, `allarahealth` e `openloophealth` — **nenhuma
das três está no `empresas.json`**, e as três são linhas `confirmada`
(`lever:redbee` 14 vagas, `ashby:allarahealth` 206, `ashby:openloophealth` 58).

`scripts/qa-rapido.py`: tudo certo, com o freehire religado.

## Decisões de projeto, e por que as alternativas perdem

**O arquivo ganha o empate.** A linha curada tem `contrataEm`, `sede`, `porte` e
um nome escrito por gente; a colhida tem o que deu para tirar da URL
("cscgeneration-2" é nome de empresa na tabela). Deixar a descoberta
sobrescrever trocaria dado curado por adivinhado.

**`paresConhecidos()` continua lendo só os arquivos**, e seria natural reusar o
`empresas()` novo. Seria bug em dois lugares: na verificação, a confirmada
reexaminada depois de 7 dias casaria com o "catálogo" e viraria
`ja_no_catalogo` — estado que o motor **não** lê —, e a empresa sumiria em
silêncio uma semana depois de ter sido ganha; na captura, a vaga dela deixaria
de contar aparição. "Conhecido" significa **curado e versionado em git**, que é
o que `scripts/exportar-descobertas.py` promove. A confirmada é emprestada:
vale para buscar, não para encerrar a descoberta. (Mutação M12.)

**Com `porte` escolhido, as confirmadas não entram.** `porte` é filtro de
intenção, não de peneira: quem pede `startup` quer o conjunto curado de
startups remote-first, e a colheita não sabe de que lado do mercado a empresa
está. Jogá-la em um dos dois lados diluiria a distinção que faz o filtro valer.

**Cache de 5 minutos**, e não para sempre como os arquivos: a tabela muda (o
cron das 3h confirma empresa nova e desmente a que morreu), e os arquivos não.

## O que NÃO foi feito

- **A promoção para `empresas.json` não rodou.** As 453 continuam só no banco, e
  `scripts/exportar-descobertas.py` existe para promovê-las por decisão humana.
  Isto é de propósito — o JOB-37 decidiu que gravar automático deixa dado curado
  e versionado à mercê de uma extração ruim. **Mas tem uma consequência que
  precisa ser dita: banco novo (ambiente limpo, restore sem a tabela) volta ao
  rendimento de 447.** O ganho deste card vive no banco, não no git.
- **Adaptador para ATS novo** — nenhum. Ver "Os ATS brasileiros: por que não".
- **O estado `desconhecida` não foi desambiguado**, embora cubra dois casos
  diferentes (705 host ilegível + 56 slug 404 que deveriam ser `morta`).
  Nenhum dos dois entra no catálogo, então não afeta a busca.
- **O LATAM continua sem ganho** (95 → 96), pelo motivo medido acima.
- **O anônimo continua com 0 vaga sem o freehire** — desenho do JOB-47, não
  regressão deste card.
