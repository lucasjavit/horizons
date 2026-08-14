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

# Aba Quadro (backlog interno). Default vazio: o build so mostra o quadro
# quando alguem pede explicitamente, entao um build novo nunca vaza o backlog
# por esquecimento.
ARG VITE_QUADRO=
ENV VITE_QUADRO=$VITE_QUADRO

COPY tsconfig*.json vite.config.ts postcss.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# O quadro.json e um arquivo estatico em public/, entao o Vite copia para o
# dist independentemente da flag: sem esta linha, esconder a aba deixaria o
# backlog inteiro baixavel por quem digitasse /quadro.json. Esconder o link
# nao e esconder o dado.
RUN [ "$VITE_QUADRO" = "true" ] || rm -f dist/quadro.json

# ── Imagem final ──────────────────────────────────────────────────────────
FROM nginx:1.29-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
