# Build em multi-stage: a imagem final leva so o dist e as deps de producao.
FROM node:24-alpine AS build
WORKDIR /app

# As deps mudam menos que o codigo — copiar so os manifests primeiro
# aproveita o cache de camada nos rebuilds.
COPY package*.json ./
RUN npm ci

COPY prisma.config.ts tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
# O client do Prisma e gerado a partir do schema, entao precisa rodar
# antes do build do Nest, que importa os tipos dele.
# O prisma.config.ts exige DATABASE_URL so para carregar; `generate` nao
# conecta em banco nenhum, entao um valor de fachada resolve no build.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

COPY src ./src
RUN npm run build

# ── Imagem final ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache tini

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# O client gerado vive dentro de node_modules e nao e reconstruido por
# `npm ci`, entao vem pronto do estagio de build.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
# O schema e o config seguem junto: `prisma migrate deploy` roda na subida.
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./

USER node
EXPOSE 3333

# tini como PID 1: repassa SIGTERM para o node, entao `docker compose down`
# encerra limpo em vez de esperar o timeout de 10s.
ENTRYPOINT ["/sbin/tini", "--"]
# dist/src/main e nao dist/main: como o prisma.config.ts fica na raiz do
# projeto, o rootDir inferido pelo tsc abrange src/ e a raiz, e a saida
# ganha o nivel extra. E o mesmo caminho que o `npm run start:prod` usa.
CMD ["node", "dist/src/main"]
