# Horizons

Umbrella de produtos para o desenvolvedor de pais emergente que quer trabalhar
fora e ganhar em moeda forte. Hoje tem duas abas:

- **Jobs** — busca de vagas remotas, por ATS e por IA. E a home: `/` mostra a
  busca, e `/vagas` continua valendo como atalho.
- **Invoice** — gerador de invoice que roda inteiro no navegador. Sem backend,
  sem cadastro: o PDF sai da propria pagina.

A interface e **toda em ingles**. Havia uma terceira aba, **Trilhas** — estudo
de System Design com 75 aulas autorais em portugues —, removida no PLT-13
(01/10/2026) por decisao do stakeholder. O conteudo continua recuperavel pelo
historico do git.

> **Estado:** em construcao, e **no ar**:
> [ojxqz4v8x7jda764e6p3k419.169.58.152.158.sslip.io](https://ojxqz4v8x7jda764e6p3k419.169.58.152.158.sslip.io)
> — publicado com [Coolify](docs/DEPLOY.md). O login com Google funciona; as
> vagas encontradas sao da conta de quem entrou.

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
| POST   | `/jobs/facets`                              | Contagens do modal de filtros (**sessao opcional**) |
| GET    | `/jobs/salvas`                              | Vagas que a pessoa guardou                 |
| GET    | `/perfil`                                   | Perfil de busca de quem entrou             |
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
│       ├── components/    vagas, invoice, perfil, settings, estados
│       ├── lib/           cliente axios e hook de carregamento
│       ├── invoice/       calculo em centavo inteiro e geracao do PDF
│       ├── pages/         vagas, invoice, perfil, config
│       └── types/         espelho manual dos DTOs do backend
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts        cria o usuario padrao (DEFAULT_USER_EMAIL)
│   └── src/
│       ├── auth/          Google Sign-In, guard global, decorators
│       ├── prisma/        PrismaService global (adapter PrismaPg)
│       ├── jobs/          busca, vagas salvas, historico, facetas
│       ├── ia/            a cadeia de provedores de IA
│       └── perfil/        perfil de busca e dados pessoais
└── docker-compose.yml
```

Os tipos sao **duplicados conscientemente** entre os `*.dto.ts` do backend e
`frontend/src/types/api.ts` — nao ha workspace compartilhado. Ao mudar um
lado, mude o outro.

## Modelo de dados

`User` e o centro: tudo que e de alguem pende dele com `onDelete: Cascade` —
`JobProfile` (o que a pessoa procura), `SavedJob` (o que ela guardou),
`JobHistory` (o que ja viu ou descartou), `EmailSubscription` e
`TelegramLink` (por onde recebe aviso).

`FoundJob` e cache de rodada e expira em 15 dias; `SavedJob` guarda um
**retrato** da vaga e fica para sempre, porque o anuncio sai do ar em semanas
e e justamente o que a pessoa vai querer reler.

