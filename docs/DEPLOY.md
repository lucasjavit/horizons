# Deploy no Coolify

Guia para publicar o Horizons num [Coolify](https://coolify.io) self-hosted.
Siga com o painel do Coolify aberto na frente.

O Coolify faz deploy a partir de um repositório Git com docker-compose e
roteia o tráfego por Traefik. Quem cuida do HTTPS e do domínio é ele — o
compose de produção não publica portas no host.

> **O compose de desenvolvimento não serve para isto.** O `docker-compose.yml`
> publica `5433`, `3333` e `5173` no host, tem senha fixa no Postgres e liga a
> aba Quadro (o backlog interno). Use **`docker-compose.prod.yml`**.
>
> O default de `AUTH_DISABLED` é `false` nos dois compose — esquecer a variável
> **fecha** o acesso, nunca abre. Quem quer o login desligado na máquina local
> escreve `AUTH_DISABLED=true` no `.env`, que não vai para o git.

---

## 1. Criar o recurso

1. No projeto do Coolify, **+ New** → **Docker Compose** (não "Dockerfile" nem
   "Nixpacks" — o build é de vários serviços).
2. **Source:** repositório `github.com/lucasjavit/horizons`.
   Branch: a que você quer publicar (normalmente `main`).
3. **Docker Compose Location:** `docker-compose.prod.yml`.
   O campo costuma vir preenchido com `docker-compose.yml`; **troque**, senão
   sobe o de desenvolvimento com as portas abertas.
4. **Domains:** aponte o domínio público para o serviço `web`. É o nginx do
   frontend que serve a página e repassa `/api` para a API — a API não recebe
   domínio próprio.
5. Deixe o SSL/Let's Encrypt ligado. O login do Google exige `https` na origem
   cadastrada (passo 3), então sem certificado o login não funciona.

Ainda **não** clique em Deploy. Defina as variáveis primeiro: sem `JWT_SECRET`
a API não sobe, e você vai depurar um container que reinicia em loop.

---

## 2. Variáveis de ambiente

Em **Environment Variables**, no painel do recurso. Marque como *build-time*
apenas se o compose de produção pedir; as de baixo são todas de runtime.

| Nome | Obrigatória | Como gerar | Se faltar |
| --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | **sim** | `openssl rand -base64 24` (evite `/` e `@`, que precisam de escape na connection string) | O banco sobe com senha vazia ou o compose falha. Nunca deixe o `horizons` do dev. |
| `JWT_SECRET` | **sim**, mín. 16 caracteres | `openssl rand -base64 32` | **A API não sobe.** `AuthService` valida no boot e lança `JWT_SECRET ausente ou curta demais (minimo 16 caracteres)`. É de propósito: erro de configuração do servidor não é erro de autenticação. |
| `ENCRYPTION_KEY` | **sim** | `openssl rand -base64 32`, ou uma frase longa | Os tokens de API (chaves de IA) são cifrados em AES-256-GCM com ela. **Trocar depois invalida os tokens já salvos**, que terão de ser digitados de novo — guarde num cofre, não só no painel. |
| `GOOGLE_CLIENT_ID` | para o login funcionar | Google Cloud Console → OAuth 2.0 Client ID, tipo *Web application*. Veja o passo 3. | A aplicação sobe normalmente e a tela mostra **"Login indisponível — o login com Google não está configurado neste servidor"**. Ninguém entra. |
| `ADMIN_EMAILS` | não | Seus e-mails separados por vírgula: `voce@gmail.com,outro@gmail.com` | **Vazio = ninguém é admin.** Sem admin não há engrenagem nem tela de Configurações — e é lá que ficam os tokens de IA. Promover direto no banco não adianta: o papel é reavaliado a cada login a partir desta variável. |
| `CORS_ORIGIN` | sim, na prática | O domínio público com `https://`, ex.: `https://horizons.seudominio.com` | Cai no default `http://localhost:5173`. O app em si continua funcionando (o nginx repassa `/api` no mesmo host, então não há requisição cross-origin), mas qualquer chamada de outra origem é bloqueada. Defina — custa nada e evita depuração inútil depois. |
| `AUTH_DISABLED` | **não defina** | — | Veja o aviso abaixo. |

### `AUTH_DISABLED`: não defina

O default do compose de produção é `false` — login exigido. **Deixe assim.**

Com `AUTH_DISABLED=true`, o `AuthGuard` deixa de exigir token em **qualquer**
rota e resolve todo mundo como a conta de `DEFAULT_USER_EMAIL`. Não é "pular a
tela de login": é abrir a aplicação inteira para quem tiver o endereço.
Inclusive `GET /api/settings/tokens`, onde ficam as chaves de IA — cifradas
contra vazamento do banco, não contra uma requisição autorizada.

Foi o estado do desenvolvimento local (card
[PLT-05](backlog/cards/PLT-05-login-desligado.md)), e o card já dizia: *"não
pode ir para o servidor assim"*.

Se por engano ela for para produção, a API grita no log a cada boot:

```
WARN [AuthService] AUTH_DISABLED=true — NENHUMA rota exige token. As chaves de
IA em /api/settings/tokens ficam acessiveis a quem alcancar esta porta.
```

O passo 4 detecta isso com um `curl`.

---

## 3. Google OAuth

Sem este passo o botão do Google **aparece** e o Google recusa a autenticação —
foi o erro observado no teste local:

```
The given client ID is not found
```

O botão renderizar não significa que está configurado. O Google só valida a
origem no momento em que a pessoa clica.

No [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services**
→ **Credentials** → seu **OAuth 2.0 Client ID** (tipo *Web application*):

- **Authorized JavaScript origins** → **Add URI**:

  ```
  https://horizons.seudominio.com
  ```

  Com `https://`, sem barra no fim, sem caminho. É a origem de onde a página é
  servida. Se você também acessa em desenvolvimento, mantenha
  `http://localhost:5173` na lista — cabem várias.

- **Authorized redirect URIs** → **deixe vazio**.

  O fluxo aqui é por **ID token**: o script do Google devolve o token direto no
  navegador, o front manda em `POST /api/auth/google` e o backend verifica com
  `google-auth-library`, conferindo o `audience` contra o `GOOGLE_CLIENT_ID`.
  Nada redireciona, então não há URI de retorno para cadastrar. Preencher esse
  campo não quebra, mas não faz nada.

O **Client Secret não é usado** — não precisa copiar para lugar nenhum. O
Client ID é público: aparece no HTML de qualquer site que use Google Sign-In.

Propagação: a mudança de origens costuma valer em minutos, mas o Google avisa
que pode levar mais. Se o erro persistir logo após o cadastro, espere antes de
sair mexendo em outra coisa.

---

## 4. Verificar depois do deploy

Não confie no "deployment successful" do painel. O critério é a resposta HTTP.
Troque o domínio nos comandos.

**A configuração pública, que deve responder 200:**

```bash
curl -s https://horizons.seudominio.com/api/auth/config
```

Esperado — `authDisabled` **`false`** e `enabled` **`true`**:

```json
{"googleClientId":"1234...apps.googleusercontent.com","enabled":true,"authDisabled":false}
```

- `"authDisabled":true` → **o login está desligado. Corrija agora**: remova a
  variável `AUTH_DISABLED` do painel e faça redeploy.
- `"enabled":false` → falta `GOOGLE_CLIENT_ID`; ninguém consegue entrar.

**Uma rota protegida sem token, que deve responder 401:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://horizons.seudominio.com/api/tracks
```

Esperado:

```
401
```

**`200` aqui é falha de segurança, não sucesso.** Significa que o login está
desligado e a aplicação inteira está aberta na internet. Corrija na hora:
confira `AUTH_DISABLED` no painel, remova, redeploy, e repita o comando até dar
401.

Vale repetir para as outras rotas sensíveis:

```bash
for r in tracks auth/me settings/tokens; do
  printf '%s -> ' "$r"
  curl -s -o /dev/null -w '%{http_code}\n' "https://horizons.seudominio.com/api/$r"
done
```

Os três devem responder `401`.

**Por fim, no navegador:** abra o domínio, confirme que a tela de login aparece,
entre com o Google e veja as trilhas carregarem. Confira nos dois temas, claro e
escuro.

---

## Se der errado

### Container `api` fica *unhealthy* para sempre

O healthcheck bate em `/api/auth/config`. Ela **precisa continuar pública**
(`@Public()` em `AuthController.config`). Se alguém tirar o decorator, a rota
passa a responder 401, o healthcheck nunca fica verde, e o serviço `web` — que
depende de `api: service_healthy` — nunca sobe.

Confirme de dentro do container:

```bash
docker exec -it <container-da-api> node -e "require('http').get('http://127.0.0.1:3333/api/auth/config',r=>console.log(r.statusCode))"
```

`200` = saudável. `401` = alguém fechou a rota do healthcheck.

### A API reinicia em loop logo no boot

Veja os logs no Coolify. Se aparecer:

```
JWT_SECRET ausente ou curta demais (minimo 16 caracteres) — veja backend/.env.example
```

…a variável não chegou ao container, ou tem menos de 16 caracteres. Gere outra
com `openssl rand -base64 32` (dá 44 caracteres) e faça redeploy.

Isso é comportamento intencional: a API prefere não subir a subir com um
segredo fraco. Não tente contornar com um valor curto qualquer.

### A tela diz "Login indisponível"

Texto completo: *"O login com Google não está configurado neste servidor."*

Falta `GOOGLE_CLIENT_ID`. A aplicação sobe de propósito — é melhor explicar que
não está configurada do que mostrar um botão morto. Confirme com:

```bash
curl -s https://horizons.seudominio.com/api/auth/config
```

Se vier `"enabled":false`, a variável não chegou ao container. Defina no painel
e faça redeploy — variável nova só vale em container novo.

### O botão aparece, mas o Google recusa

`The given client ID is not found`, ou `origin_mismatch` no console do
navegador. É o passo 3: a origem `https://seudominio` não está em **Authorized
JavaScript origins**, ou está com `http://` em vez de `https://`, ou com barra
no fim.

### As migrations não rodaram

O serviço `migrate` roda `prisma migrate deploy` + seed e **encerra**; a API só
sobe depois que ele termina com sucesso. Um `migrate` que saiu com erro segura
todo o resto. Veja os logs dele no Coolify — normalmente é `DATABASE_URL`
errada (senha com caractere não escapado é o caso mais comum) ou o banco ainda
não estava pronto.

O fluxo é `migrate deploy`, nunca `db push`.

---

## Antes do primeiro deploy público

A aba **Quadro** (`/quadro`) fica visível em qualquer build, inclusive em
produção. Ela expõe o backlog: bugs conhecidos e decisões internas. **Não é
conteúdo para quem chega de fora.**

O `docs/backlog/KANBAN.md` tem a lista do que apagar para removê-la (são quatro
itens, nada depende dela).

---

## O que já foi verificado localmente (14/08/2026)

Nada aqui substitui o deploy real — não há servidor nem domínio ainda —, mas
estes pontos foram medidos, não deduzidos:

| O que | Como foi verificado | Resultado |
| --- | --- | --- |
| O compose recusa subir sem segredo | `docker compose -f docker-compose.prod.yml config` com o ambiente limpo | `POSTGRES_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY` e `CORS_ORIGIN` **barram** com a mensagem; `GOOGLE_CLIENT_ID` e `ADMIN_EMAILS` deixam subir |
| A senha do Postgres chega aos três lugares | `config` com `POSTGRES_PASSWORD=SenhaTeste123` | aparece no `db` **e** nas duas `DATABASE_URL` |
| Sem `ports` nem `container_name` | `config` renderizado | só `expose` — nada publicado no host |
| A aba Quadro sai do build público | imagem construída sem `VITE_QUADRO`, inspecionada por dentro | "Quadro" ausente do bundle |
| O `quadro.json` não é servido | `curl` contra a imagem de produção rodando | **404** |
| As rotas do SPA continuam funcionando | `curl /t/system-design` na mesma imagem | **200** |
| O Quadro continua visível em desenvolvimento | navegador em `localhost:5173` | aba presente, 26 cards, zero erro de console |

**Uma armadilha encontrada no caminho:** o `quadro.json` é um arquivo estático
em `public/`, então o Vite o copia para o `dist` **independentemente da flag**.
Esconder a aba não escondia o dado — o arquivo continuava baixável por quem
digitasse a URL. O `Dockerfile` agora o remove quando `VITE_QUADRO` não é
`true`, e o `nginx.conf` responde 404 em `.json` inexistente em vez de devolver
o `index.html` com 200.
