# Horizons — convenções do projeto

Umbrella de produtos para o desenvolvedor que quer trabalhar fora do Brasil.
Hoje tem duas abas: **Trilhas** (estudo, em português) e **Invoice** (gerador,
em inglês). O idioma misto é deliberado — a invoice mira um público global.

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

## Backend

Um módulo por pasta, sem barrel: `x.module.ts`, `x.controller.ts`,
`x.service.ts`, `x.dto.ts`. Copie `src/tracks/` ou `src/progress/`.

- **`PrismaModule` é `@Global()`** — não importe nos módulos; só injete
  `PrismaService`.
- **`CurrentUserGuard`** vai em `@UseGuards()` na classe do controller e não
  entra em `providers`. É um stub: lê `x-user-email`, cria a conta se não
  existir, **nunca rejeita**. Não há login de verdade.
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

## Verificar antes de dizer pronto

O critério é o navegador, não o build. Suba os containers, abra a página,
clique. Para PDF, abra o arquivo gerado. Confira os dois temas. Confirme que
as trilhas continuam funcionando depois de mexer em algo compartilhado.
