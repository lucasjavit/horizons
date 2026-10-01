# JOB-47 · A busca funciona sem login

**Estado:** feito (01/10/2026)
**Tamanho:** M

## De onde veio

Stakeholder, em 01/10: *"vamos fazer uma coisa, nao precisa de login para
fazer buscas"*.

Vem na sequência do [PLT-13](PLT-13-remover-as-trilhas.md), que removeu as
trilhas e deixou registrado o efeito colateral: **a porta de entrada do site
virou um convite a entrar.** A listagem de trilhas era legível sem conta
(PLT-07); a `VagasPage` diz *"Sign in to see your jobs"*. Este card desfaz
isso.

## O que a medição mostrou

**A busca não conhece o usuário.** Nem `busca.controller.ts` nem
`busca.service.ts` têm `@CurrentUser()` ou `userId` — ela só está fechada
porque o guard é *fail closed*, que é o comportamento correto do guard. Abrir
é um decorador.

**As facetas já são anônimas** (`@SessaoOpcional()` em `facetas.controller.ts`),
com o comentário que explica a escolha. Então filtrar já funcionava sem conta;
só buscar não.

**O que trava é custo, não arquitetura.** O freehire vem primeiro e é grátis
(API pública sem chave, JOB-39), mas quando ele falha a cadeia cai no Firecrawl
(créditos) ou na IA (tokens) — e **o projeto não tem rate limiting**. Rota
aberta sem teto é um script contra a chave do stakeholder.

## As decisões do stakeholder (01/10)

| Pergunta | Decisão |
| --- | --- |
| Como proteger o custo? | **Anônimo só no freehire.** Sem ATS, sem Firecrawl, sem IA. Custo zero garantido, não "quase zero" |
| Quanto do acervo o anônimo vê? | **Só vaga com 14 dias ou mais de publicada.** A recém-publicada é de quem entra |
| Salvar, histórico e CV? | **Exigem login** |

**A razão da segunda decisão importa e vai no código:** o valor do cadastro é
*chegar primeiro na vaga nova*. O anônimo recebe amostra real do produto — o
acervo inteiro, a busca de verdade, os filtros — e não a vantagem competitiva.

## O ponto técnico a resolver

O DTO tem `posted_within_days` (vaga **mais nova** que N dias) e o freehire
devolve `posted_at`. **O corte que este card pede é o inverso:** mais
**velha** que 14 dias.

Medir primeiro se a API do freehire aceita isso. Se não aceitar, o corte é
nosso, depois de receber a página — e aí há consequência na paginação: filtrar
60 resultados pode devolver 12, e `total` tem de refletir o que a pessoa pode
ver, senão o "Load more" promete o que não existe (foi exatamente o defeito
que o JOB-45 corrigiu).

## O que fazer

1. `POST /jobs/search` e `POST /jobs/search/mais` passam a `@SessaoOpcional()`
   — **não** `@Public()`: token inválido tem de continuar dando 401, em vez de
   virar anônimo em silêncio (é a regra do CLAUDE.md, e o que faz sessão
   expirada não parecer busca zerada).
2. Sem sessão: só o motor freehire, e corte de 14 dias.
3. Com sessão: a cadeia inteira e o acervo inteiro, como hoje.
4. A tela diz o que o login acrescenta, **no lugar certo**: ao chegar ao fim da
   lista anônima, não num banner permanente que vira ruído.
5. `/` deixa de exigir sessão para mostrar resultado.
6. Estrela, histórico e CV continuam exigindo login, e **o convite tem de
   explicar o que se ganha** — "Sign in to save jobs", não "Unauthorized".

## Critérios de aceite

- [x] Sem nenhum token, `/` permite buscar e mostra vagas
- [x] Anônimo **não** alcança Firecrawl nem IA — provado por teste, não por
      leitura
- [x] Anônimo recebe só vaga com 14+ dias; com sessão, o acervo inteiro
- [x] `total` e o "Load more" do anônimo batem com o que ele pode ver
- [x] **Token inválido continua dando 401** na busca (não vira anônimo)
- [x] Salvar, histórico e CV seguem exigindo sessão, com convite que explica
- [x] O `fail-closed.e2e.spec.ts` reflete a superfície nova, e as rotas novas
      aparecem como opcionais — não como públicas
- [x] `qa-rapido.py` ganha checagem de busca anônima

## Riscos

| Risco | Mitigação |
| --- | --- |
| Anônimo escapa para o motor pago | teste que falha se a cadeia for alcançada sem sessão |
| `@Public()` no lugar de `@SessaoOpcional()` | sessão expirada passaria a parecer busca vazia |
| O corte de data quebra a paginação | `total` sai do filtrado, não do bruto |
| Convite vira banner permanente | aparece no fim da lista, onde a pessoa já viu valor |

---

## O que foi feito (01/10/2026)

### A pergunta técnica do card, respondida com medição

**A API do freehire NÃO aceita o corte invertido.** Medido contra
`freehire.me` em 01/10, com `regions=latam` (catálogo de 58.782 na hora):

| parâmetro tentado | `meta.total` | `meta.ignored_params` |
| --- | ---: | --- |
| _(nenhum, baseline)_ | 58.782 | — |
| `posted_before_days=14` | 58.782 | `[{param: posted_before_days}]` |
| `posted_after_days=14` | 58.782 | `[{param: posted_after_days}]` |
| `posted_min_days=14` | 58.782 | `[{param: posted_min_days}]` |
| `posted_older_than_days=14` | 58.782 | `[{param: posted_older_than_days}]` |
| `posted_at_before=2026-09-17` | 58.782 | `[{param: posted_at_before}]` |
| `min_age_days=14` | 58.782 | `[{param: min_age_days}]` |

Total idêntico ao da consulta sem parâmetro, e cada nome denunciado pelo
`ignored_params` — a armadilha que o `checarIgnorados` já cobria. O
`openapi.yaml` deles confirma: só existem `posted_within_days` e
`open_within_days`, ambos "within the last N days".

**Mas o corte não precisou ser local, e essa é a descoberta que fez o card
caber.** A API tem `sort=posted_at` + `order=asc`, e a combinação com a janela
entrega a ponta VELHA do catálogo:

| consulta (`regions=latam`) | linhas | com 14+ dias | faixa |
| --- | ---: | ---: | --- |
| padrão (mais novas primeiro) | 60 | **0** | 0 dias |
| `sort=posted_at&order=asc` sozinho | 60 | 60 | **722 a 20.727 dias** |
| `posted_within_days=90` + `order=asc` | 60 | **60** | 89 dias |
| idem, 5 páginas (offset 0–240) | 300 | **300** | 87–89 dias |

As duas linhas do meio são as que decidiram o desenho:

- **Sem o `asc`, a primeira página do anônimo era ZERO de 60.** O padrão da API
  é o mais novo primeiro, e o mais novo é exatamente o que ele não pode ver.
  Um corte local puro devolveria lista vazia na busca mais comum.
- **Sem a janela, o `asc` traz lixo arqueológico:** as 5 primeiras linhas vinham
  com `posted_at` de `1970-01-01`, `2010-03-01` e `2011-08-23`, com
  `reality: stale`. O anônimo concluiria que o produto não tem vaga.

**Por isso `JANELA_DO_ANONIMO_EM_DIAS = 90`:** a faixa 14–90 dias tem **31.369
vagas** só em LATAM (44.212 em 90 dias menos 12.843 em 14), e 78% do catálogo
tem 14+ dias. A amostra do anônimo é real, não um resto.

**Consequência boa na paginação:** como o corte é da API, o `meta.total` já vem
recortado e o `total` da tela é verdadeiro sem compensação nossa. O defeito do
JOB-45 não voltou — medido na aplicação de pé: a busca anônima por "Backend
Engineer" mostra `60 of 66.574 jobs`, e **66.574 é a janela de 90 dias**
(o catálogo inteiro é 82.657). O `POST /jobs/facets` anônimo devolve
`total: 4236` para a mesma consulta que a busca fecha com `totalNoFiltro:
4236` — o botão do modal promete o que a lista entrega.

**A guarda local ficou assim mesmo**, no `peneirar` do motor: a spec deles
avisa que *"some boards restate this date on every crawl"*, então a API corta o
volume e o `velhaOBastante` corta o que escapar. Vaga sem `posted_at` **não
passa** — o lado seguro do desconhecido.

### Onde a política mora

`backend/src/jobs/limites-anonimos.ts`, novo: um objeto `LimitesDaBusca` com as
duas restrições juntas, e `limitesDe(usuario)` traduzindo "quem é" em "o que
pode". O controller é o único lugar que lê o `@CurrentUser()`; o serviço recebe
a política pronta.

**Os limites são gravados na SESSÃO de paginação**, não reenviados pela tela: o
`MaisVagasPedidoDto` manda só o id, então a página 2 herda a restrição da
página 1 e um cliente anônimo não tem onde se declarar logado.

**A barreira da cascata** fica depois do freehire e antes de tudo que custa, e
termina em `fim` e não em `erro` — zero vaga não é falha, e "Search failed"
para uma busca que funcionou faria a pessoa tentar de novo.

### Números

| | antes | depois |
| --- | ---: | ---: |
| Testes backend | 391 | **429** (+38) |
| Testes frontend | 350 | **361** (+11) |
| Rotas registradas | 59 | 59 |
| Rotas públicas | 7 | **7** (nenhuma nova) |
| Rotas `@SessaoOpcional()` | 1 | **3** |
| Rotas protegidas | 51 | 49 |
| Bundle principal | 327 KB | 327 KB |

Os pisos do `fail-closed.e2e.spec.ts` **não foram afrouxados** (`>50` rotas,
`>40` protegidas). As duas rotas que saíram da contagem de protegidas não
ficaram abertas: mudaram de lista, e o bloco de opcionais as nomeia uma a uma.

### Um defeito de infraestrutura que o card destravou

A quinta suíte e2e fez o `npm test` **falhar por contenção**, não por lógica:
cada suíte roda `npx prisma migrate deploy`, e com os workers livres as de
timeout mais curto (120s) estouravam o `beforeAll`. **Quais estouravam mudava a
cada rodada** — `recursos`, depois `superficie`, depois `perfil` +
`auth.service.banco` —, o que faz a falha acusar sempre o código errado; as
mesmas suítes passavam sozinhas em 7s.

| workers | resultado |
| --- | --- |
| livre | 2–3 suítes falhando, 28–58 testes, 284–484s |
| 2 | instável: 38s uma vez, falhou em 284s depois |
| **1** | **18 suítes, 429 testes, 47s** |

`maxWorkers: 1` no `package.json`, com o porquê no CLAUDE.md. **Serial é mais
rápido que paralelo aqui**: o gargalo é I/O de migration disputado, não CPU.

### A tabela de mutações

Toda correção foi vista falhar com o código quebrado de propósito.

| # | mutação | efeito |
| ---: | --- | --- |
| 1 | `@Public()` no lugar de `@SessaoOpcional()` na busca | **8 testes** quebram, incluindo os dois de token inválido |
| 2 | barreira do anônimo removida (cascata cai no pago) | 2 quebram (ATS/IA alcançados) |
| 3 | `limitesDe()` invertido | 9 quebram |
| 4 | corte de idade do `peneirar` desativado | 2 quebram ¹ |
| 5 | sessão devolve limites permissivos | 3 quebram ¹ |
| 6 | `order=desc` em vez de `asc` | 2 quebram |
| 7 | vaga sem data passa no corte | 1 quebra |
| 8 | fronteira deslocada um dia (`>` em vez de `>=`) | 1 quebra |
| 9 | `abrir()` ignora os limites recebidos | 2 quebram |
| 10 | convite ignora a sessão (aparece para quem entrou) | 1 quebra |
| 11 | convite sem a guarda de lista vazia | 1 quebra ¹ |
| 12 | convite removido da tela | 2 quebram |
| 13 | a busca volta a exigir login na `VagasPage` | 1 quebra |
| 14 | anônimo alcança a aba Saved | 2 quebram |
| 15 | `@SessaoOpcional()` removido (contra o `qa-rapido.py`) | `busca anonima responde 201 (deu 401)` |
| 16 | `main#conteudo` renomeado na `VagasPage` | 1 quebra (contrato do skip link) ² |

² A 16 também mostrou um **buraco pré-existente**: o `App.rotas.spec.tsx` usa
`findByRole('main')`, que casa com a tag e **não** com o `id`, então ele passa
com o contrato quebrado. Quem pega é o `VagasPage.spec.tsx` novo, que afirma
`id` e `tabIndex` explicitamente. O buraco não foi alargado nem fechado aqui —
fica registrado.

¹ **Três mutações SOBREVIVERAM na primeira tentativa**, e corrigir isso foi o
trabalho que mais valeu:

- **4 e 5 passaram com 17/17 verdes.** A causa era de desenho: o dublê do
  freehire na suíte e2e **reimplementava o corte**, então o teste media o dublê
  e não o `peneirar` de produção. Nasceu daí a
  `limites-anonimos.spec.ts`, que dubla o **`fetch`** em vez do serviço — todo o
  código real do motor roda, e a resposta crua traz uma vaga de 2 dias no meio
  para provar que ela não sai. A e2e ganhou um aviso dizendo o que ela **não**
  prova, com a divisão de trabalho entre os dois arquivos numa tabela.
- **11 sobreviveu** porque o único caso de lista vazia que eu testava já era
  impossível (o convite vive dentro de `vagas.length > 0`). O teste que faltava
  é o da lista esvaziada **pelo recorte** — busca achou, "New (0)" esconde — e
  é o único caso em que a guarda faz trabalho de verdade.

### No navegador (critério final)

Janela limpa, `localStorage` vazio, `AUTH_DISABLED=false`, **nos dois temas**:

- `/` monta a busca para quem não entrou — barra, filtros e `main#conteudo`.
- Busca real por "Backend Engineer": **60 vagas**, todas "2 months ago", de
  VTEX, Deepgram, AmaWaterways. Nenhuma com menos de 14 dias nas 30 primeiras
  linhas conferidas.
- **A estrela não aparece** para o anônimo (0 botões de salvar) — em vez de
  aparecer e falhar no clique.
- O convite fecha a lista, **depois da paginação**: "Seeing jobs from two weeks
  ago", com o texto que diz o que se ganha. Título em `rgb(15,20,17)` no claro
  e `rgb(246,248,247)` no escuro — nada de dourado sobre fundo claro.
- `/salvas` anônimo: "**Sign in to save jobs**" e "Searching needs no account —
  only saving does". Nunca "Unauthorized".
- Console sem erro inesperado (os dois 401 de `/jobs/saved` e
  `/settings/recursos/produto` são o caminho tratado: a estrela some e o
  histórico fica `null`).
- O **invoice continua funcionando** (`3 × 33.33 = $99.99`, `1.005 → $1.01`),
  que é a regressão que o CLAUDE.md manda conferir.

### O que NÃO foi feito, e por quê

- **O `/jobs/facets` passou a respeitar os limites**, o que o card não pedia
  explicitamente. Sem isso o modal do anônimo prometeria o catálogo inteiro
  (`Show 82.657 jobs`) e a lista entregaria a faixa recortada — o defeito do
  JOB-45 por outra porta. Está medido acima: 4.236 nos dois lados.
- **Não há rate limiting**, e ele continua não existindo. A decisão do
  stakeholder ("anônimo só no freehire") é o que torna isso seguro hoje: a rota
  aberta só alcança API pública e gratuita. Se um dia o anônimo puder tocar
  motor pago, o rate limiting vira pré-requisito — não é escopo deste card, mas
  é a premissa dele.
- **Dois erros de `tsc` em `src/jobs/grupo.spec.ts` já existiam** antes deste
  card (`excluded_keywords` por `exclude_keywords`, linhas 127 e 130),
  confirmados em árvore limpa. Não foram tocados: não são deste card, e
  corrigi-los no mesmo commit esconderia a mudança de verdade.
