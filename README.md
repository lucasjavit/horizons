# Horizons

Plataforma pessoal de trilhas de estudo. A primeira trilha e **System Design**.

O conteudo das aulas e autoral — escrito em portugues, com tradeoffs, erros
comuns e exercicios de auto-teste. Links para as fontes originais aparecem
como leitura complementar, nunca como substituto do conteudo.

## Stack

| Camada   | Tecnologia                          |
| -------- | ----------------------------------- |
| Frontend | React + Vite + TypeScript + Tailwind |
| Backend  | NestJS + TypeScript                  |
| Banco    | PostgreSQL + Prisma                  |

## Identidade visual

| Cor     | Hex       | Uso                                   |
| ------- | --------- | ------------------------------------- |
| Verde   | `#00704A` | Primaria — marca, navegacao, acoes    |
| Dourado | `#D4A017` | Acento — progresso, destaques, conquista |
| Preto   | `#000000` | Texto e fundos escuros                |
| Branco  | `#FFFFFF` | Superficies claras                    |

O dourado tem contraste baixo sobre branco, entao vira fundo apenas com texto
preto. Para texto dourado sobre fundo claro use o token `--accent-ink`
(`#7A5C0C`), que passa em WCAG AA.

## Rodando

```bash
# 1. Banco
docker compose up -d

# 2. Backend  (http://localhost:3333)
cd backend
cp .env.example .env
npx prisma migrate dev
npm run start:dev

# 3. Frontend (http://localhost:5173)
cd frontend
npm run dev
```

O Postgres sobe na porta **5433** do host para nao conflitar com outros
projetos que ja usam a 5432.

## Estrutura

```
horizons/
├── frontend/          React + Vite
├── backend/           NestJS
│   ├── prisma/        schema e migrations
│   └── src/
└── docker-compose.yml Postgres
```

## Modelo de dados

`Track` (trilha) → `Module` → `Lesson`, com `Progress` por usuario e licao.
O conteudo da aula fica em `Lesson.content` como blocos estruturados (JSON),
o que permite renderizar paragrafos, listas, tabelas de tradeoff, blocos de
codigo e destaques sem acoplar o front a HTML solto.
