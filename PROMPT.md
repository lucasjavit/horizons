# Prompt de continuação — Horizons

> Cole o conteúdo abaixo (a partir de "CONTEXTO") no agente da sua IDE.
> Ele é autocontido: não depende de nenhuma conversa anterior.

---

## CONTEXTO

Você vai continuar o desenvolvimento do **Horizons**, uma plataforma pessoal de
trilhas de estudo. O projeto já existe em `/home/legion/projects/horizons` com a
fundação pronta (build validado, banco migrado). Sua tarefa é construir a
aplicação em cima dessa base.

A primeira trilha é **System Design**.

### Princípio inegociável sobre conteúdo

O conteúdo das aulas é **autoral**: escrito em português, do zero. A referência
de estrutura é o `algomaster.io/learn/system-design` e o repositório
`github.com/ashishps1/awesome-system-design-resources`, mas **não copie textos
de nenhuma dessas fontes** — é material de terceiros. Links para as fontes
originais aparecem apenas como "leitura complementar" ao final de cada aula.

Escreva as aulas você mesmo, com profundidade real (600–900 palavras), incluindo
tradeoffs, erros comuns e exercícios de auto-teste.

## STACK JÁ INSTALADA (versões exatas — não faça downgrade)

| Camada   | Tecnologia                                             |
| -------- | ------------------------------------------------------ |
| Frontend | React 19.2 + Vite 8.2 + TypeScript + Tailwind **v4**.3 |
| Router   | react-router-dom 7.18                                  |
| HTTP     | axios 1.19                                             |
| Backend  | NestJS 11 + TypeScript                                 |
| ORM      | Prisma **7**.9 + PostgreSQL 16                         |

### Armadilhas de versão (importantes)

1. **Tailwind v4** não usa `tailwind.config.js`. A configuração é CSS-first via
   `@import 'tailwindcss'` e bloco `@theme` — já está feito em
   `frontend/src/index.css`. Não crie um `tailwind.config.js`.
2. **Prisma 7** removeu `url` do bloco `datasource` do schema. A connection
   string vive em `backend/prisma.config.ts`. Não tente colocar `url =
   env("DATABASE_URL")` de volta no schema — quebra a validação.
3. **React 19** — sem `React.FC`, sem import obrigatório de React.

## ESTADO ATUAL (o que já existe e funciona)

```
horizons/
├── docker-compose.yml        Postgres 16 na porta 5433 do host
├── README.md
├── frontend/
│   ├── postcss.config.js     @tailwindcss/postcss configurado
│   └── src/
│       ├── index.css         DESIGN SYSTEM COMPLETO — leia antes de estilizar
│       ├── App.tsx           ainda é o template padrão do Vite
│       └── main.tsx
└── backend/
    ├── prisma.config.ts      config do Prisma 7 (URL fica aqui)
    ├── prisma/
    │   ├── schema.prisma     Track → Module → Lesson + Progress
    │   └── migrations/       migration inicial JÁ APLICADA
    ├── .env.example
    └── src/                  ainda é o scaffold padrão do Nest
```

Validado e funcionando: build do frontend passa, `prisma validate` passa,
migration aplicada, tabelas `users`/`tracks`/`modules`/`lessons`/`progress`
criadas no Postgres.

## IDENTIDADE VISUAL (já implementada em `frontend/src/index.css`)

| Cor     | Hex       | Uso                                        |
| ------- | --------- | ------------------------------------------ |
| Verde   | `#00704A` | Primária — marca, navegação, ações         |
| Dourado | `#D4A017` | Acento — progresso, destaques, conquista   |
| Preto   | `#000000` | Texto e fundos escuros                     |
| Branco  | `#FFFFFF` | Superfícies claras                         |

**Regra de acessibilidade que você deve respeitar:** o dourado `#D4A017` tem
contraste ~2.4:1 com branco e reprova em WCAG AA. Use-o como fundo **apenas com
texto preto**, ou como borda/realce. Para texto dourado sobre fundo claro use o
token `--accent-ink` (`#7A5C0C`).

Use sempre os tokens semânticos (`var(--surface)`, `var(--text)`,
`var(--brand)`, `var(--accent)`, `var(--border)`, `var(--text-muted)`), nunca a
cor crua — o tema escuro depende disso e já está configurado.

## MODELO DE DADOS (já migrado, em `backend/prisma/schema.prisma`)

- `User` — id, email (único), name
- `Track` — trilha; slug único, title, description, icon, position, published
- `Module` — pertence a Track; slug, title, `goal` (o que se aprende), position
- `Lesson` — pertence a Module; slug, title, `kind` (enum LessonKind:
  ARTICLE/VIDEO/PAPER/COURSE/BOOK/CHANNEL), `summary`, `content` (Json),
  `sourceUrl`, position
- `Progress` — único por (userId, lessonId); completed, completedAt, note

`Lesson.content` guarda blocos estruturados em JSON. O formato de bloco é:

```ts
type Block =
  | { type: 'p'; text: string }                                  // parágrafo
  | { type: 'h'; text: string }                                  // subtítulo
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang?: string; code: string }
  | { type: 'key'; text: string }                                // ideia central
  | { type: 'warn'; title?: string; text: string }               // erro comum
  | { type: 'table'; head: string[]; rows: string[][] }          // tradeoffs

interface LessonContent {
  summary: string
  blocks: Block[]
  quiz?: { q: string; a: string }[]
}
```

## O QUE CONSTRUIR

### 1. Backend (NestJS)

- `PrismaModule` + `PrismaService` global. **Atenção:** no Prisma 7 o client
  precisa de um adapter — instancie com `PrismaPg` de `@prisma/adapter-pg`
  (instale `@prisma/adapter-pg` e `pg`), lendo `DATABASE_URL` do `.env`.
- `TracksModule`:
  - `GET /tracks` — lista trilhas publicadas (sem os módulos)
  - `GET /tracks/:slug` — trilha com módulos e aulas (sem `content`, para a
    resposta não ficar pesada), incluindo o progresso do usuário
  - `GET /tracks/:trackSlug/lessons/:lessonSlug` — aula completa com `content`
- `ProgressModule`:
  - `PUT /progress/:lessonId` — marca concluída/não concluída (upsert)
  - `PUT /progress/:lessonId/note` — salva anotação
- Validação com `class-validator` + `ValidationPipe` global (whitelist ligado).
- CORS liberado para `CORS_ORIGIN` do `.env`.
- Porta 3333 (`PORT` no `.env`).
- Prefixo global `/api`.

**Autenticação:** por enquanto é um app pessoal — resolva o usuário por um
header simples (`x-user-email`) ou um usuário fixo vindo do seed. Não invente
JWT/OAuth agora; deixe isolado num guard para trocar depois.

### 2. Seed com a trilha de System Design

Crie `backend/prisma/seed.ts` populando a trilha completa. A estrutura de
módulos (13 módulos), na ordem didática:

1. **Conceitos fundamentais** — escalabilidade, disponibilidade, confiabilidade,
   SPOF, latência vs throughput, CAP, consistent hashing, failover, tolerância a falhas
2. **Fundamentos de rede** — OSI, IP, DNS, proxy vs reverse proxy, HTTP/HTTPS,
   TCP vs UDP, load balancing, checksums
3. **APIs** — o que é API, API gateway, REST vs GraphQL, WebSockets, webhooks,
   idempotência, rate limiting, design de APIs
4. **Bancos de dados** — ACID, SQL vs NoSQL, índices, sharding, replicação,
   escalar banco, tipos de banco, bloom filters
5. **Cache** — caching 101, estratégias, políticas de eviction, cache
   distribuído, CDN
6. **Comunicação assíncrona** — pub/sub, filas de mensagens, CDC
7. **Sistemas distribuídos** — heartbeats, service discovery, consenso,
   distributed locking, gossip, circuit breaker, disaster recovery, tracing
8. **Padrões de arquitetura** — cliente-servidor, microsserviços, serverless,
   event-driven, P2P
9. **Tradeoffs** — os 15 principais, vertical vs horizontal, concorrência vs
   paralelismo, long polling vs WebSockets, batch vs stream, stateful vs
   stateless, consistência forte vs eventual, push vs pull, REST vs RPC
10. **Entrevistas** — framework de resposta + problemas (fácil/médio/difícil:
    URL shortener, WhatsApp, Instagram, Netflix, Uber, Google Docs, etc.)
11. **Engenharia real** — casos do Discord, Netflix, Canva, Airbnb, Stripe, Slack
12. **Papers clássicos** — Paxos, MapReduce, GFS, Dynamo, Kafka, Spanner,
    Bigtable, ZooKeeper, LSM-Tree, Chubby
13. **Para continuar** — livro DDIA, canais, newsletters

**Comece escrevendo o conteúdo completo dos módulos 1 a 5.** Os módulos 6–13
podem entrar primeiro só com título, `goal` e `summary`, e receber conteúdo
depois — mas registre isso claramente no README como pendente, sem fingir que
está completo.

Cada aula com conteúdo deve ter: parágrafos explicativos, ao menos um bloco
`key` (a ideia central), um bloco `warn` (o erro clássico), tabela de tradeoff
quando fizer sentido, e 2–3 perguntas de quiz.

Registre o seed no `package.json` (`prisma.seed`) e rode com `npx prisma db seed`.

### 3. Frontend (React)

Rotas:

- `/` — lista de trilhas, com barra de progresso de cada uma
- `/t/:trackSlug` — página da trilha: módulos em acordeão, aulas com checkbox,
  progresso geral, "continue de onde parou", filtro "só pendentes"
- `/t/:trackSlug/:lessonSlug` — página da aula: renderiza os blocos do
  `content`, navegação anterior/próxima, botão de concluir, campo de anotação,
  quiz com resposta revelável, link para a fonte original

Requisitos de UI:

- Renderizador de blocos: um componente por tipo (`p`, `h`, `list`, `code`,
  `key`, `warn`, `table`), cada um com estilo próprio. O bloco `key` deve usar o
  dourado como destaque; o `warn`, uma cor de alerta que conviva com a paleta.
- Layout responsivo — precisa funcionar bem no celular.
- Sidebar com navegação da trilha na página da aula (colapsável no mobile).
- Barra de progresso usando o dourado (`--accent`) sobre o verde.
- Estados de loading e erro em toda chamada de API.
- Persistência otimista: marcar aula como concluída deve refletir na hora, com
  rollback se a API falhar.

### 4. Qualidade

- TypeScript estrito, sem `any`.
- Tipos compartilhados entre front e back **duplicados conscientemente** (não há
  workspace compartilhado) — mantenha-os em `frontend/src/types/` espelhando os
  DTOs do backend.
- Comentários em português, apenas onde explicam o "porquê", não o "o quê".
- **Valide antes de declarar pronto:** `npm run build` nos dois lados, `npx tsc
  --noEmit`, e um teste real de request na API (`curl`). Não afirme que algo
  funciona sem ter executado.

## COMO RODAR

```bash
# 1. Banco (porta 5433 — a 5432 é usada por outro projeto na máquina)
docker compose up -d

# 2. Backend → http://localhost:3333/api
cd backend
cp .env.example .env       # se ainda não existir
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# 3. Frontend → http://localhost:5173
cd frontend
npm run dev
```

## ORDEM SUGERIDA

1. PrismaService + módulo de tracks (API respondendo, validada com `curl`)
2. Seed com módulos 1–2 completos (menos conteúdo primeiro, para fechar o ciclo
   ponta a ponta antes de escrever muito texto)
3. Telas: lista → trilha → aula, com o renderizador de blocos
4. Progresso e anotações (backend + otimismo no front)
5. Conteúdo dos módulos 3–5
6. Restante dos módulos

Feche o ciclo ponta a ponta cedo (passo 3) antes de investir horas escrevendo
conteúdo — é mais fácil corrigir o formato dos blocos com a tela na frente.
