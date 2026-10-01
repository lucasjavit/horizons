# PLT-13 · Remover as trilhas da aplicação

**Estado:** feito (01/10/2026)
**Tamanho:** M

## O pedido

Stakeholder, em 01/10: *"Eu quero que vc remova da aplicacao a parte de track"*
— e, ao delimitar o escopo: *"tudo dentro de /t/system-design"*.

Sai a aba **Trilhas** inteira: a listagem em `/`, a trilha em `/t/:slug`, a
aula em `/t/:slug/:lessonSlug`, e tudo que as serve no backend.

A umbrella passa de três produtos a dois: **Jobs** e **Invoice**.

## As três decisões, tomadas antes de começar

Medido o escopo e levadas ao stakeholder, porque as três são irreversíveis:

| Decisão | Escolha |
| --- | --- |
| A rota `/` fica vaga (hoje é a listagem de trilhas) | **Jobs vira a home.** `/` passa a mostrar a busca de vagas, e `/vagas` continua valendo como atalho |
| 7.226 linhas de conteúdo autoral (75 aulas, 15 arquivos) | **Apagar.** Fica recuperável pelo histórico do git; o repositório fica limpo |
| As tabelas em produção | **Migration que as remove** (`progress`, `lessons`, `modules`, `tracks`, nesta ordem, por causa das FKs) |

## O que isso significa para o CLAUDE.md

**A regra de idioma perde a exceção.** Hoje ela diz: *"A interface é em inglês.
A exceção é o conteúdo das trilhas"* — e o conteúdo das trilhas deixa de
existir. A seção "Conteúdo das trilhas" sai inteira, e a regra de idioma passa
a ser sem ressalva.

Isso **não** é limpeza opcional: o CLAUDE.md é lido como contrato por quem
desenvolve aqui, e uma exceção que aponta para nada é pior que nenhuma regra.

## O que remover

**Backend**
- `src/tracks/` e `src/progress/` (módulos inteiros)
- os modelos `Track`, `Module`, `Lesson`, `Progress` do `schema.prisma`, e a
  relação inversa em `User`
- `prisma/seed/` inteiro (15 arquivos) e o `seed` do `prisma.config.ts`
- o registro dos dois módulos em `app.module.ts`
- migration nova que apaga as quatro tabelas

**Frontend**
- `pages/TracksPage.tsx`, `pages/TrackPage.tsx`, `pages/LessonPage.tsx`
- `components/LessonSidebar.tsx`, `components/blocks/`
- as três rotas do `App.tsx`, e `/` aponta para `VagasPage`
- o que em `types/api.ts`, `lib/api.ts` e na navegação servia só as trilhas

⚠️ **`components/blocks/BlockRenderer.tsx` exporta `WARN_INK`**, que o
CLAUDE.md manda usar para texto de erro — e o invoice e as vagas o importam.
Mover antes de remover, ou a remoção quebra o que fica.

⚠️ **`ProgressBar.tsx` não é das trilhas** — o nome engana. Conferir quem usa
antes de apagar.

⚠️ **O healthcheck do compose bate em `/api/auth/config`**, não nas trilhas.
Mas o `qa-rapido.py` **testa `/t/system-design` e a página de trilhas**: as
checagens têm de sair, senão a suíte passa a falhar para sempre.

## Critérios de aceite

- [x] Nenhuma rota de trilha responde; `/t/system-design` dá 404
- [x] `/` mostra a busca de vagas, e `/vagas` continua funcionando
- [x] Nada em `Trilhas` na navegação, em nenhum tema
- [x] `WARN_INK` continua disponível para quem o usa, e o invoice não quebra
- [x] A migration apaga as quatro tabelas, e roda no deploy
- [x] `grep` por `tracks`/`Lesson`/`trilha` não acha código morto
- [x] O `CLAUDE.md` perde a seção de conteúdo e a exceção de idioma
- [x] `qa-rapido.py` passa, sem checagem de trilha
- [x] As suítes passam, e **nenhum teste foi removido para fazer passar** — se
      um teste de trilha sai, sai porque a feature saiu, e isso está dito aqui

## Riscos

| Risco | Mitigação |
| --- | --- |
| `WARN_INK` sai junto e quebra invoice/vagas | mover primeiro, conferir no navegador |
| A migration falha por FK | ordem: `progress` → `lessons` → `modules` → `tracks` |
| Sobra dado órfão no `User` | conferir a relação inversa no schema |
| O bundle cresce ou o `dist` guarda arquivo morto | conferir os chunks depois |


---

## O que foi feito, e o que foi medido (01/10/2026)

### O `WARN_INK`, que era o risco de verdade

Ele vivia em `components/blocks/BlockRenderer.tsx` — **dentro da pasta que ia
ser apagada** — e **26 arquivos** o importavam de lá: todo o Invoice, as Vagas,
o Perfil, as cinco sub-páginas de Configurações, o `BotaoGoogle`.

Mora agora em **`frontend/src/components/cores.ts`**, pelo mesmo motivo do
`BOTAO_ICONE` em `botao-icone.ts`: importar uma string não deve arrastar uma
feature inteira. A mudança foi feita **primeiro**, com a pasta `blocks/` ainda
no lugar, e o `tsc -b` passou limpo — provando que ela se sustenta sozinha,
independente da remoção.

Medido no navegador, forçando a validação do invoice com os campos vazios:

| Tema | Cor do texto de erro | Esperado |
| --- | --- | --- |
| claro | `rgb(163, 74, 23)` | `#A34A17` ✓ |
| escuro | `rgb(232, 137, 74)` | `#E8894A` ✓ |

O `light-dark()` sobreviveu. O PDF foi gerado e aberto: `3 × 33.33 = $99.99`,
4.115 bytes, layout íntegro.

### O `ProgressBar.tsx` **era** das trilhas

O card mandava conferir, e o aviso estava certo em pedir a verificação — mas a
conclusão foi a oposta da sugerida. Os únicos importadores eram `TracksPage`,
`TrackPage` e `LessonSidebar`, os três removidos. Saiu junto.

O mesmo vale para o **`Quiz.tsx`** (só `LessonPage` o usava) e para
`blocks/inline.tsx` (só `BlockRenderer` e `Quiz`).

Já **`Recolhivel.tsx` e `Hint.tsx` ficaram**: Invoice, Jobs e Configurações os
usam. O nome não denuncia a dona da peça — é preciso olhar quem importa.

### A migration

`prisma/migrations/20261001120000_remover_trilhas/`, aplicada pelo `migrate
deploy` do compose na subida. O banco foi de **19 para 15 tabelas**.

Ordem, que é o que faz a migration rodar: `progress` → `lessons` → `modules` →
`tracks`, das folhas para a raiz, e por fim `DROP TYPE "LessonKind"` (o
Postgres recusa apagar um tipo que ainda é usado por uma coluna). Sem
`CASCADE`, de propósito: apagar na ordem certa falha alto se sobrar
dependência.

Apagado: **1 trilha, 13 módulos, 75 aulas, 3 progressos**.
Intacto: **4 usuários, 5 chaves de IA, 2 vagas salvas, 1 perfil de busca**.

### O seed **não** foi apagado

O card mandava remover `prisma/seed/` inteiro, e os 15 arquivos de conteúdo
saíram. Mas `prisma/seed.ts` **ficou**, reduzido a uma coisa só: criar o
usuário de `DEFAULT_USER_EMAIL`.

Razão: `AUTH_DISABLED=true` faz toda requisição ser essa conta, e o
`qa-rapido.py` conta com ela para checar os papéis. O CLAUDE.md registra o que
aconteceu em 31/08 quando esse usuário sumiu numa migration — **8 checagens de
papel passaram a se pular em silêncio**. Apagar o seed repetiria exatamente
aquilo. A entrada `migrations.seed` do `prisma.config.ts` ficou pelo mesmo
motivo.

### Os testes

**Nenhum teste foi removido para fazer a suíte passar.**

| Suíte | Antes | Depois |
| --- | --- | --- |
| Backend | 383 (15 arquivos) | **391** (16 arquivos) |
| Frontend | 348 (9 arquivos) | **350** (10 arquivos) |

**Saíram 4 casos**, todos do `frontend/src/lib/erros-do-servidor.spec.ts`, e
todos porque o que eles cobriam virou código morto: os 3 padrões de tradução
(`Trilha "x" nao encontrada`, `Aula "x" nao encontrada na trilha "y"`, `Aula
"x" nao encontrada`) traduziam mensagens que só `tracks.service.ts` e
`progress.service.ts` emitiam. Com os módulos fora, nenhum backend pode
produzi-las. O quarto caso era o teste da "mensagem longa da aula", que afirma
sobre um regex que deixou de existir.

**Um teste foi reescrito, e não apagado.** O
`auth.service.banco.spec.ts` provava a adoção de conta do PLT-03 criando uma
trilha, um módulo, uma aula e um progresso. O que ele afirma — *adotar reusa a
MESMA linha de `users`, então tudo com `userId` continua ligado* — não mudou;
só a testemunha. Agora usa `savedJob`, uma relação que o produto ainda tem.

**Dois testes novos, os dois vistos falhar antes de passar:**

`backend/src/auth/superficie-sem-trilhas.e2e.spec.ts` (8 casos) afirma o
negativo em duas camadas independentes — 404 por requisição de verdade, e
nenhum controller registrado servindo `/tracks` ou `/progress` por descoberta.
Com um `@Controller('tracks')` devolvido ao `AppModule`, **2 dos 8 quebraram**.
O 404 é o ponto: o guard é *fail closed*, então uma rota de trilha que
voltasse protegida responderia **401**, e um teste que aceitasse "não é 200"
passaria com a feature de volta no ar.

`frontend/src/App.rotas.spec.tsx` (6 casos) monta o `App` de verdade. Com a
rota `/t/:slug` devolvida, **3 dos 6 quebraram**; tirando `/` da `VagasPage`,
mais 1.

**Os pisos do `fail-closed.e2e.spec.ts` não foram afrouxados.** Medido depois
da remoção: 59 rotas (eram 63), 7 públicas (inalterado), **1** de sessão
opcional (eram 5), 51 protegidas (eram 55). Os pisos `>50` e `>40` continuam
valendo com folga, e isso está escrito no arquivo — afrouxá-los junto com a
remoção transformaria um número que protege num número que acompanha.

A lista `OPCIONAIS_ESPERADAS` caiu para um item, `POST /jobs/facets`. O teste
do token inválido **tira a rota da própria lista** em vez de apontar um
caminho fixo, com um `expect(opcional).toBeDefined()` para não passar vazio no
dia em que a última rota opcional sumir.

### O `qa-rapido.py`

Saíram as checagens de `/t/system-design`, de `/tracks` público, do isolamento
de progresso e da página de trilhas no navegador. **Nenhuma outra foi
afrouxada** — as 8 de papel continuam executando (nenhuma pulada).

A checagem do token inválido **não se perdeu, mudou de rota**: agora bate em
`POST /jobs/facets`, a única `@SessaoOpcional()` que sobrou. A do navegador
virou "a home tem `main#conteudo`" e "a home mostra a busca de vagas".

### Bundle

**433 → 327 KB** no bundle principal (teto de 440). O `lazy()` da `VagasPage`
foi mantido mesmo ela virando a home, com a justificativa reescrita: a razão
original ("quem chega para ler uma aula nunca a abre") morreu, mas a medição
de 26/08 continua valendo — importada estaticamente ela empurrava o principal
para 448 KB, e `/invoice` não precisa de nada dela.

### Uma consequência que vale registrar

**A home deixou de ter conteúdo para o visitante anônimo.** A listagem de
trilhas era legível sem conta (PLT-07); a `VagasPage`, para quem não entrou,
mostra *"Sign in to see your jobs"*. Não é defeito — é o comportamento que a
`VagasPage` já tinha em `/vagas` —, mas a porta de entrada do produto virou um
convite a entrar, e isso é decisão de produto que ninguém tomou explicitamente
neste card. Fica registrado para quem for olhar conversão.

### Fora do escopo, encontrado no caminho

`backend/src/jobs/grupo.spec.ts` usa `excluded_keywords` enquanto o
`FiltrosDto` declara `exclude_keywords` — o `tsc --noEmit` acusa nas linhas 127
e 130. **É anterior a este card** (reproduzido em `HEAD`), e o `npm test` passa
porque o `ts-jest` não faz typecheck. O teste exercita um campo que o DTO não
tem. Não foi tocado: é card próprio.
