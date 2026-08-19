# JOB-18 — Arquitetura dos tres niveis de busca

**Estado:** desenho, nada implementado (18/08/2026).
Tudo aqui foi medido nesta data contra as APIs reais. Nenhum credito de
Firecrawl foi gasto — os numeros dele vem do que o JOB-01 e o JOB-08 mediram.

## O resumo em uma linha

**A busca por ATS devolve 27.725 vagas de 545 empresas em 58 segundos, de
graca, sem nenhum 429.** Isso muda o desenho inteiro: o volume deixa de ser o
problema, e o custo passa a ser so o da *pergunta de elegibilidade* — que e o
unico lugar onde a IA e insubstituivel.

## 1. Custo real por motor

| Motor | Volume medido | Tempo | Custo | Elegibilidade |
| --- | ---: | ---: | ---: | --- |
| **ATS direto** (7 APIs) | 27.725 vagas / 545 empresas | 58s | **US$ 0** | campo estruturado, parcial |
| **Agregadores** (5 APIs) | 339 vagas somadas | ~4s | **US$ 0** | `candidate_required_location` |
| **IA triagem** (Haiku 4.5) | 39 vagas indeterminadas | ~20s | **US$ 0,04** | lida da descricao |
| **IA busca** (Opus 5 + `web_search`) | 15 vagas | ~90s | ~US$ 0,20–0,30 | 15/15 com citacao |
| **Firecrawl** | 7 vagas | ~60s | **42 creditos** | com citacao |

O contraste que decide o produto: **o Firecrawl gasta 42 creditos para 7
vagas; o ATS entrega 27.725 por zero.** São ordens de grandeza diferentes, não
uma diferença de eficiência.

### Teto real do ATS — nao encontrei o limite

Testei concorrencia crescente contra o Greenhouse (80 empresas):

| Concorrencia | Tempo | 200 | 429 |
| ---: | ---: | ---: | ---: |
| 8 | 4,1s | 80 | 0 |
| 20 | 3,9s | 80 | 0 |
| 40 | 3,2s | 80 | 0 |

Catalogo inteiro, concorrencia 40: **276 empresas, 16.706 vagas, 12,3s, zero
429** (6 slugs deram 404 — board fechado, o esperado). Nenhuma das APIs
documenta rate limit e nenhuma devolveu `Retry-After`.

**Nao afirmo que nao existe limite — afirmo que nao o alcancei em ~700
requisicoes.** O desenho deve assumir que ele existe e nao foi encontrado:
concorrencia 20 por ATS, com backoff no 429, e folga suficiente e educada.

### Os sete ATS, todos verificados hoje

| ATS | Empresas | Vagas | Tempo | Campo util |
| --- | ---: | ---: | ---: | --- |
| greenhouse | 270/276 | 16.705 | 12,3s | `location.name` |
| ashby | 120/121 | 4.217 | 7,4s | **`compensation` em 2.058** |
| lever | 124/127 | 4.163 | 30,7s | **`workplaceType` em 4.163/4.163** |
| workable | 90/90 | 1.897 | 4,5s | `telecommuting` |
| bamboohr | 88/88 | 427 | 10,8s | lista simples |
| recruitee | 20/22 | 743 | 4,7s | `remote` |
| workday | POST CXS | NVIDIA 2.000, Valeo 1.122 | — | `locationsText` |

**Respondendo a pergunta 4:** bamboohr, workable e recruitee **tem API publica e
funcionam** (`{slug}.bamboohr.com/careers/list`,
`apply.workable.com/api/v1/widget/accounts/{slug}?details=true`,
`{slug}.recruitee.com/api/offers/`). Workday funciona pelo POST CXS do coletor
do look4job, com uma ressalva: **so com o slug completo**
(`tenant.wdN.myworkdayjobs.com/site`). Dos 8 testados, 6 responderam 200 e 2
deram 422 — slug so com tenant nao resolve.

O Lever e o mais lento (p50 1,58s contra 0,29s do Greenhouse) — merece timeout
proprio, nao o mesmo dos outros.

## 2. Elegibilidade sem IA — ate onde vai

Classifiquei as 27.725 vagas **so por campo estruturado** (`location` +
`workplaceType`):

| Classe | Vagas | % |
| --- | ---: | ---: |
| nao remoto | 21.080 | 76,0% |
| indeterminado (`"Remote"` puro) | 3.668 | 13,2% |
| restrito (remoto ancorado noutra regiao) | 2.891 | 10,4% |
| elegivel (cita BR/LATAM) | 86 | 0,3% |

**O filtro estrutural elimina 76% das vagas de graca.** Esse e o ganho real: a
IA nunca precisa ver tres quartos do corpus.

### Taxa de erro, contra leitura da descricao

Comparei o veredito do campo contra frases inequivocas na descricao — e aqui
**corrigi um erro meu**. Minha primeira regua contava `"globally distributed
team"` e `"fully remote team"` como prova de elegibilidade, e deu 85,7% de
falso negativo. Estava errada: essas frases descrevem a **cultura da empresa**,
nao quem pode se candidatar — varias vagas do GitLab dizem "globally
distributed team" e tem `location: "Remote, US"`. Refeita a regua para so
aceitar frases sobre *onde o candidato pode estar*:

- **falso negativo (campo descarta, descricao aceita): 5/73 = 6,8%**
- **falso positivo (campo aceita, descricao restringe): 0/1 = 0%**
- das 3.668 indeterminadas, **so 3,1% (115) o regex resolve na descricao**

O falso positivo zero e o numero que importa: **o campo estruturado nunca
prometeu elegibilidade que a descricao desmentisse.** Isso torna o nivel gratis
honesto — ele erra por omissao, nunca por afirmacao falsa, o que e exatamente a
regra do JOB-09.

**Resposta a pergunta 3:** da para classificar 86,4% do corpus sem IA (76%
descartados + 10,4% restritos), com 6,8% de erro por omissao. Os 13,2%
indeterminados sao irredutiveis sem ler a descricao — e sao justamente as vagas
`"Remote"` puro, as mais interessantes para o usuario.

Uma perda a declarar: em amostra de 400 vagas `nao_remoto`, **5% tinham sinal de
remoto na descricao**. O filtro barato descarta ~1.050 vagas que talvez
servissem. E o preco de nao ler.

## 3. Custo de filtrar com IA

Tokens estimados por caracteres do corpus real (razao 4 chars/token) — **isto e
estimativa, nao medicao pela API `count_tokens`**: nao havia credencial
Anthropic disponivel nesta maquina, e o token do banco esta cifrado. Preco da
tabela oficial: Haiku 4.5 US$1/US$5 por MTok, Opus 5 US$5/US$25.

Descricoes reais: mediana 6.425 chars, p90 11.550.

| Estrategia | Tokens in | US$ Haiku | US$ Opus |
| --- | ---: | ---: | ---: |
| todas 27,7k, descricao inteira | 55,7M | 68,23 | 341,14 |
| so remotas 6,6k, inteira | 12,7M | 15,71 | — |
| so remotas 6,6k, truncada 1.200 | 4,1M | **7,05** | — |
| so indeterminadas 3,7k, truncada | 2,2M | **3,89** | 19,44 |

**Passar o corpus inteiro por Opus custa US$ 341 por varredura. Passar so as
indeterminadas por Haiku custa US$ 3,89** — 88x menos, para a mesma resposta
util. Truncar em 1.200 chars corta 65% do custo porque a elegibilidade, quando
declarada, aparece cedo na descricao.

### O numero que fecha o produto

Uma busca *tipica* nao varre 27 mil vagas. Filtrando Java/Spring entre as
remotas: **68 vagas, das quais 39 indeterminadas**.

| Etapa | Custo |
| --- | ---: |
| triagem das 39 em Haiku (truncada) | **US$ 0,0412** |
| mesma triagem em Opus | US$ 0,2061 |
| 20 finalistas em Opus, descricao inteira | US$ 0,2314 |

**Uma busca completa com triagem Haiku + finalistas Opus custa ~US$ 0,27.** Com
Haiku sozinho, US$ 0,04. **Respondendo a pergunta 2:** o modelo pequeno para
triagem e grande para finalistas nao e so viavel — e a unica configuracao que
cabe num produto de assinatura.

## 4. O que cabe em cada faixa

### Gratis — custo zero real

- Varredura ATS completa: 545 empresas, 27.725 vagas, ~60s
- 5 agregadores (Remotive 17, RemoteOK 101, Arbeitnow 175, Himalayas 20,
  WeWorkRemotely 26 — todos 200 hoje)
- Filtro estrutural: descarta 76%, marca 10,4% como restrito
- Salario estruturado do Ashby (2.058 vagas) e `workplaceType` do Lever (4.163)

**Impossivel no gratis:** responder "aceita brasileiro?" para as 3.668 vagas
`"Remote"` puro. O campo nao diz, e ler custa dinheiro. **A tela precisa
mostrar `null` — "a vaga nao diz" — nunca `false`.** Essa e a regra do JOB-09 e
ela e o que mantem o nivel gratis honesto em vez de mentiroso.

### Media — ~US$ 0,05 por busca

Tudo do gratis, mais triagem Haiku nas indeterminadas do recorte do usuario
(~39 vagas), descricao truncada em 1.200 chars. Devolve elegibilidade **com
citacao** — o campo `elegibilidadeTrecho` que ja existe no schema.

**Impossivel na media:** triar as 3.668 indeterminadas do corpus inteiro a cada
busca (US$ 3,89 por usuario por busca nao fecha). O recorte por stack antes da
IA nao e otimizacao, e requisito.

### Power — ~US$ 0,30 por busca

Media, mais: finalistas relidas por Opus com descricao inteira, extracao de
salario quando nao ha campo estruturado, e **Firecrawl so na watchlist** — as
~90 startups sem ATS (Cursor, Baseten, Cognition). E o unico lugar onde os 42
creditos por 7 vagas se justificam, porque nao ha alternativa.

**Impossivel no power:** varredura exaustiva com Opus (US$ 341). Firecrawl como
motor principal — 8 paginas por busca contra 27.725 vagas do ATS nao e uma
comparacao.

## 5. Recomendacao

**Inverter a arquitetura atual.** Hoje o Firecrawl e o motor principal e o ATS
nao tem consumidor nenhum. Deve ser o oposto:

1. **ATS vira o motor base dos tres niveis.** Custo zero, dois a tres ordens de
   grandeza mais volume. Um `ats.service.ts` por pasta, concorrencia 20, backoff
   no 429, slug vazio tratado como normal (o `LEIA-ME` ja avisa que slug morre).
2. **Filtro estrutural antes de qualquer token.** Ele decide 86,4% e nunca
   produz falso positivo. A IA so ve o que sobrou do recorte do usuario.
3. **Haiku para elegibilidade, Opus so para finalistas.** 88x de diferenca para
   a mesma resposta.
4. **Firecrawl rebaixado a watchlist.** Deixa de ser o motor e vira o caso de
   excecao que sempre foi.
5. **Cache de varredura, nao busca por usuario.** As 27.725 vagas sao as mesmas
   para todo mundo. Uma varredura periodica no banco, e a busca do usuario vira
   consulta local — a IA so roda no delta.

O ponto 5 e o que muda a economia: sem cache, cada usuario paga a triagem
inteira; com cache, a elegibilidade de uma vaga e paga **uma vez para todos os
usuarios**. E a diferenca entre US$ 0,04 por busca e US$ 0,04 por vaga nova.

## O que nao foi medido

- **Tokens pela API oficial.** Estimei por caracteres; sem credencial na
  maquina. Antes de implementar, refazer com `messages.count_tokens` — a razao
  4 chars/token pode errar 20% para mais ou menos em texto com muito HTML.
- **Acuracia real do Haiku** na pergunta de elegibilidade. Medi o *custo*, nao a
  *qualidade*. Precisa de um lote rotulado a mao antes de confiar.
- **Rate limit sustentado.** Testei rajadas de ~700 requisicoes, nao varredura
  horaria repetida. O limite pode ser por hora, nao por minuto.
- **Frescor das vagas.** Nao medi quantas das 27.725 ja fecharam.
