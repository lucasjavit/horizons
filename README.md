# Horizons

Umbrella de produtos para o desenvolvedor brasileiro que quer trabalhar fora.
Hoje tem duas abas:

- **Trilhas** — estudo estruturado, em portugues. A primeira e **System
  Design**, com 13 modulos e 75 aulas autorais.
- **Invoice** — gerador de invoice em ingles, que roda inteiro no navegador.
  Sem backend, sem cadastro: o PDF sai da propria pagina.

O idioma misto e deliberado. A invoice mira um publico global; as trilhas sao
escritas para quem le em portugues.

O conteudo das aulas e autoral — escrito do zero, com tradeoffs, erros comuns
e exercicios de auto-teste. Links para as fontes originais aparecem como
leitura complementar, nunca como substituto do conteudo.

> **Estado:** em construcao, e **no ar**:
> [ojxqz4v8x7jda764e6p3k419.169.58.152.158.sslip.io](https://ojxqz4v8x7jda764e6p3k419.169.58.152.158.sslip.io)
> — publicado com [Coolify](docs/DEPLOY.md). O login com Google funciona; ler
> trilha e aula **nao exige conta**, e entrar guarda o progresso e as
> anotacoes.

## Stack

| Camada   | Tecnologia                           |
| -------- | ------------------------------------ |
| Frontend | React 19 + Vite 8 + TypeScript + Tailwind v4 |
| Router   | react-router-dom 7                   |
| Backend  | NestJS 11 + TypeScript               |
| Banco    | PostgreSQL 16 + Prisma 7             |

### Armadilhas de versao

- **Tailwind v4** nao usa `tailwind.config.js`. A configuracao e CSS-first, via
  `@import 'tailwindcss'` e bloco `@theme` em `frontend/src/index.css`.
- **Prisma 7** removeu `url` do bloco `datasource`. A connection string vive em
  `backend/prisma.config.ts` (CLI) e no adapter `PrismaPg` (runtime).
- **Prisma 7** tambem moveu o comando de seed: ele fica em `migrations.seed`
  dentro de `prisma.config.ts`, nao mais no bloco `prisma` do `package.json`.

## Identidade visual

| Cor     | Hex       | Uso                                      |
| ------- | --------- | ---------------------------------------- |
| Verde   | `#00704A` | Primaria — marca, navegacao, acoes       |
| Dourado | `#D4A017` | Acento — progresso, destaques, conquista |
| Preto   | `#000000` | Texto e fundos escuros                   |
| Branco  | `#FFFFFF` | Superficies claras                       |

O dourado tem contraste baixo sobre branco, entao vira fundo apenas com texto
preto. Para texto dourado sobre fundo claro use o token `--accent-ink`
(`#7A5C0C`), que passa em WCAG AA.

Use sempre os tokens semanticos (`var(--surface)`, `var(--text)`,
`var(--brand)`, `var(--accent)`, `var(--border)`, `var(--text-muted)`) — o tema
escuro depende disso.

## Rodando com Docker

Sobe a aplicacao inteira — banco, API e frontend:

```bash
docker compose up -d --build
```

| Servico | URL                        | Contêiner        |
| ------- | -------------------------- | ---------------- |
| App     | http://localhost:5173      | `horizons-web`   |
| API     | http://localhost:3333/api  | `horizons-api`   |
| Postgres| `localhost:5433`           | `horizons-db`    |

O servico `migrate` roda `prisma migrate deploy` e o seed antes da API subir,
e encerra em seguida — a API so inicia depois que ele termina com sucesso.
Como o seed e idempotente, reexecutar o `up` nao duplica nada.

O nginx do frontend faz proxy de `/api` para o contêiner da API, entao o
navegador fala com uma origem so e nao ha CORS envolvido.

```bash
docker compose logs -f api     # acompanhar a API
docker compose down            # parar tudo (mantem o volume do banco)
docker compose down -v         # parar e apagar os dados
```

## Rodando em desenvolvimento

Com hot reload nos dois lados, usando so o banco em contêiner:

```bash
# 1. Banco
docker compose up -d db

# 2. Backend  (http://localhost:3333/api)
cd backend
cp .env.example .env
npx prisma migrate dev
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
npm run start:dev

# 3. Frontend (http://localhost:5173)
cd frontend
npm run dev
```

O Postgres sobe na porta **5433** do host para nao conflitar com outros
projetos que ja usam a 5432. As portas 3333 e 5173 sao as mesmas nos dois
modos, entao rode um de cada vez.

## API

Prefixo global `/api`. A sessao e por **Google Sign-In**: o front manda o ID
token em `POST /auth/google` e recebe um JWT, que vai em
`Authorization: Bearer`.

O `AuthGuard` e **global e fail closed** — rota nova nasce protegida a menos
que marque `@Public()`. Esquecer o decorator fecha o acesso em vez de abrir.
E o guard **rele o usuario do banco a cada request**: desativar a conta ou
rebaixar o papel vale na requisicao seguinte, sem esperar o token expirar. O
token e uma alegacao; o banco decide.

| Metodo | Rota                                        | O que faz                                  |
| ------ | ------------------------------------------- | ------------------------------------------ |
| GET    | `/auth/config`                              | Se o login esta disponivel (**publica**)   |
| POST   | `/auth/google`                              | Troca o ID token do Google por sessao (**publica**) |
| GET    | `/auth/me`                                  | Confirma a sessao                          |
| GET    | `/tracks`                                   | Trilhas publicadas, com contagem de progresso |
| GET    | `/tracks/:slug`                             | Trilha com modulos e aulas (sem `content`) |
| GET    | `/tracks/:trackSlug/lessons/:lessonSlug`    | Aula completa, com `content` e vizinhos    |
| PUT    | `/progress/:lessonId`                       | Marca concluida/nao concluida (upsert)     |
| PUT    | `/progress/:lessonId/note`                  | Salva a anotacao da aula                   |
| GET    | `/settings/tokens`                          | Chaves de IA guardadas (**admin**)         |

### Configuracao

`.env.example` lista tudo. Os que importam:

| Variavel | O que faz |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID do OAuth. Sem ele, a tela de login **explica** que nao esta configurado, em vez de mostrar um botao morto. |
| `JWT_SECRET` | Assina a sessao. Minimo 16 caracteres — **derruba o boot** se faltar, porque erro de configuracao do servidor nao e erro de autenticacao. |
| `ADMIN_EMAILS` | Quem e admin, reavaliado a cada login. **Vazio = ninguem**, sem default embutido. |
| `AUTH_DISABLED` | Desliga o login inteiro. Com `true`, nenhuma rota exige token — **so em rede local**, nunca no servidor. O default e `false`: esquecer a variavel fecha o acesso. |

## Estrutura

```
horizons/
├── frontend/
│   └── src/
│       ├── components/    blocos, sidebar, quiz, progresso, estados
│       ├── lib/           cliente axios e hook de carregamento
│       ├── invoice/       calculo em centavo inteiro e geracao do PDF
│       ├── pages/         trilhas, trilha, aula, invoice, login, config
│       └── types/         espelho manual dos DTOs do backend
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts        runner do seed
│   │   └── seed/modules/  conteudo autoral, um arquivo por modulo
│   └── src/
│       ├── auth/          Google Sign-In, guard global, decorators
│       ├── prisma/        PrismaService global (adapter PrismaPg)
│       ├── progress/      conclusao e anotacoes
│       └── tracks/        trilhas e aulas
└── docker-compose.yml
```

Os tipos sao **duplicados conscientemente** entre `backend/src/tracks/track.dto.ts`
e `frontend/src/types/api.ts` — nao ha workspace compartilhado. Ao mudar um
lado, mude o outro.

## Modelo de dados

`Track` (trilha) → `Module` → `Lesson`, com `Progress` por usuario e licao.
O conteudo da aula fica em `Lesson.content` como blocos estruturados (JSON),
o que permite renderizar paragrafos, listas, tabelas de tradeoff, blocos de
codigo e destaques sem acoplar o front a HTML solto.

```ts
type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang?: string; code: string }
  | { type: 'key'; text: string }     // ideia central
  | { type: 'warn'; title?: string; text: string }  // erro comum
  | { type: 'table'; head: string[]; rows: string[][] }
```

## Estado do conteudo

A trilha de System Design tem **13 modulos e 75 aulas**, todas com conteudo
autoral escrito.

| #  | Modulo                 | Aulas |
| -- | ---------------------- | ----- |
| 1  | Conceitos fundamentais | 6     |
| 2  | Fundamentos de rede    | 5     |
| 3  | APIs                   | 5     |
| 4  | Bancos de dados        | 5     |
| 5  | Cache                  | 5     |
| 6  | Comunicacao assincrona | 4     |
| 7  | Sistemas distribuidos  | 8     |
| 8  | Padroes de arquitetura | 5     |
| 9  | Tradeoffs              | 8     |
| 10 | Entrevistas            | 8     |
| 11 | Engenharia real        | 4     |
| 12 | Papers classicos       | 8     |
| 13 | Para continuar         | 4     |

Cada aula tem entre 600 e 990 palavras (mediana 773), ao menos um bloco `key`
(a ideia central), um bloco `warn` (o erro classico), tabelas de tradeoff onde
faz sentido, e de 2 a 3 perguntas de auto-teste. Todas apontam uma leitura
complementar externa.

A interface ainda suporta aulas sem conteudo: elas aparecem marcadas como
"em breve" e abrem uma pagina que diz que o texto ainda nao foi escrito. Isso
vale para trilhas futuras.

Para editar uma aula, altere o arquivo do modulo em
`backend/prisma/seed/modules/` e rode `npx prisma db seed` — o seed e
idempotente (upsert por slug) e remove aulas e modulos que sairam do codigo,
entao pode ser reexecutado quantas vezes for preciso sem sujar o banco.
