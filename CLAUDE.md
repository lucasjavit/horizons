# Horizons — convenções do projeto

Umbrella de produtos para o desenvolvedor que quer trabalhar fora do Brasil.
Hoje tem três abas: **Trilhas** (estudo), **Jobs** (busca de vagas) e
**Invoice** (gerador).

**A interface é em inglês. A exceção é o conteúdo das trilhas** — as aulas, os
títulos das trilhas e o que as descreve. O produto mira o dev de país
emergente que quer ganhar em moeda forte, e esse público não é só brasileiro;
as aulas continuam em português porque foram escritas para quem lê em
português (25/08/2026).

Isso vale para tudo o mais: navegação, Configurações, e-mail, mensagem de
erro na tela, estado vazio. Texto novo nasce em inglês a não ser que seja
aula.

Stack: NestJS 11 + Prisma 7 + Postgres 16 · React 19 + Vite 8 + Tailwind v4 ·
tudo em Docker.

```
docker compose up -d --build     # sobe tudo
# web :5173 · api :3333 · db :5433
```

## Armadilhas que já custaram tempo

**Prisma 7 não é Prisma 6.**
- O `datasource` **não** tem `url` — a connection string vive em
  `prisma.config.ts` e no adapter `PrismaPg` passado ao client.
- O comando de seed vive em `migrations.seed` do `prisma.config.ts`, **não**
  no bloco `prisma` do `package.json` (que não existe mais).
- Coluna `Json?` recebe `Prisma.DbNull`, nunca `null`.
- **O fluxo é `migrate deploy`, não `db push`.** Existe `prisma/migrations/`, e
  o serviço `migrate` do compose roda `migrate deploy` + seed a cada subida.
  Mudança de schema pede migration nova.

**O build do backend emite `dist/src/main`, não `dist/main`.** Porque
`prisma.config.ts` fica na raiz e alarga o `rootDir` inferido pelo tsc. Vale
para o `CMD` do Dockerfile e para o `start:prod`.

**Tailwind v4 é configurado em CSS.** Não existe `tailwind.config.js`; o tema
está no `@theme` de `src/index.css`. Não crie o arquivo de config.

**O Dockerfile do frontend copia uma lista explícita** de arquivos de config da
raiz. Arquivo novo na raiz do frontend precisa entrar naquele `COPY`, senão o
build ignora em silêncio. (`src/` é recursivo, então arquivo dentro de `src/`
entra sozinho.)

**`JWT_SECRET` derruba o boot se faltar ou tiver menos de 16 caracteres.** É de
propósito: erro de configuração do servidor não é erro de autenticação, e
devolver 401 esconderia o problema. O compose tem um default de
desenvolvimento; `.env.example` lista o que existe (`GOOGLE_CLIENT_ID`,
`JWT_SECRET`, `ADMIN_EMAILS`, `ENCRYPTION_KEY`, `AUTH_DISABLED`).

Sem `GOOGLE_CLIENT_ID` a aplicação sobe normalmente e a tela de login **explica
que não está configurada**, em vez de mostrar um botão que não funciona.

**Há dois compose.** `docker-compose.yml` é desenvolvimento; o deploy usa
`docker-compose.prod.yml`, que não publica portas (quem expõe é o proxy do
Coolify), não fixa `container_name`, e usa `${VAR:?mensagem}` em todo segredo —
faltando um, o compose **recusa subir**. Guia em [docs/DEPLOY.md](docs/DEPLOY.md).

**`AUTH_DISABLED` tem default `false` nos dois.** Esquecer a variável fecha o
acesso, nunca abre. Para desligar o login localmente, `AUTH_DISABLED=true` no
`.env` — que não vai para o git, então a escolha fica na máquina de quem a fez.

**Arquivo em `frontend/public/` vai para o `dist` mesmo com a feature
desligada.** Foi o caso do `quadro.json`: esconder a aba não escondia o dado, e
o backlog continuava baixável pela URL. O `Dockerfile` remove o arquivo quando
`VITE_QUADRO` não é `true`. Feature nova escondida por flag: confira o que
sobrou em `public/`, não só o que sumiu do bundle.

## Backend

Um módulo por pasta, sem barrel: `x.module.ts`, `x.controller.ts`,
`x.service.ts`, `x.dto.ts`. Copie `src/tracks/` ou `src/progress/`.

- **`PrismaModule` é `@Global()`** — não importe nos módulos; só injete
  `PrismaService`.
- **`AUTH_DISABLED=true` desliga o login inteiro** (estado atual, 14/08/2026).
  Nenhuma rota exige token e todo mundo é a conta de `DEFAULT_USER_EMAIL`. O
  fail closed descrito abaixo fica **inativo** — `/api/settings/tokens` responde
  a qualquer um que alcance a porta 3333. A API avisa no boot, toda vez. Para
  religar: `AUTH_DISABLED=false` e `GOOGLE_CLIENT_ID` preenchido; o código do
  login continua inteiro no lugar.
- **O guard é global e *fail closed*.** `AuthGuard` entra por `APP_GUARD` em
  `AuthModule`, então **rota nova nasce protegida** — não há `@UseGuards()` em
  controller nenhum. Para abrir, marque `@Public()`; para exigir admin,
  `@AdminOnly()`. Esquecer o decorator não abre buraco, fecha.
- **`@CurrentUser()` injeta o usuário já verificado** (`AuthUser`), e o guard
  **relê o usuário do banco a cada request**. Custa um SELECT, e paga:
  `active = false` ou papel rebaixado valem na requisição seguinte, sem
  esperar o token de 30 dias expirar. O token é uma alegação; o banco decide.
- **`ADMIN_EMAILS` é a fonte da verdade do papel**, reavaliada a cada login.
  Vazio = ninguém. Promover direto no banco não sobrevive ao próximo login.
- **`@SessaoOpcional()` não é `@Public()`.** Numa rota opcional o token, *se
  vier*, ainda é verificado — e token inválido continua dando 401, em vez de
  virar anônimo em silêncio (isso faria sessão expirada parecer trilha
  zerada). É o que permite a mesma rota servir leitura anônima e, para quem
  entrou, devolver o progresso. `@CurrentUser()` pode ser `null` ali: o
  handler trata. Hoje só `tracks` usa.
- **`where: { userId: null }` no Prisma não devolve vazio** — casa com as
  linhas de `userId` nulo, que são de outra pessoa. Para "sem dono", faça
  curto-circuito antes da consulta (`if (!userId) return ...`) ou `take: 0`.
  Um id impossível também não serve: `'\u0000'` derruba o Postgres com
  *invalid byte sequence for encoding UTF8*.
- **Rota pública é exceção, e o healthcheck depende disso.** Só
  `GET /auth/config` e `POST /auth/google` são `@Public()`. O healthcheck do
  compose bate em `/api/auth/config` — se um dia ela deixar de ser pública, o
  container fica eternamente *unhealthy*.
- **Mexeu em rota protegida, rode `scripts/qa-rapido.py`**: ele assina um
  token de teste com o segredo de dentro do container e confere o 401 — ou o
  200, se `AUTH_DISABLED` estiver ligada. O teste segue o servidor em vez de
  exigir um valor fixo, senão viraria falha permanente, e falha que sempre
  falha para de ser lida.
- **Controller é fino**: uma linha por handler, `return this.svc.metodo(...)`,
  com tipo de retorno `Promise<XDto>` explícito. Sem `async` no controller.
- **Serviço recebe `userId: string` como primeiro parâmetro** e sempre usa
  `select:` explícito no Prisma.
- **DTO de entrada é classe** com decoradores class-validator e `!:`. **DTO de
  resposta é interface.** O `ValidationPipe` global usa
  `forbidNonWhitelisted`, então campo sem decorador **rejeita com 400** — não
  é ignorado em silêncio.
- Rota específica antes de rota com `:param`, senão a genérica engole.
- Data cruza a API como string ISO, nunca `Date`.
- Erro: `NotFoundException` com mensagem em português sem acento.

**Schema:** `String @id @default(uuid())` (uuid, não cuid), `@@map` com nome
plural minúsculo, colunas em camelCase sem `@map`, `onDelete: Cascade` em toda
relação, `createdAt`/`updatedAt` nos modelos mutáveis. Modelo novo com `userId`
precisa da relação inversa em `User`.

## Frontend

- **Cor nunca vem de classe Tailwind.** Sempre `style={{ color: 'var(--token)' }}`.
  Os tokens: `--surface`, `--surface-raised`, `--surface-sunken`, `--border`,
  `--text`, `--text-muted`, `--brand`, `--brand-text`, `--accent`,
  `--accent-text`, `--accent-ink`. Tailwind cuida só de layout, espaçamento e
  tipografia. Isso é o que faz o tema escuro sair de graça.
  (`--surface-raised` só difere de `--surface` no escuro — no claro os dois
  são branco, então não espere elevação visível.)
- **Dourado (`--accent`) não é cor de texto sobre fundo claro** — dá ~2,2:1 e
  reprova em AA. Para texto existe `--accent-ink`. Para erro, `WARN_INK`
  (exportado de `components/blocks/BlockRenderer.tsx`).
- **Toda página começa com `<main id="conteudo" tabIndex={-1}>`** — é o
  contrato do skip link do `App.tsx`.
- Páginas são export nomeado; só `App` é default. Rota nova entra antes do
  `path="*"`.
- Dados: `useAsync((signal) => api.x(signal), [deps])`. Título:
  `useDocumentTitle(...)`.
- Estados: `LoadingState` / `ErrorState` / `EmptyState` de `components/States.tsx`.
- Erro de mutação mora num `useState` separado do erro do `useAsync`. Há dois
  padrões: otimista com rollback (marcar aula concluída) e máquina de estados
  `ocioso/salvando/salvo/erro` (autosave da anotação). Copie o que couber.
- **`frontend/src/types/api.ts` espelha os DTOs do backend à mão.** Mudou um
  lado, mude o outro.
- `tsconfig.app.json` proíbe enum de TS (`erasableSyntaxOnly`) e exige
  `import type` (`verbatimModuleSyntax`).

**Acessibilidade não é opcional aqui.** Todo campo com `<label htmlFor>`, todo
botão com `type="button"` explícito, ícone sozinho com `aria-label`, glifo
decorativo com `aria-hidden`, alvo de toque ≥24px, erro sinalizado por borda +
`aria-invalid` + texto (nunca só cor).

## Invoice

Roda **inteiro no navegador** — sem backend, sem login. `src/invoice/` tem a
lógica, `src/components/invoice/` os componentes.

- **Dinheiro é centavo inteiro.** Nunca some float. `parseAmountToCents` é
  baseado em string de propósito: `Math.round(1.005 * 100)` devolve 100 e
  perde um centavo.
- Arredonda por linha e soma inteiros, para o total impresso bater com a soma
  das linhas impressas.
- **jsPDF entra só por `import()` dinâmico.** São 400 KB; importação estática
  dobraria o bundle de quem só quer ler uma aula. Confira os chunks no `dist/`
  depois de mexer.
- O PDF é sempre tinta sobre papel branco — usa hex cru, não lê os tokens CSS.
- Campo numérico das linhas é `type="text" inputMode="decimal"` e guarda
  **string**, não número: um input controlado por número não representa `""`,
  `"3."` nem `"0."`.
- Rótulo de campo de linha carrega a descrição da linha ("Rate for Logo
  design"), senão o leitor de tela anuncia "Rate, Rate, Rate".

## Conteúdo das trilhas

**As aulas são autorais.** Escritas do zero em português, 600–900 palavras de
corpo (75 aulas hoje, mediana 765).
Nunca copie de algomaster.io nem do awesome-system-design-resources — esses
entram só como `sourceUrl`, leitura complementar.

## O quadro acompanha o trabalho

**Mexeu no que o quadro descreve, atualize o quadro — na mesma leva, não
depois.** Quadro que mente é pior que quadro nenhum, porque as decisões
passam a se apoiar nele.

O que isso significa na prática:

- Terminou um card: `**Estado:** feito (dd/mm/aaaa)` no arquivo **e** a linha
  movida para "Feito" no `KANBAN.md`. Marque os critérios de aceite com `[x]`.
- Descobriu um bug ou uma necessidade nova: vira card em `docs/backlog/cards/`
  antes de virar código, com o que foi medido e como reproduzir.
- Card não deu certo, ou ficou pela metade: registre **o que foi tentado e por
  que falhou**, com número quando houver. Isso vale mais que o card fechado —
  evita que a próxima pessoa (ou você em duas semanas) tente o mesmo caminho.
- Uma decisão de produto foi tomada: escreva no card, não só no chat.
- Depois de qualquer mudança: `python3 scripts/kanban-html.py`, que regenera
  o `index.html` e o `quadro.json` da aba Quadro.

O markdown é a verdade; o HTML e o JSON são só apresentação.

## Verificar antes de dizer pronto

O critério é o navegador, não o build. Suba os containers, abra a página,
clique. Para PDF, abra o arquivo gerado. Confira os dois temas. Confirme que
as trilhas continuam funcionando depois de mexer em algo compartilhado.
