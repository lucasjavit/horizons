# JOB-09 — Auditoria campo a campo das vagas da busca real

**Estado:** auditoria feita (17/08/2026)
**Insumo:** `busca2/3/4.txt` (scratchpad) + `busca5.txt`, coletada durante esta
auditoria contra o build atual da API (imagem de 20:24, posterior à busca4).
**Método:** abertura das 6 páginas de origem via Firecrawl (`maxAge: 0`, fetch
ao vivo), comparação campo a campo, e uma busca nova para separar o que já foi
corrigido do que continua.

## Veredito

**6 de 6 vagas têm pelo menos um campo falso.** Não é uma extração com alguns
erros: **nenhuma das 8 URLs que a busca abriu é a página de uma vaga.** Todas as
8 são páginas de listagem — busca, categoria ou índice do board. As 6 "vagas"
exibidas são linhas escolhidas de dentro de uma lista, e apresentadas como se a
URL fosse aquela vaga.

O `ehListagem` existe justamente para barrar isso (`busca.service.ts:207`), e
não barrou nenhuma das 8.

---

## GRAVE — informação falsa na tela

### 1. Nenhuma das 6 URLs é uma vaga; a mesma URL devolve empresa diferente a cada busca

O campo `id` é a própria URL (`busca.service.ts:249`). Como a URL é uma
listagem, a "vaga" por trás daquele id muda a cada execução. Medido nas quatro
buscas, **5 de 7 URLs trocaram de empresa entre runs**:

| URL | busca2 | busca3 | busca4 | busca5 |
|---|---|---|---|---|
| `workingnomads.com/remote-java-jobs` | Tripadvisor | Tripadvisor | **Elastic** | — |
| `motionrecruitment.com/tech-jobs/java` | motionrecruitment.com | `.` | Motion Recruitment | **Principal Product Security Architect (Atlanta)** |
| `dice.com/jobs/q-remote+java+developer-jobs` | ICF | **Not specified** | — | ICF |
| `builtinaustin.com/.../java` | CareerSwift | **General Dynamics** | **Photon** | — |
| `weworkremotely.com/categories/...` | Collaboration.Ai | **MapTiler** | **Metana.io** | — |

Prova de que são listagens (fetch ao vivo, hoje):

- `workingnomads.com/remote-java-jobs` — h1 "Remote Java Developer Jobs",
  **51 cards**, 50 links `/jobs/<slug>` distintos.
- `remoterocketship.com/us/jobs/backend-engineer/` — meta description:
  *"Search **903** backend engineer remote jobs in the US."*
- `motionrecruitment.com/tech-jobs/java` — título "Java Jobs | Motion
  Recruitment", **37 cards**.
- `roberthalf.com/us/en/jobs/all/java-developer` — og:title: *"**140 Results**
  for Java Developer Jobs"*.
- `builtinaustin.com/jobs/remote/dev-engineering/java` — "Top Remote Java
  Developer Jobs in Austin, TX", **19 cards**.
- `weworkremotely.com/categories/remote-back-end-programming-jobs` — **28 cards**.

**Impacto:** a pessoa clica na vaga e cai numa lista de 903 vagas, não na vaga.
Vaga salva vira outra vaga na busca seguinte, porque a chave é a URL da lista.

**Causa:** `ehListagem` não disparou em nenhuma das 8 páginas. O `temSinalDeVaga`
(`busca.service.ts:399`) agrava: uma listagem tem skills, salário e local em
abundância — os dois sinais que ele exige — então ele *promove* listagem a vaga
mesmo quando o modelo acerta o `ehVaga: false`.

---

### 2. Elastic: `elegivelBrasil: false` sem nenhum trecho que sustente

```
"company":"Elastic","elegivelBrasil":false,"elegibilidadeTrecho":null
```

É o achado mais grave da lista, pelo critério do próprio card: afirmação de
elegibilidade sem trecho. A tela afirma que a vaga **não** contrata quem mora no
Brasil, e não tem uma linha da página para justificar.

Na página, esse anúncio aparece em três variantes — **USA** ($133k-$211k),
**Spain** (€67k-€106k) e **Norway** (sem salário) — todas com o mesmo título. A
extração pegou a linha USA e concluiu a exclusão do Brasil a partir do "USA" do
card, não de um texto de elegibilidade.

O `busca2` tem a mesma doença em forma mais crua: Robert Half com
`elegivelBrasil: false` e `elegibilidadeTrecho: "nao mencionado"` — o modelo
escreveu no campo de citação a confissão de que não havia citação, e o código
aceitou porque `texto()` só checa string não-vazia.

**Impacto:** `LinhaVaga.tsx:107-115` renderiza esse trecho sob o rótulo *"Where
this eligibility came from"*. Com trecho `null` o chip aparece mesmo assim, com
a bandeira, e a origem prometida pelo rótulo não existe. A pessoa descarta uma
vaga aberta a ela.

---

### 3. Built In Austin: título de uma vaga com salário de outra

```
"title":"Senior Java Developer - Dallas, TX","company":"Photon",
"salaryMin":37000,"salaryMax":132000,"salaryTrecho":"37K-132K Annually"
```

A página tem os dois cards, e são **jobs diferentes**:

| Card na página | Salário na página |
|---|---|
| **Senior** Java Developer - Dallas, TX (Photon) | **40K-142K Annually** |
| Java Developer - Dallas, TX (Photon) | **37K-132K Annually** |

A extração juntou o título do primeiro com o salário do segundo. A guarda
`salarioConfere` não pega: 37000 e 132000 *aparecem* no trecho citado — o trecho
é real, só pertence a outra vaga. A guarda valida que o número veio de um texto,
não que o texto seja daquela vaga.

**Impacto:** subdeclara o piso em US$ 3 mil e o teto em US$ 10 mil. A pessoa
negocia com o número errado.

---

### 4. weworkremotely: um anúncio publicitário virou vaga

```
"title":"Remote Tech Jobs Paying $130k to $250k","company":"Metana.io",
"salaryMin":130000,"salaryTrecho":null
```

Não é vaga. É o **banner de publicidade** da Metana no topo da categoria. Texto
verbatim ao lado, na página: *"Metana's partner companies are hiring AI, Web3,
Software & Security talent right now."* A Metana vende bootcamp; não está
contratando ninguém.

Repare no par `salaryMin: 130000` com `salaryTrecho: null`: a tela mostra um piso
de US$ 130 mil **sem nenhuma frase de origem** — exatamente o que o comentário de
`busca.service.ts:267-268` diz que não deve acontecer.

---

### 5. Motion Recruitment: `company` é a agência, não o empregador

```
"company":"Motion Recruitment"
```

A página nomeia o empregador como **"A growing robotics technology company"** —
o cliente é anônimo de propósito. "Motion Recruitment" é a agência que
intermedeia. Em busca2 o mesmo campo veio `"motionrecruitment.com"` (o domínio) e
em busca3 veio `"."` — o filtro `empresaValida` barrou o `"."`, mas o domínio
passou.

*Conferido e correto nessa vaga:* `local: "Boston, MA"` e
`salaryTrecho: "$150k - $170k"` batem com a página, e `skills: [Java, C++,
TypeScript]` saem do título do anúncio.

---

### 6. `postedAt` não é extraído — é inventado

O campo que acabou de ser ligado. `2026-08-15` aparece **9 vezes** em quatro
sites sem relação, e é o valor de **todas as 4** vagas da busca5. É "dois dias
antes da busca".

Prova direta, na `workingnomads.com/remote-java-jobs`: a página tem **zero**
datas absolutas (`0` matches para `2026-0X-XX`, `August X, 2026` e `XX/XX/2026`)
e **192** marcações relativas. O card da Elastic diz **"22 days ago"** — ou seja,
≈ 2026-07-26. A extração emitiu `2026-08-15`.

Mesmo padrão na Robert Half: a página diz **"Posted — 2 weeks ago"** (≈03/08) e a
busca4 gravou `2026-08-15`. Na busca3, a mesma vaga tinha `2026-07-31`.

`dataIso()` (`busca.service.ts:409`) só rejeita futuro e ano < 2000 — uma data
plausível e falsa passa inteira. As datas de 2023 nas buscas 2 e 3 são o mesmo
defeito com sorte pior.

---

## MÉDIO — informação verdadeira que a extração perdeu ou distorceu

### 7. Reddit: `skills` com 10 itens que a página não tem

```
"skills":["AWS","Distributed Systems","Docker","GraphQL","Kubernetes",
          "Postgres","Python","Redis","Thrift","Go"]
```

A página é o índice de 903 vagas; o card do Reddit ali traz título, empresa,
salário e data — **não traz stack**. Dez tecnologias específicas (Thrift,
GraphQL, Redis) não saíram dessa página. São do conhecimento prévio do modelo
sobre o Reddit, não do anúncio.

O salário `$190.8k - $267.1k` também não confere: no fetch de hoje o card do
Reddit mostra **$154,433**.

### 8. Elastic: `regime: "presencial"` numa vaga de board remoto

`workingnomads.com` é um board **exclusivamente remoto** ("Explore the fully
remote Java Developer jobs worldwide") e o card diz `USA / Full-time / Senior
Level`. `presencial` contradiz a própria natureza da fonte. Em busca2/3, a mesma
URL devolveu `remoto`.

### 9. Robert Half: `degree` e `benefits` genéricos demais para uma listagem

`degree: "Bachelors in Computer Science, Information Technology, or related
field"` e 4 benefits ("Competitive compensation", "Comprehensive benefits",
"Professional development opportunities", "Certification reimbursement") numa
página que é um índice de 140 resultados com título, cidade e faixa horária por
linha. Em busca3 o mesmo campo veio com aspas tipográficas
(`Bachelor's degree in Computer Science or related field`) e em busca2 com uma
5ª benefit. Texto que muda de forma a cada run é redação do modelo, não citação.

*Ponto que funcionou:* a guarda de salário **fez o seu trabalho aqui**. A página
publica `$55 - $90 / hour`; `salarioConfere` viu `/ hour` e devolveu
`salaryMin/Max: null`. É a correção do bug da Robert Half confirmada em produção.

### 10. `local` da Elastic diz "USA" e omite que o mesmo anúncio existe em ES e NO

`local: "USA"`, `paisIso: "us"` — batem com o card escolhido, mas a página
oferece Spain e Norway com o mesmo título. A escolha da linha é arbitrária, e a
tela apresenta uma das três como se fosse a vaga.

---

## RUÍDO — não muda decisão

11. `weworkremotely` (Metana): `local: null` e `paisIso: null` — correto, o
    banner não tem país. A regra "remoto não é país" funcionou.
12. `currency: "USD"` na Robert Half sem `salaryMin/Max` — moeda pendurada num
    salário que não existe. Inofensivo, mas é campo sem lastro.
13. `area` oscila entre runs para a mesma URL (`"Technology"` / `"Tecnologia"` na
    Robert Half — em português numa tela em inglês; `"Robotics"` / `null` na
    Motion). Vem do título, não de um campo da página.
14. `benefits: []` em 5 das 6 — vazio honesto, sem invenção.

---

## As 2 URLs que não viraram vaga

`inicio.total = 8`, saíram 6. O container foi reconstruído às 20:24 e os logs da
busca4 (20:23) se perderam, então a identificação é por diferença entre os runs:
as duas ausentes na busca4 são **`dice.com/jobs/q-remote+java+developer-jobs`** e
**`wellfound.com/role/r/java-backend-developer`**, ambas presentes em runs
vizinhos.

Nenhuma das duas foi descartada com razão de conteúdo:

- **dice.com** apareceu na busca2 (ICF, com salário válido `USD 98,614.00 -
  167,644.00 per year`) e voltou na busca5 com a mesma vaga. Some e volta entre
  execuções — comportamento de timeout/429 no scrape, não de descarte. Na
  busca3 ela passou com `company: "Not specified"` e um `salaryTrecho` de 280
  caracteres que era a descrição inteira colada no campo de citação.
- **wellfound.com** saiu na busca3 (Riser, `$125k – $145k • No equity`) e não
  reapareceu.

**Conclusão:** o problema não é descarte injusto — é **não-determinismo**. As
mesmas 8 URLs entram e um subconjunto variável sai, sem log que diga qual e por
quê. O `this.log.warn` de scrape falho (`busca.service.ts:179`) existe, mas os
logs somem no rebuild; e o `salario descartado` (linha 242) nunca apareceu em
nenhuma execução observada.

---

## O que testei e não quebrou

- **Guarda de salário por hora:** funcionou na Robert Half (`$55 - $90 / hour` →
  `null`). O bug relatado no JOB-08 está corrigido.
- **`empresaValida`:** barrou o `"."` que passava em busca3.
- **Faixa de plausibilidade (`salario`)** e **`ISO_VALIDOS`:** nenhum valor
  absurdo nem bandeira errada nas 4 execuções.
- **"Remoto não é país":** a Metana veio com `paisIso: null`, correto.
- **Streaming SSE:** os 6 eventos `vaga` chegaram um a um, com `inicio` e `fim`
  bem-formados, nas 4 execuções.

## O que não consegui testar

- **Logs de descarte da busca4** — perdidos no rebuild das 20:24. A atribuição
  das 2 URLs ausentes é por diferença entre runs, não por log.
- **Se a vaga está aberta** — nenhuma das 6 URLs é a página de uma vaga, então
  "está aberta?" não tem resposta: a pergunta não se aplica a uma listagem.
  `estaFechada` nunca foi exercitado de verdade.
- **`anosExp`** — `5` para o Reddit e `5`/`2` para builtinaustin não são
  confirmáveis nem refutáveis pela listagem, que não traz esse dado.

---

## A raiz

Uma coisa só explica 10 dos 14 achados: **a busca nunca abriu a página de uma
vaga.** O `search` do Firecrawl devolve páginas de categoria (é o que ranqueia em
SEO), o filtro `ehAgregador` remove Indeed e LinkedIn mas deixa passar
weworkremotely, builtinaustin e remoterocketship — que são a mesma coisa — e o
`ehListagem` não segurou nenhuma.

O `temSinalDeVaga`, escrito para não jogar vaga boa fora (o caso Easyship), hoje
faz o oposto do pretendido: dá à listagem os dois sinais que ele exige e a
promove a vaga. As 50 URLs `/jobs/<slug>` que a própria workingnomads expõe são
as vagas de verdade, e a busca as tem em mãos sem usá-las.

Enquanto isso não mudar, cada campo auditado acima é uma amostra aleatória de
uma lista, e a próxima busca troca a amostra.
