# Build do Vite e depois nginx servindo os estaticos.
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

# O Vite substitui import.meta.env.VITE_* em tempo de BUILD, nao de execucao.
# Por isso a URL da API entra como argumento aqui, e nao como variavel de
# ambiente do contêiner.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY tsconfig*.json vite.config.ts postcss.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── Imagem final ──────────────────────────────────────────────────────────
FROM nginx:1.29-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
