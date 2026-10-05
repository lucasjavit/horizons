# Kanban — Horizons

Um arquivo por card em [cards/](cards/). Este arquivo é o quadro: mover um
card é mover a linha de coluna, e atualizar o campo **Estado** dentro do
arquivo dele.

Prefixos: `INV` invoice · `LRN` trilhas · `PLT` plataforma (login, infra,
umbrella) · `JOB` busca de vagas · `APP` interface · `QA` testes.

**O ciclo não tem atalho** (01/09): card → desenvolvimento → teste → commit.
Não se desenvolve sem card, não se commita sem teste, e card só fecha com teste
passando. Está no CLAUDE.md.

---

**Sprint atual:** [02 · Achar vaga](sprints/02-achar-vaga.md) (13/08 – 27/08)
— dar dono às contas e fazer a busca de vagas rodar sozinha.

A decisão do login **saiu**: Google Sign-In, portado do arguição. É o que
destrava o resto.

## Backlog

**A ordem é de dependência, não de preferência** — e hoje o backlog tem duas
coisas diferentes dentro dele:

- **A cadeia do rastreador** (JOB-49 → 50 → 51 → 52/53): a independência de
  verdade, desenhada e decidida em 01/10. É sequencial — o JOB-50 abre, e
  nenhum filho começa antes do pai.
- **Os cards soltos**, que não dependem de nada e podem entrar a qualquer
  momento.

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| [JOB-42](cards/JOB-42-alerta-de-busca-salva.md) | **A busca salva dispara alerta** — hoje ela é guardada e nunca consultada | M | **adiado** (01/10) — e a nota antiga daqui estava errada: ela dizia que o interruptor "promete o que não acontece", mas **medido em 01/10 ele não existe na tela** (nenhum componente chama `definirCanaisDaBusca`). É feature que falta, não defeito no ar — adiar não deixa nada mentindo |
| [APP-03](cards/APP-03-revisar-motion-effects.md) | **Revisar motion effects e referências de interface** | P | revisão, não implementação — 5 fontes copy-paste/open-source; `prefers-reduced-motion` é eliminatório, e o `invoicegenerator.io` entra como concorrente |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos, histórico e duplicar do mês passado | G | **destravado** (13/08) — o login existe; falta decidir se ainda vale, já que o INV-14 entregou o histórico local |
| [PLT-04](cards/PLT-04-crud-de-prompts.md) | Config vira área de admin, com CRUD dos prompts de busca | M | agora tem `@AdminOnly()` de verdade por trás |
| [JOB-08](cards/JOB-08-prompt-de-busca.md) | O prompt do stakeholder vira o motor da busca | G | o descarte de vaga aberta caiu com o JOB-10; sobram os **sete níveis de elegibilidade** e o **dedup** |
| [JOB-04](cards/JOB-04-tela-de-vagas.md) | A tela das vagas encontradas | M | **em andamento** (15/08) — refeita no formato RemoteYeah: 8 dropdowns + linhas densas, formulario de perfil removido da pagina; falta fuso/overlap e "o que falta no perfil" |
| [JOB-19](cards/JOB-19-produto-dois-lados.md) | **O produto tem dois lados** — alvo vira país emergente; empresa vira cliente | G | decidido (18/08) — 501 empresas contratam em emergentes, contra 118 só do Brasil |
| [JOB-17](cards/JOB-17-catalogo-de-ats.md) | Catálogo de 1.953 empresas do look4job + API de ATS grátis | M | medido (18/08) — 199 vagas numa chamada, mas só 4 de 771 eram BR/LATAM |
| [JOB-12](cards/JOB-12-url-de-vaga-nao-se-valida-por-status.md) | URL de vaga não se valida por status HTTP | P | preventivo — conferido em 25/08: nenhum ponto trata `200` como "vaga existe", e `applicationUrl` continua sem ser exibido. **Aberto de propósito**, como aviso para quem for implementar |
| [JOB-49](cards/JOB-49-rastreador-de-vagas-arquitetura.md) | **Rastreador de vagas: a arquitetura** — card-mãe. Aplicação à parte, com banco próprio, que rastreia os ATS por agenda e **envia** as vagas ao Horizons; a busca lê só da cópia local | G | **decidido, em backlog** (01/10) — o stakeholder ainda tem outras coisas na frente. fecha os dois buracos que o JOB-40 deixou: os 128s do ATS ao vivo e o anônimo com 0 vaga sem o freehire. O ATS ao vivo **não sai**: fica como reserva, no interruptor `jobs.ats` que já existe |
| [JOB-50](cards/JOB-50-ingestao-de-vagas-rastreadas.md) | **O Horizons recebe vagas rastreadas** — tabela nova + `POST /api/ingest/jobs` (upsert, confirmar, fechar) + limpeza por prazo | M | primeiro da fila: dá para construir e testar com `curl`, sem o rastreador existir. O token tem de valer **mesmo com `AUTH_DISABLED=true`** |
| [JOB-51](cards/JOB-51-rastreador-rastreio-e-fila-de-envio.md) | **O rastreador: rastreio por agenda e fila de envio** — banco próprio, fechamento após 48h sem ver a vaga, fila que só esvazia com o aceite | G | depende do JOB-50. Herda 526 + 457 empresas; repositório próprio |
| [JOB-52](cards/JOB-52-busca-le-da-copia-local.md) | **A busca lê da cópia local** — motor novo na frente da cascata, usado também pelo anônimo e pela busca agendada | M | depende do JOB-50 e do JOB-51. Traz a medição cópia local × freehire × ATS ao vivo |
| [JOB-53](cards/JOB-53-colheita-muda-para-o-rastreador.md) | **A colheita muda para o rastreador** — hoje ela só aprende quando alguém busca; com a cópia local na frente, a fila pararia de encher | M | depende do JOB-51, e carrega o JOB-48 junto |

## Bugs

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| [INV-19](cards/INV-19-total-sai-da-folha.md) | **O TOTAL DUE sai da folha** — com 16 itens a caixa do total é desenhada em y=302mm numa folha de 297, e o PDF sai sem total; com 14 e 15 ela cobre o rodapé | P | achado medindo o INV-18; `it.fails` em `pdf.spec.ts` |
| [INV-20](cards/INV-20-rolagem-horizontal-no-celular.md) | **`/invoice` rola de lado no celular** — a 390px a página mede 447px com endereço longo e 704px com `Invoice #` e link compridos | P | achado medindo o INV-18; causa não isolada |

**A raia dos defeitos encontrados por teste** (01/09/2026). Bug achado vira
card aqui, com o teste que o pegou — e o teste entra no repositório mesmo antes
da correção, marcado como conhecido. Um defeito medido e não registrado volta.

| Card | Título | Tam. | Onde |
| --- | --- | --- | --- |
| [JOB-48](cards/JOB-48-host-multiempresa-colapsa-numa-linha.md) | **Host multiempresa colapsa todas as empresas numa linha** — achado medindo o JOB-40. `extrair()` só tira slug do caminho para greenhouse/lever/ashby; em qualquer outro host com vários inquilinos o slug vira `''`, e a chave da fila é `(host, slug)`. Medido: `jobs.smartrecruiters.com` tem **1 linha com 18.560 aparições** e o slug estava na URL. Idem `mycareersfuture.gov.sg` (15.153), `europa.eu` (5.089), `jobs.dayforcehcm.com` (4.334). Importa porque `aparicoes` é **o número que decide** se vale escrever um adaptador, e para esses hosts ele mede inquilinos, não vagas | P | `backend/src/jobs/descobertas.ts` |

## Pronto para fazer

**O motor de ATS já foi** (JOB-20, JOB-40): a busca com sessão sobrevive sem o
freehire — 0 → 682 vagas, medido. O que sobrou são os dois buracos que o JOB-40
registrou, e os dois têm a mesma causa: **rastreamos na hora da busca**.

| Card | Título | Tam. | Por que agora |
| --- | --- | --- | --- |
| [JOB-50](cards/JOB-50-ingestao-de-vagas-rastreadas.md) | **O Horizons recebe vagas rastreadas** — a rota de ingestão e a cópia local | M | **abre a cadeia do rastreador**, e é o único que não depende de ninguém. Sem ele o JOB-51 não tem onde entregar. A arquitetura está decidida no [JOB-49](cards/JOB-49-rastreador-de-vagas-arquitetura.md) |

## Esperando decisão

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| [JOB-18](cards/JOB-18-niveis-de-busca.md) | Três níveis de busca, e o que sustenta o nível pago | G | a vantagem defensável é **catálogo + tempo + acúmulo**, não profundidade de leitura; três decisões travam, e **as duas primeiras são medição, não decisão** — ver JOB-28 abaixo. Ficou mais perto em 01/10: a janela de 14 dias do [JOB-47](cards/JOB-47-busca-sem-login.md) já é um esboço de nível |
| [JOB-28](cards/JOB-28-watchlist.md) | **Medir a watchlist** — destrava a segunda decisão do JOB-18 ("o Boost se sustenta?") | P | a medição nunca foi executada. Se render pouco, o nível 3 vira uma linha do nível 2 e o produto tem dois níveis, não três |

## Fazendo

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| _(vazio)_ | | | |

## Feito

| Card | Título | Quando |
| --- | --- | --- |
| [INV-21](cards/INV-21-numero-padrao-da-invoice.md) | **O número da invoice nasce `INV-ANO-MÊS`** — o campo obrigatório deixa de nascer vazio; segue editável, e rascunho guardado em branco também ganha o padrão | 05/10/2026 |
| [INV-18](cards/INV-18-campo-longo-atropela-o-pdf.md) | **Campo longo atropelava o PDF** — relatado em produção: endereço comprido num payment field saía pela margem esquerda. Rótulo e valor agora têm coluna e **quebram** (a zebra cresce junto); `Invoice #` longo recua a coluna e, no limite, empurra o resto; rodapé corta com reticências; payment details mais alto que a folha troca de página. Teste gera o PDF de verdade e confere posição: **11 falhando → 38 passando**. A prévia tinha o mesmo defeito com palavra sem espaço, corrigida junto. Dois defeitos antigos achados no caminho viraram [INV-19](cards/INV-19-total-sai-da-folha.md) e [INV-20](cards/INV-20-rolagem-horizontal-no-celular.md) | 05/10/2026 |
| [JOB-27](cards/JOB-27-tres-niveis.md) | **Os três níveis** — fechado como **duplicata do [JOB-18](cards/JOB-18-niveis-de-busca.md)**: os dois nascem da mesma frase do stakeholder (*"busca ruim gratuita / média / boost"*, 18/08). O JOB-18 ficou porque tem a arquitetura em `docs/design/` e as três decisões nomeadas. O conteúdo do JOB-27 continua valendo como análise — a parte do "eixo que não funciona" é a que vale ler | 01/10/2026 |
| [JOB-23](cards/JOB-23-filtro-moeda-forte.md) | **Filtro "paga em moeda forte"** — **descartado** (21/08): resolvido por outros meios, e estava fora do quadro desde então | 21/08/2026 |
| [JOB-29](cards/JOB-29-lado-b-empresas.md) | **Lado B — a empresa contrata do catálogo** — **fora de escopo por ora**; o lado que vale hoje é o do candidato. Mora no [JOB-19](cards/JOB-19-produto-dois-lados.md), que decidiu os dois lados em 18/08 | 01/10/2026 |
| [JOB-40](cards/JOB-40-catalogo-aprende-com-o-freehire.md) | **O catálogo aprende com o freehire** — e o card estava **meio pronto sem que ninguém soubesse**. A captura do JOB-37 envolve a busca INTEIRA (`anotar()` no `finally` do gerador de `busca.service.ts`), não um motor, então quando o JOB-39 pôs o freehire na frente da cascata a fila passou a encher sozinha: **1.297 linhas, 457 `confirmada`, 37.030 vagas atrás delas** — e **nada as lia**. O que faltava era só a outra ponta, e é o que este card entrega: `BuscaAtsService` passou a unir `empresas.json` + as confirmadas do banco, deduplicando por `(ats, slug)` com o arquivo ganhando o empate. **447 → 672–686 vagas na busca ampla (+53%)** e **35 → 109–115 em "Backend Engineer" (+217%)**, **no mesmo tempo e com as mesmas 200 consultas** — o `TETO_EMPRESAS` não mudou; mudou *quais* 200. **A ordem é a feature, e as duas variantes foram compiladas e medidas no ar**: anexar as 453 no FIM da lista dá **451** vagas (o baseline é 447), porque o `escolher` corta por posição e nunca chega nelas; na frente dá 682. Pôr na frente não é preferência — o arquivo é alfabético (o próprio código diz que essa ordem "não diz nada") e a confirmada traz `vagas` **medido contra a API real**, o único sinal de vivacidade do catálogo. **O LATAM não melhorou (95 → 96), e foi deixado assim de propósito**: `escolher` ordena por `contrataEm.length` e a colheita não sabe em que países a empresa contrata — chutar "latam" em 453 empresas encheria o filtro de vaga que não aceita quem mora aqui, e o JOB-20 mediu que esse campo vale 1 elegível em 1.961 contra 144 em 1.229. **Teste de independência: com sessão, 0 → 682 sem o freehire; anônimo continua em 0**, e isso é o desenho do JOB-47 (a cascata para em `somenteFreehire` antes do ATS), não regressão — mas fica dito que **metade do objetivo do stakeholder não foi alcançada**. **As 761 `desconhecida` foram classificadas**: 306 site próprio, **184 workday**, 41 oracle, 37 agregador, e os brasileiros que o card pedia somam **52 empresas / 287 aparições** — gupy, inhire e solides **não têm API pública** (medido: `portal.gupy.io` e `radix.inhire.app` devolvem HTML, `api.inhire.app` dá 406), então ler os três exigiria raspagem, que é o oposto do que este motor é. Os 27 com ATS conhecido **não são bug de parsing**: `greenhouse:clickhouse`, `:zenvia`, `:wiz` dão 404 de verdade na API. Backend **429 → 477** (+48: o catálogo, e o extrator de descobertas, **que o JOB-37 entregou sem teste nenhum**, agora com URLs reais da tabela de produção). **20 mutações, 20 mataram teste** — e **duas ensinaram antes**: a de estado matou só 1 de 4 porque três testes usavam o `vagas` realista e quem os barrava era o `vagas > 0`, não o filtro de estado que diziam testar; e três mutações do extrator "passaram" numa rodada em que o escape da regex no shell **não escreveu a mutação**, saída indistinguível de mutação sobrevivente. Um defeito saiu da escrita dos testes (`slugTestado: ''` passa pelo `not: null` e montaria `/boards//jobs`) e outro da medição (**JOB-48**, na raia Bugs). No navegador, nos dois temas: **684/680 jobs found**, zero erro de console, e as três primeiras vagas são de `redbee`, `allarahealth` e `openloophealth` — **nenhuma no `empresas.json`**. **O ganho vive no banco, não no git**: as 453 não foram promovidas para o arquivo (decisão do JOB-37: promoção é humana), então ambiente novo volta a 447 | 01/10/2026 |
| [JOB-47](cards/JOB-47-busca-sem-login.md) | **A busca funciona sem login** — `POST /jobs/search` e `/search/mais` viraram **`@SessaoOpcional()`, e não `@Public()`**: token inválido continua dando 401 em vez de virar anônimo em silêncio, que faria sessão expirada parecer busca com metade do acervo. O anônimo alcança **só o motor freehire** (API pública, custo zero garantido — o projeto não tem rate limiting, e rota aberta que chegue ao pago é um script contra a chave) e **só vaga com 14+ dias**, porque o valor do cadastro é chegar primeiro na vaga nova. **A API deles NÃO tem corte invertido** — os seis nomes tentados (`posted_before_days`, `posted_after_days`, `posted_min_days`, `posted_older_than_days`, `posted_at_before`, `min_age_days`) voltaram todos em `ignored_params` com o total intacto em 58.782. O corte saiu de `posted_within_days=90` + `sort=posted_at&order=asc`: a ponta velha da janela, **300 de 300 linhas com 14+ dias** em 5 páginas. As duas medições que decidiram o desenho: **sem o `asc` a primeira página do anônimo era ZERO de 60** (o padrão da API é o mais novo primeiro), e **sem a janela o `asc` traz `posted_at` de 1970 e 2010**, com `reality: stale`. Como o corte é da API, o `total` já vem recortado e o defeito do JOB-45 não voltou: a tela mostra `60 of 66.574` (a janela de 90d; o catálogo é 82.657) e o `/jobs/facets` anônimo devolve o MESMO 4.236 que a busca fecha. Os limites são gravados na **sessão de paginação**, não reenviados pela tela — o DTO manda só o id, então a página 2 herda a restrição e ninguém se declara logado. Backend **391 → 429**, frontend **350 → 361**; opcionais 1 → 3, públicas **7 → 7**, pisos do `fail-closed` intactos. **15 mutações, e 3 SOBREVIVERAM na primeira tentativa** — o dublê do freehire reimplementava o corte, então 17/17 passavam com o `peneirar` de produção desligado; daí nasceu a `limites-anonimos.spec.ts`, que dubla o `fetch` e roda o motor real. De quebra, a quinta suíte e2e expôs **contenção de migration** no `npm test` (suítes diferentes falhando a cada rodada, 284–484s): `maxWorkers: 1` deixou 429 testes em **47s**, mais rápido que o paralelo. No navegador, nos dois temas: 60 vagas todas "2 months ago", sem estrela, convite no fim da lista e `/salvas` dizendo "Sign in to save jobs" | 01/10/2026 |
| [PLT-13](cards/PLT-13-remover-as-trilhas.md) | **As trilhas saem da aplicação** — a umbrella passa de três produtos a dois, e **Jobs vira a home**: `/` renderiza `VagasPage` e `/vagas` continua valendo (renderiza o mesmo elemento, sem redirect, para não gastar um salto no histórico). Saíram 2 módulos do backend (`tracks`, `progress`), 7 arquivos do frontend, 15 do seed e 4 modelos do schema. **O `WARN_INK` foi movido ANTES de qualquer remoção**, e era o risco real do card: ele vivia em `components/blocks/BlockRenderer.tsx` — dentro das trilhas — e **26 arquivos** de Invoice, Jobs, Perfil e Configurações o importavam de lá; agora mora em `components/cores.ts`, e o `tsc` foi rodado limpo com a pasta `blocks/` ainda no lugar, provando a mudança isolada. Medido no navegador, nos dois temas: o texto de erro do invoice renderiza `rgb(163,74,23)` no claro e `rgb(232,137,74)` no escuro — o `light-dark()` sobreviveu —, e o PDF saiu com `3 × 33.33 = $99.99`. **O `ProgressBar.tsx` era das trilhas** apesar do nome (só `TracksPage`, `TrackPage` e `LessonSidebar` o usavam), e o `Quiz.tsx` também — os dois saíram; `Recolhivel` e `Hint`, que o nome não denuncia, **ficaram**, porque Invoice e Jobs os usam. A migration `20261001120000_remover_trilhas` aplicou no `migrate deploy` do compose e levou o banco de **19 → 15 tabelas** (`progress` → `lessons` → `modules` → `tracks`, nessa ordem por causa das FKs, mais o tipo `LessonKind`), apagando 1 trilha, 13 módulos, 75 aulas e 3 progressos; **4 usuários, 5 chaves de IA, 2 vagas salvas e 1 perfil intactos**. O seed **não** foi apagado: ele ainda cria o usuário de `DEFAULT_USER_EMAIL`, e apagá-lo repetiria o defeito de 31/08 em que 8 checagens de papel se pularam em silêncio. **Nenhum teste foi removido para fazer a suíte passar** — saíram 4 casos do `erros-do-servidor.spec.ts` porque os 3 padrões de tradução que eles cobriam (`Trilha "x" nao encontrada` e as duas de `Aula`) viraram código morto, e o teste de adoção de conta do `auth.service.banco.spec.ts` foi **reescrito, não apagado**: ele provava o PLT-03 com `progress`, e agora prova o mesmo com `savedJob`. Backend **383 → 391** (+8, novo `superficie-sem-trilhas.e2e.spec.ts`), frontend **348 → 350** (−4 de trilha, +6 do novo `App.rotas.spec.tsx`). **Os dois testes novos foram vistos falhar**: devolvendo um controller `@Controller('tracks')` ao `AppModule`, 2 dos 8 quebraram (404→200 e a descoberta); devolvendo a rota `/t/:slug` ao `App.tsx`, 3 dos 6; tirando `/` da `VagasPage`, mais 1. Os pisos do `fail-closed` **não foram afrouxados** (59 rotas contra o `>50`, 51 protegidas contra o `>40`), e as `@SessaoOpcional()` caíram de 5 para 1 — o teste do token inválido agora sai da própria lista em vez de apontar um caminho fixo, com `expect(opcional).toBeDefined()` para não passar vazio no dia em que a última sumir. Bundle principal **433 → 327 KB** (teto 440). `qa-rapido.py` passa com as checagens de trilha removidas e nenhuma outra afrouxada. O `CLAUDE.md` perdeu a seção de conteúdo e **a exceção de idioma**: a interface é em inglês, sem ressalva | 01/10/2026 |
| [APP-02](cards/APP-02-erro-do-backend-em-portugues.md) | **Erro do backend em português na interface inglesa** — a tradução mora no **frontend**, em `lib/erros-do-servidor.ts`, consumida pelo `errorMessage()` de `lib/api.ts`. É a terceira opção do card, e a medição a escolheu: `errorMessage()` é o **único** ponto que lê `message` do servidor (nenhum componente lê `response.data.message` direto; 17 arquivos o chamam), então um mapa num lugar só cobre tudo. **O backend não mudou** — o CLAUDE.md manda erro em português sem acento para o log e para quem depura, e isso continua valendo: `POST /jobs/profile/cv` com `.txt` ainda responde `"Formato nao suportado…"` na API. **O fallback repassa o português, não apaga**: frase não traduzida é ruim, mas trocá-la por "Something went wrong" é pior, porque apaga a única pista de quem depura — o mapa degrada para o estado de hoje, nunca para pior. **E não envelhece em silêncio:** o teste lê `backend/src/` do disco e falha se uma mensagem mapeada sumir de lá (acoplamento só no teste; o bundle não mudou). **Um defeito achado no caminho:** `message.join(', ')` sem filtro dava string vazia com `message: []`, e a caixa de erro aparecia **vermelha e muda** — agora cai nos genéricos. Frontend **270 → 346**, backend 383 intacto, `tsc` e `build` limpos, `qa-rapido.py` tudo certo. **13 mutações, 13 mataram teste**, e duas ensinaram antes: a ordem dos padrões de `Aula "…"` e a âncora `$` são **duas proteções independentes**, então nenhuma mutação isolada quebrava — o teste afirmava a ordem (implementação) e passou a afirmar o resultado. No navegador, sem sessão: "Something went wrong / **Sign in to continue.** / Try again" nos dois temas, e a caixa de CV com `.txt` dando "**Unsupported format. Upload your resume as a PDF or DOCX.**" — as duas linhas exatas que o card media | 01/10/2026 |
| [JOB-46](cards/JOB-46-cv-nao-preenche-o-modal-de-filtros.md) | **O currículo não preenche mais os filtros** — fechado **conferindo, não implementando**: o defeito já tinha sido corrigido em 01/09 dentro do QA-04, e o card ficou aberto por um mês. O `aoLerCv` passou a escrever em `avancadosDaBarra` — **o mesmo estado que o modal renderiza** — e a contagem virou derivada dele, que é literalmente a regra que o card exigia: *"a contagem tem de sair do que está marcado na tela"*. Não há mais como o número divergir, porque não há mais dois estados. **Três defeitos que o card não previa** apareceram no caminho, todos de vocabulário: o cargo ia para `roles` (faceta fechada) em vez de `job_titles` (full-text) — `roles=["Backend Engineer"]` devolvia **0** vagas contra **80.403** —, a senioridade ia em português (`pleno`) contra o `middle` da faceta, e a stack sem corte batia no `ArrayMaxSize(20)` do DTO com **400** na tela. O primeiro é o instrutivo: **o zero não dava erro**, e filtro que não casa com nada é indistinguível, na resposta, de motor fora do ar — o modal lia isso como "indisponível" e abria vazio. Verificado hoje na aplicação de pé: `POST /jobs/facets` com o que o CV produz → **201 e 26.320 vagas** com `seniority: senior`, que é exatamente o caso que antes zerava; 31 testes passando. **O selo `CV` foi cortado com razão registrada** — ele existia para permitir desmarcar o que a IA errou quando o estado era invisível, e hoje os valores do currículo são chips removíveis como qualquer outro; o que sobraria é saber *de onde veio*, que é feature e não correção | 30/09/2026 |
| [QA-04](cards/QA-04-testes-de-listavagas.md) | **`ListaVagas` e a lógica pura do Invoice** — frontend **139 → 269 testes** (4 → 8 arquivos, 4,4s). Fecha a lacuna que o QA-03 nomeou: a tela principal do produto, 1.053 linhas, estava sem um teste. **31 testes cobrem os três bugs medidos do card** — a escolha da pessoa sumindo quando o upload do CV volta, o selo `CV` mentindo depois de `Clear all`, e a contagem divergindo dos selos —, mais o que **viaja na busca** (que é onde o bug de filtro faz estrago de verdade: o valor invisível que vai para o servidor). Outros 99 cobrem `invoice/validate.ts`, `storage.ts` e `history.ts`, a lógica pura que sobrou do QA-01. **23 mutações, 23 mataram teste** — e duas ensinaram antes disso: contar **eixos** em vez de **valores** sobreviveu, porque todo teste usava um valor por eixo, que é exatamente a forma do bug medido ("3 filters" com oito selos); e remover a **cópia profunda** do histórico sobreviveu ao teste que parecia mais forte, porque ele relia com `loadHistory()` e o round-trip pelo JSON do `localStorage` corta a referência sozinho, escondendo o defeito. Nos dois casos o erro estava no teste, e só apareceu porque a mutação foi rodada. **A armadilha de corrida do card não se repetiu:** toda espera é pelo valor que o efeito gravou (o botão que só existe depois de `recursosDeProduto` resolver), nunca pela presença do nó — zero intermitência em 3 rodadas. **Um bug achado** (INV-17, na raia Bugs), com o teste no repositório antes da correção. Backend 383 intacto, `tsc` limpo, `qa-rapido.py` tudo certo, banco de desenvolvimento **4 usuários e 5 chaves** antes e depois | 01/09/2026 |
| [QA-03](cards/QA-03-camadas-2-3-4.md) | **As camadas 2, 3 e 4 da suíte** — backend **319 → 383** (15 suítes, 26,1s), frontend **110 → 139** (4 arquivos, 3,5s). A camada 3 são 64 testes em três suítes sobre o `AppModule` inteiro com `supertest`. **O teste de rota aberta faz duas perguntas diferentes**, e é aí que ele vale: a lista de públicas é conferida por **metadado** (pega a rota nova que nasceu `@Public()`) e toda rota protegida por **requisição de verdade** (pega o `AuthGuard` quebrado, que o metadado não veria). As rotas vêm da `DiscoveryService`, então **controller novo entra sozinho** — a proteção vale para o código que ainda não existe. A superfície pública são **sete** rotas e não seis: a sétima é `GET /perfil/paises`, legitimamente pública. **`AUTH_DISABLED=true` derruba a camada 3 inteira**, como devia: rodado com a variável ligada por linha de comando (sem tocar no `.env`), **63 de 63 falharam** com a razão escrita, em vez de passarem sem medir nada. **15 mutações, 13 mataram teste — e as duas sobreviventes ensinaram, sem que nenhum teste fosse afrouxado:** tirar `@AdminOnly()` de `PATCH :id/papel` não quebrava nada porque o serviço recusa o manager por conta própria (proteção em profundidade real, mas o decorador poderia sumir num refactor sem aviso — o teste novo separa as camadas **pela mensagem do guard**, e agora mata); e carregar colunas a mais no `select:` de `/usuarios` não vaza, porque o `paraDto` monta campo a campo — mutar o **mapper** vazou, e a varredura recursiva pegou em `itens[0].documentHint`. **Nenhum bug novo**, o que é resultado e não ausência: as proteções do PLT-11 e do PLT-12 estão de pé, e agora há teste que avisa no dia em que deixarem de estar. Banco de desenvolvimento **4 usuários e 5 chaves, intactos**. **`ListaVagas` ficou de fora** e virou o QA-04 | 01/09/2026 |
| [QA-01](cards/QA-01-suite-de-testes.md) | **Uma suíte de testes de verdade** — a camada 1 (lógica pura): **319 testes**, 19 mutações vistas matando teste, 1 bug achado (QA-02, o placeholder do RUT chileno). Estabeleceu a regra que as camadas seguintes herdaram: **teste real, não teste de cobertura** — cada teste é visto falhar com o código quebrado de propósito, e a tabela de mutações vai no card. As camadas 2, 3 e 4 saíram no QA-03 | 01/09/2026 |
| [PLT-11](cards/PLT-11-gestao-de-usuarios.md) | **A tela onde o dono gerencia os usuários** — sexta sub-página de Configurações, e o que torna o `MANAGER` do PLT-09 real. **A armadilha do card era o login**, e ela foi desarmada: `auth.service.ts` recalculava `role: ehAdmin ? 'ADMIN' : 'USER'` no `create` **e** no `update`, então promover pela tela seria desfeito na entrada seguinte **sem erro nenhum no log**. Agora há `papelPara(email, papelAtual)` — a variável ganha sempre, `MANAGER` do banco é preservado, o resto é `COMMON_USER`. **O teste foi visto falhar antes de passar:** com a regra antiga reinjetada, o login devolveu e **gravou** `COMMON_USER` por cima do manager; com a nova, `MANAGER` antes e depois. As quatro precedências medidas com login real (o Google recusa esta origem, então só `verifyIdToken` foi substituído — o resto do caminho é o código de produção, e `lastLoginAt` provou que o `update` rodou): manager fora da lista **fica** manager; manager que entra na lista vira `ADMIN`; admin que sai cai para `COMMON_USER` e **não** para `MANAGER`; `ADMIN` gravado à mão no banco vira `COMMON_USER`. Terceiro nível no guard (`@ManagerOrAdmin()`), checado **depois** do admin para que os dois decoradores juntos exijam o mais restritivo. **A matriz inteira com token real:** `GET /usuarios` 200/200/**403**/**401**, `PATCH /papel` 200/**403**/**403**/**401**. E as proteções chamadas direto na rota, não só escondidas na tela: virar `ADMIN` **400**, admin se rebaixar **403**, admin se desativar **403**, manager desativar admin **403**, manager desativar manager **403**, manager desativar comum **200**. As regras vivem numa função só, usada para recusar **e** para preencher `canToggleActive`/`canChangeRole` — a tela não recalcula nada, então o botão nunca aparece para um gesto que dá 403. Desativar é **imediato**, medido com o mesmo token: `/auth/me` 200 → desativa → **401** na requisição seguinte, sem esperar os 30 dias; reativar limpa o registro de quem desligou. O documento nunca entra no `select:`. **Dois defeitos achados por medir:** `sr-only` dentro de `<th>` é `position:absolute` sem bloco contido e se posicionava na borda direita da **tabela** (`right=746`), dando rolagem horizontal à página inteira em 390px apesar de a tabela já rolar no seu container — virou `aria-label`, scrollWidth 746 → **390**; e o `qa-rapido.py` **parou de testar papéis em silêncio** depois da migration (`token_de_papel("USER")` não achava ninguém e o bloco se pulava — 8 checagens mortas sem uma linha de falha). Migration com `UPDATE` **antes** do `SET DEFAULT`, e idempotente. Chunk próprio de 7.817 B, bundle servido em 358 KB (teto 440). 33 checagens de navegador + 12 de teclado/tema (18,61:1 e 17,45:1 de contraste) + **8 novas no `qa-rapido.py`** | 31/08/2026 |
| [PLT-12](cards/PLT-12-config-e-so-do-admin.md) | **`/config/*` é só do admin** — auditoria dos 15 controllers: **19 das 20 rotas de administração já estavam certas**, e faltava uma. `GET /settings/recursos` era aberto a qualquer sessão de propósito, e o comentário que justificava dizia *"só o que expõe aqui é um booleano — não há chave nem segredo nesta resposta"*. Era verdade quando foi escrito; o JOB-33 e o JOB-36 acrescentaram `provedores` (com `hint`, `status`, `httpStatus`, `checkedAt`), `ordemDaIa` e `iaDaBusca` ao mesmo DTO, e **a frase envelheceu sem que nada apontasse para ela**: usuário comum recebia os 4 últimos caracteres da chave do admin e a configuração de IA da instalação. Agora são **duas rotas com dois DTOs** — `/settings/recursos/produto` (qualquer sessão, 2 booleanos) e `/settings/recursos` (`@AdminOnly()`, 20 campos) — e **não** uma resposta filtrada por papel: um filtro subtrai do objeto inteiro, então campo novo nasce **exposto** e só deixa de ser se alguém lembrar; com dois DTOs nasce **restrito**. Medido: USER 200→**403** na rota de admin, e `{"leituraCvAtiva":true,"historicoAtivo":true}` na de produto. A aba Jobs provada no navegador (upload de CV abre, 25 × *Dismiss*, `201 /jobs/history`); as 5 sub-páginas do admin sem nenhum 4xx. De quebra 81 ms contra 549 ms. **7 checagens novas no `qa-rapido.py`, vistas falhar antes de aceitas** — a que compara o conjunto de chaves reprovou com `sobrou: ['ordemDaIa']` | 31/08/2026 |
| [PLT-09](cards/PLT-09-cadastro-em-dois-tempos.md) | **Cadastro em dois tempos, e três papéis** — o desenho que o PLT-10 e o PLT-11 executaram | 31/08/2026 |
| [QA-02](cards/QA-02-placeholder-do-rut-e-valido.md) | **O placeholder do RUT chileno era um RUT válido** — e o `it.failing` acusou a correção em vez de passar em silêncio | 01/09/2026 |
| [INV-17](cards/INV-17-historico-corrompido-derruba-o-download.md) | **Registro corrompido no histórico derrubava o download** — o histórico é conveniência, e derrubava o único desfecho da tela | 01/09/2026 |
| [PLT-10](cards/PLT-10-perfil-editavel.md) | **O perfil recebe os dados da pessoa** — segunda seção editável no perfil, com nacionalidade, telefone e documento **cifrado com salt próprio**, todos opcionais: perfil vazio é perfil válido. Validação real para 6 países (BR, MX, AR, CO, CL, PE) e caminho genérico para o resto — ninguém fica sem caminho. Trocar de país **apaga** o documento guardado em vez de aceitá-lo em silêncio, provado no banco. O `crypto.ts` foi generalizado para receber o salt (`SALT_TOKENS`/`SALT_DOCUMENTOS`) em vez de duplicado; decifrar documento com o salt dos tokens lança. **Três bugs achados por medir, não por ler:** `digitos()` apagava letras em vez de reprovar (`"CPF 123.456.789-09"` passava), o RFC mexicano aceitava 31/02, e a cédula colombiana aceitava letras. Um quarto na tela: o `placeholder` do Brasil era um CPF válido de verdade. 46 casos de validação + 27 checagens de navegador | 31/08/2026 **Segunda leva (31/08): o endereço de cobrança**, em claro e não cifrado — decisão do stakeholder que **contradiz o JOB-02** (que trata endereço no nível do CPF); a contradição está registrada no card, com a razão: em claro dá para agrupar (quantos usuários em São Paulo), a cifra impediria. Campos separados com validação frouxa, **CEP sem regra por país** (o argentino é alfanumérico desde 1998), e **país do endereço separado do país de moradia** — quem mora em Portugal e fatura no Brasil precisa dos dois. Dois defeitos achados por medir: `@MaxLength` em DTO aninhado vaza `address.City` para a tela, e o erro do endereço punha `aria-invalid` no campo do documento. 43 casos de validação + 38 de API + 29 de navegador | 31/08/2026 |
| [PLT-08](cards/PLT-08-prontidao-para-publicar.md) | **Prontidão para publicar, na tela** — quinta aba `Going live`: os quatro segredos que produção exige, como gerar cada um, e **quanto custa trocar depois** (trocar `JWT_SECRET` desloga todo mundo; trocar `ENCRYPTION_KEY` torna ilegível toda chave de IA já cadastrada). Mostra o estado real do servidor sem expor nenhum valor — só booleano e comprimento. Achou um bug próprio: ler `POSTGRES_PASSWORD` da API diria "Not set" em produção correta, porque a senha só chega pela `DATABASE_URL`. **28/08:** ganhou o **guia de publicar em 9 passos**, cada um ligado ao que o servidor já verificou (5 verificáveis, 4 marcados *"a confirmação é sua"* — Coolify, TLS, build do front, requisição de fora). O `docs/DEPLOY.md` passou a **apontar para a tela** em vez de repetir os passos; ficou com o diagnóstico e o histórico. Segundo bug achado: `NODE_ENV` é `production` **nos dois compose**, então o aviso de "não é produção" ficaria apagado justo na máquina de desenvolvimento. Recolhido custa +4,9% de altura, contra 2,1× se aberto | 28/08/2026 |
| [JOB-45](cards/JOB-45-paginacao-sob-demanda.md) | **Paginação sob demanda** — a busca devolvia 60 vagas de 400 mil e parava ali. Agora `Load more jobs` traz as 60 seguintes por `offset`, num cache de 10 min no servidor (teto de 300/sessão, chave = todos os filtros normalizados). A primeira página não mudou de tempo (2,34s → 2,39s). De quebra, achou duas vagas com `public_slug` diferente e a **mesma URL** na resposta da API — deduplicado no motor | 27/08/2026 |
| [JOB-44](cards/JOB-44-console-de-busca.md) | **O console de busca** — a barra vira duas faixas num quadro só, e todo filtro ativo aparece como chip removível. Corrige a hierarquia invertida (`All filters` tinha 38px contra 125px do `Location`; a lupa de buscar, 32px) e a ordem em 390px, onde o campo de texto era o terceiro elemento. O botão órfão de 160px sumiu | 27/08/2026 |
| [JOB-43](cards/JOB-43-barra-de-busca-do-topo.md) | **A barra de busca do topo** — Location, texto livre, filtros com badge, sino, tema e menu. De quebra, as páginas viraram chunks: o bundle principal caiu de 438 para **412 KB** | 26/08/2026 |
| [JOB-41](cards/JOB-41-modal-de-filtros-avancados.md) | **Modal de filtros avançados** — 11 categorias, chips de três estados com contagem ao vivo, busca por seção e buscas salvas. O QA achou **8 defeitos em duas rodadas**, todos corrigidos; o mais instrutivo foi o `.catch()` que disfarçava bug nosso de motor fora do ar | 26/08/2026 |
| [JOB-39](cards/JOB-39-freehire-como-motor-de-busca.md) | **freehire.me vira o PRIMEIRO motor de busca** — API pública sem chave. Entrou como fallback e a medição virou a mesa: **60 vagas em 2,6s contra 1–15 em 128s** do ATS, que passou a ser a rede de segurança | 26/08/2026 |
| [JOB-36](cards/JOB-36-tela-de-provedores-de-ia.md) | **Configurações vira quatro telas** — `/config` (864 linhas) dividida com barra de abas, e a de IA ganha painel de saúde com verificação de chave por trás (401 ≠ 429). Achou duas coisas no primeiro uso real: o modelo do Gemini estava aposentado (404) e `maxTokens: 16` reprovava chave boa | 25/08/2026 |
| [JOB-33](cards/JOB-33-cadeia-de-ia.md) | **Cadeia de provedores de IA** — 6 provedores encadeados por capacidade (3 fazem busca, 6 fazem extração), 4 gratuitos sem cartão; paga a dívida da queda por chave recusada do JOB-02 | 25/08/2026 |
| [JOB-32](cards/JOB-32-telegram-como-canal.md) | **Telegram como segundo canal** — entrega sem domínio próprio; falta token real de bot | 24/08/2026 |
| [JOB-07](cards/JOB-07-busca-ao-vivo.md) | **A busca ao vivo** — Filter dispara a busca, vagas entram uma a uma | 15/08/2026 |
| [JOB-06](cards/JOB-06-token-do-firecrawl.md) | Token do Firecrawl em Configurações | 15/08/2026 |
| [JOB-34](cards/JOB-34-extracao-de-vaga-fora-do-firecrawl.md) | **A extração sai do Firecrawl** — markdown + cadeia; 5 créditos → 1 por página, e o trecho de origem passa a ser conferível | 26/08/2026 |
| [JOB-38](cards/JOB-38-schema-da-vaga-rejeitado-por-openai-e-anthropic.md) | **`SCHEMA_VAGA` recusado por OpenAI e Anthropic** — `required` incompleto; 6m40s → 1m43s | 26/08/2026 |
| [JOB-37](cards/JOB-37-catalogo-aprende-sozinho.md) | **O catálogo aprende com o que a busca encontra** — mecanismo pronto; a hipótese que o justificava era **falsa**, e a medição está no card | 25/08/2026 |
| [JOB-35](cards/JOB-35-schema-do-cv-rejeitado-pela-anthropic.md) | **O schema do CV era recusado pela Anthropic** — `enum` com `null` sob `type` composto, escondido atrás de um 401 | 25/08/2026 |
| [JOB-02](cards/JOB-02-perfil-de-busca.md) | **Leitura de currículo** — sobe o CV e os filtros se preenchem, editáveis, com selo de origem | 25/08/2026 |
| [APP-01](cards/APP-01-cabecalho-vaza-no-celular.md) | O cabeçalho vazava a largura da tela no celular, medido em 390px | 15/08/2026 |
| [JOB-11](cards/JOB-11-listagem-dentro-do-ats.md) | **Listagem dentro do ATS** — resolvido por outro caminho: o motor de ATS monta a URL pelo id do anúncio | 25/08/2026 |
| [JOB-26](cards/JOB-26-historico-do-usuario.md) | **Histórico** — selo "New", descartar com Undo/Restore, filtro All/New/Dismissed | 24/08/2026 |
| [JOB-32](cards/JOB-32-telegram-como-canal.md) | **Telegram como canal** — entrega sem domínio nem DNS; falta token real de bot | 24/08/2026 |
| [JOB-24](cards/JOB-24-email-semanal.md) | **O e-mail semanal** — só vagas novas, com trecho; não manda e-mail vazio. Provedor desligado: registra no log até haver SMTP | 24/08/2026 |
| [JOB-25](cards/JOB-25-consegui-a-vaga.md) | **Botão "consegui a vaga 🎉"** — uma vaga por mês em vez de semanal, sem login; métrica de contratados para o admin | 24/08/2026 |
| [JOB-10](cards/JOB-10-consultas-dirigidas.md) | **A busca mira os ATS** — 8 URLs viram 8 vagas, contra 8 → 6 | 17/08/2026 |
| [JOB-09](cards/JOB-09-vaga-so-afirma-o-que-cita.md) | **A vaga só afirma o que cita** — fim do "não contrata brasileiro" sem fonte | 17/08/2026 |
| [JOB-05](cards/JOB-05-salvar-vaga.md) | **Salvar vaga** — estrela + painel "Saved jobs"; sai da regra dos 15 dias | 21/08/2026 |
| [JOB-03](cards/JOB-03-busca-em-segundo-plano.md) | **A busca roda sozinha** — a cada 50 min, desligada por padrão | 21/08/2026 |
| [JOB-31](cards/JOB-31-origem-da-empresa.md) | **Company origin** — empresa do seu país contratando para fora | 21/08/2026 |
| [JOB-22](cards/JOB-22-paises-elegiveis.md) | **`paisesElegiveis[]`** — "worldwide" e "LATAM" deixam de ser o mesmo `true` | 20/08/2026 |
| [JOB-30](cards/JOB-30-porte-da-empresa.md) | **Startup ou empresa grande** — filtro Company type; 7× mais vagas elegíveis | 19/08/2026 |
| [JOB-21](cards/JOB-21-elegibilidade-por-campo.md) | **Elegibilidade por campo** — 95,6% sem IA, zero falso positivo | 19/08/2026 |
| [JOB-20](cards/JOB-20-motor-de-ats.md) | **Motor de ATS** — 45 vagas por R$ 0 contra 7 por 42 créditos | 19/08/2026 |
| [JOB-15](cards/JOB-15-escolha-da-ia.md) | **Escolher a IA da busca** — Claude ou ChatGPT, com fallback; 15 vagas contra 7 | 18/08/2026 |
| [JOB-14](cards/JOB-14-interruptor-do-firecrawl.md) | **"Ativar Firecrawl"** — desligado passa a busca para a IA, em vez de parar tudo | 18/08/2026 |
| [JOB-13](cards/JOB-13-busca-pela-ia.md) | **Busca pela IA** — segundo motor, com `web_search`; falta chave real para conferir | 18/08/2026 |
| [PLT-06](cards/PLT-06-deploy-no-coolify.md) | **Deploy no Coolify** — no ar em HTTPS, com login funcionando | 15/08/2026 |
| [PLT-07](cards/PLT-07-leitura-anonima.md) | **Leitura anônima** — home aberta, login na barra | 14/08/2026 |
| [PLT-05](cards/PLT-05-login-desligado.md) | **Login desligado** por `AUTH_DISABLED` — reverter antes de publicar | 14/08/2026 |
| [PLT-02](cards/PLT-02-login-com-google.md) | **Login com Google** — guard global *fail closed*, revogação imediata | 13/08/2026 |
| [PLT-03](cards/PLT-03-migrar-contas-existentes.md) | Contas do guard antigo adotadas por e-mail, sem duplicar | 13/08/2026 |
| [JOB-01](cards/JOB-01-provar-o-firecrawl.md) | Firecrawl provado — viável, e o prompt é o que decide | 13/08/2026 |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos e histórico — **substituído** pelo PLT-02 e INV-14 | 13/08/2026 |
| [PLT-01](cards/PLT-01-tokens-de-api.md) | Tela de configurações com tokens de API, cifrados | 13/08/2026 |
| [INV-16](cards/INV-16-logo-da-empresa.md) | Logo da empresa, com opção preto e branco | 13/08/2026 |
| [INV-15](cards/INV-15-campo-numerico-so-aceita-numero.md) | Campo numérico aceitava letra (`1eee`) | 13/08/2026 |
| [INV-14](cards/INV-14-historico-local.md) | Histórico de invoices no navegador | 13/08/2026 |
| [INV-13](cards/INV-13-campos-de-pagamento.md) | Pagamento em campos renomeáveis, não em texto livre | 13/08/2026 |
| [INV-12](cards/INV-12-reordenar-blocos-e-bandeiras.md) | Blocos reordenados, Payment/Notes separados, bandeiras | 13/08/2026 |
| [INV-11](cards/INV-11-virgula-decimal-multiplica-por-100.md) | **Vírgula decimal multiplicava por 100** — a moeda desempata | 13/08/2026 |
| [INV-09](cards/INV-09-redesenho-da-tela.md) | Redesenho: prévia ao vivo, acordeão, buraco resolvido | 12/08/2026 |
| [INV-05](cards/INV-05-retry-impossivel-apos-falha.md) | Retry após falha de rede — resolvido com `<script>` clássico | 13/08/2026 |
| [INV-06](cards/INV-06-foco-perdido-no-teclado.md) | Foco volta ao botão ao baixar por teclado | 12/08/2026 |
| [INV-08](cards/INV-08-empresa-em-modal.md) | Cadastro de empresa em modal + select | 12/08/2026 |
| [INV-01](cards/INV-01-total-negativo.md) | Rejeita quantidade e valor negativos | 12/08/2026 |
| [INV-02](cards/INV-02-numero-grande-vira-zero.md) | Teto de 1.000.000 por campo, com aviso | 12/08/2026 |
| [INV-03](cards/INV-03-clique-repetido-gera-varios-pdfs.md) | Clique repetido gera vários PDFs | 12/08/2026 |
| [INV-04](cards/INV-04-pdf-com-dados-antigos.md) | PDF com dados antigos ao editar durante a geração | 12/08/2026 |
| [INV-07](cards/INV-07-status-preso-em-baixado.md) | Status preso em "Invoice downloaded." | 12/08/2026 |
| — | Gerador de invoice, camada 1 (formulário, PDF, rascunho local) | 12/08/2026 |
| — | Trilhas, progresso e 75 aulas autorais de System Design | 11/08/2026 |

---

## O que trava o resto

**Nada.** O app está no ar em HTTPS, com Let's Encrypt válido, e o login com
Google funciona (15/08/2026, [PLT-06](cards/PLT-06-deploy-no-coolify.md)).
Era o que travava desde o começo.

`https://ojxqz4v8x7jda764e6p3k419.169.58.152.158.sslip.io`

Verificado no ar: rotas privadas em 401, `quadro.json` em 404, leitura anônima
sem vazar progresso, e zero erro de console nos dois temas.

O que mudou de estado:

- **O guard stub acabou** (13/08). `x-user-email` responde **401** — medido.
  Os tokens de API do PLT-01 têm dono de verdade.
- **`AUTH_DISABLED` era temporário e valia só em rede local.** Em produção o
  login está exigido; o default virou `false` nos dois compose, então esquecer
  a variável fecha o acesso em vez de abrir.
- **A leitura passou a ser anônima** (14/08, [PLT-07](cards/PLT-07-leitura-anonima.md)):
  trilhas e aulas abrem sem login, e o botão do Google fica na barra. Progresso
  e anotação continuam exigindo sessão.

**Falta conferir o que está no ar.** Quatro `curl` que ninguém rodou ainda,
listados no [PLT-06](cards/PLT-06-deploy-no-coolify.md): as rotas privadas
respondendo 401, o `quadro.json` dando 404, a leitura anônima sem progresso, e
a engrenagem só para admin. Nenhum deles aparece na interface — uma aplicação
com o backlog publicado tem a mesma aparência de uma correta.

**Dívida que passou a valer na internet**, e não mais só na rede local: token
de 30 dias em `localStorage` sem refresh (um XSS lê o token), e
`POST /auth/google` sem rate limiting. Vieram do PLT-02, registradas lá.

## Decisões já tomadas

Para não serem rediscutidas sem motivo novo:

- **Cobrança fica para depois.** Sem informação para precificar; primeiro usar
  e medir.
- **A invoice é anônima por padrão.** Exigir cadastro para gerar um PDF perde
  a corrida contra um formulário que gera na hora.
- **A interface é toda em inglês; só o conteúdo das trilhas é português**
  (25/08/2026). Era "invoice em inglês, trilhas em português", o que deixava
  Configurações, a navegação e a home sem regra — e elas nasceram em
  português. O alvo não é o dev brasileiro, é o dev de país emergente que quer
  ganhar em moeda forte; a interface tem de falar com ele. As aulas seguem em
  português porque foram escritas assim.
- **O PDF é gerado no navegador.** Custo zero de servidor, funciona anônimo.
- **O login é com Google, não com senha** (13/08/2026). O arguição não tem
  senha para portar, e o Google já entrega e-mail verificado — que a busca de
  vagas precisa para avisar.
- **A busca de vagas roda em segundo plano**, a cada 50 min, e ninguém espera
  olhando a tela. Medido: uma busca ao vivo leva ~58s no melhor caso.
- **Vaga encontrada fica 15 dias**; vaga salva fica para sempre.
- **Do CV, guarda-se só o perfil extraído** — nunca o arquivo. Some o CPF, o
  endereço e o telefone.
- **Não reusar o look4job**, apesar de ele ter 1.953 empresas catalogadas e
  estar em produção. Abordagem deliberadamente diferente.
- **`ADMIN_EMAILS` é a fonte da verdade do papel**, reavaliada a cada login
  (13/08/2026). Vazio significa ninguém — sem default hardcoded. O efeito
  colateral é intencional: promover alguém direto no banco não sobrevive ao
  próximo login, e por isso uma promoção manual esquecida não vira permanente.
- **Configurações é área de admin.** Deixou de ser a tela sem dono do PLT-01.
- **O login ficou desligado por um dia** (14/08/2026), com o guard inteiro
  desligado e o risco registrado no [PLT-05](cards/PLT-05-login-desligado.md).
  **Revertido no mesmo dia** pelo deploy: em produção o login é exigido.
- **A leitura é anônima; entrar é opcional** (14/08/2026). Ler a aula é o que
  convence alguém a criar conta, então pedir a conta antes de mostrar a aula
  inverte a ordem. O login guarda progresso e anotação —
  [PLT-07](cards/PLT-07-leitura-anonima.md).
- **O Telegram é canal adicional, não substituto do e-mail** (24/08/2026). O
  e-mail trava num custo de infraestrutura (domínio verificado, DKIM/SPF/DMARC,
  que Resend e Brevo exigem nos planos gratuitos); o Telegram troca isso por
  custo de conversão — ter o app, sair do site e apertar START, e o bot **não
  pode** iniciar a conversa. Nenhum dos dois vence sozinho, então os dois
  existem — [JOB-32](cards/JOB-32-telegram-como-canal.md).
- **O bot do Telegram recebe por webhook, e é um bot por ambiente**
  (24/08/2026). O webhook custa uma rota `@Public()` nova num guard *fail
  closed* e exige HTTPS público — em desenvolvimento, um túnel. Custo aceito: o
  `getUpdates` evitaria isso ao preço de um processo puxando o tempo todo. Dois
  tokens desde já porque o Telegram entrega cada update a **uma** URL: com um
  bot só, desenvolvimento e produção roubariam as mensagens um do outro e
  mensagem de teste chegaria a gente real.
- **`chat_id` do Telegram fica em coluna comum, não cifrado** (24/08/2026). É
  identificador de destino, igual ao e-mail que já fica em claro na mesma
  feature — cifrar um e não o outro seria incoerente, e impediria consultar o
  vínculo. Diferente dos tokens do PLT-01, que são credencial: `chat_id` não
  abre nada sem o token do bot.
- **O deploy é no Coolify, a partir do `docker-compose.prod.yml`** (14/08/2026).
  O de desenvolvimento continua no repositório e **não serve** para o servidor:
  publica portas e fixa senha. Guia em [docs/DEPLOY.md](../DEPLOY.md).

---

## Quadro dentro do app (temporário)

Existe uma aba **Quadro** no app, em `/quadro`, visível em qualquer build —
inclusive no Docker (`localhost:5173`), que é onde o app roda de verdade.

**Ela precisa sair antes de publicar.** O backlog tem bugs conhecidos e
decisões internas; não é conteúdo para quem chega de fora. Enquanto o app não
está no ar, deixá-la visível não custa nada e serve para acompanhar o trabalho.

Os dados vêm de `frontend/public/quadro.json`, gerado junto com o HTML:

```
python3 scripts/kanban-html.py    # gera o index.html E o quadro.json
```

**Para remover quando não fizer mais sentido** — é só apagar, nada mais
depende disso:

1. `frontend/src/pages/QuadroPage.tsx`
2. `frontend/public/quadro.json`
3. As três marcas `QUADRO (temporario)` em `frontend/src/App.tsx`
   (o import, a entrada da aba e a rota)
4. O bloco `SAIDA_JSON` em `scripts/kanban-html.py`, se quiser parar de gerar
