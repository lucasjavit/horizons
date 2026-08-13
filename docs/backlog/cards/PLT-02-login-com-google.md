# PLT-02 · Login com Google

**Estado:** feito (13/08/2026)
**Tamanho:** M
**Decisão do stakeholder (13/08/2026):** "vamos fazer a parte do usuário
primeiro, pegue do arguição."

## Por quê

É a decisão que trava o projeto desde o começo. O `CurrentUserGuard` lê
`x-user-email`, cria a conta se não existir e **nunca rejeita** — qualquer um
vira qualquer um mandando um header.

Isso já custa hoje: os tokens de API do PLT-01 estão guardados **sem dono
real**, e o risco está escrito no comentário do controller. E trava tudo o que
vem: perfil de busca, vagas salvas, histórico de invoice.

## O que vem do arguição, e o que não vem

O arguição **não tem cadastro com senha**. O schema dele diz literalmente:

> `-- Accounts come from an OAuth provider; there is no local password.`

É só Google Sign-In. Não há hash, reset de senha, verificação de e-mail nem
refresh token para portar — mas a **arquitetura de sessão** é boa e vale copiar.

**Portar:**

- `AuthGuard` global via `APP_GUARD`, com **fail closed**: rota nova nasce
  protegida a menos que marque `@Public()`. Esquecer o decorator não abre buraco.
- `verify()` **relê o usuário do banco a cada request** — conta desativada para
  de funcionar na hora, mesmo com token válido.
- O trio `@Public` / `@AdminOnly` / `@CurrentUser`.
- `GET /auth/config`, para o front saber se o login está disponível em vez de
  mostrar um botão morto.
- O bootstrap do front: token só é confiado depois que `/auth/me` confirma.
- Os testes de revogação: *"role revogada depois do token emitido"* e *"conta
  desativada depois do token emitido"*.

**Não portar:**

- `LEGACY_DATA_OWNER` / `claimOrphanData` — um e-mail pessoal hardcoded que
  adota todas as linhas órfãs, rodando em todo login para sempre. É script de
  migração disfarçado de feature.
- `ADMIN_EMAILS` com default hardcoded: se a variável some, um e-mail vira
  admin em silêncio. Default de segurança é **ninguém**.
- Token de 30 dias em `localStorage` sem refresh.
- Ausência de validação de entrada — aqui o `ValidationPipe` global com
  `forbidNonWhitelisted` já existe; usar DTOs.
- `enableCors({ origin: true })` e a falta de rate limiting.
- Validar `JWT_SECRET` em tempo de request devolvendo 401. Erro de configuração
  do servidor não é erro de autenticação: validar **no boot**.

## Schema

`User` já tem `id`, `email @unique`, `name`, `progress[]`, `tokens[]`.
Acrescentar `avatarUrl`, `provider`, `providerId`, `role`, `active`,
`lastLoginAt`, mais `@@index([provider, providerId])`.

`role` como `String`, não enum: o `tsconfig.app.json` proíbe enum de TS
(`erasableSyntaxOnly`), e o padrão da casa para dois valores é união de string.

## Critério de aceite

- [x] Entrar com Google cria a conta e devolve à página de origem
- [x] `GET /auth/me` confirma a sessão; token inválido cai na tela de login
- [x] Rota nova sem `@Public()` responde 401 sem token (**fail closed**)
- [x] `active = false` derruba a sessão na requisição seguinte, sem esperar o
      token expirar
- [x] `JWT_SECRET` ausente ou curto impede o boot, com erro claro
- [x] Nenhum e-mail hardcoded no código
- [x] Os tokens de API do PLT-01 passam a ter dono de verdade

## Depende de

- Conta no Google Cloud com OAuth client configurado (`GOOGLE_CLIENT_ID`)

## Observações

Trocar o guard mexe em tudo que já funciona. O PLT-03 cuida da migração das
contas existentes e **precisa vir junto** — separado só para o card não virar G.

## O que foi verificado (13/08/2026)

Tudo medido com os containers no ar, não pelo build.

| O que | Resultado |
| --- | --- |
| `/api/tracks`, `/api/auth/me`, `/api/settings/tokens` sem token | **401** nos três |
| `x-user-email: eu@horizons.local` (o header que antes abria tudo) | **401** — a porta velha fechou |
| `Bearer abc.def.ghi` | **401** |
| `/api/auth/config` sem token | **200**, `{"enabled":false}` |
| `JWT_SECRET=curto` | boot recusado: *"JWT_SECRET ausente ou curta demais (minimo 16 caracteres) — veja backend/.env.example"* |
| `active=false` no banco, token ainda válido | 401 na requisição **seguinte** |
| `role` promovido a ADMIN no banco, token diz USER | `/settings/tokens` **200** |
| `role` rebaixado a USER, mesmo token | `/settings/tokens` **403** |
| Tela sem `GOOGLE_CLIENT_ID` | mensagem "Login indisponível", **sem** baixar o script do Google |
| Tela com client id | botão oficial do Google renderiza (iframe de `accounts.google.com`) |
| Sessão restaurada de `localStorage` | trilhas carregam, zero erro de console |
| "Sair" | volta ao login e limpa o `localStorage` |
| Engrenagem | ausente para USER, presente para ADMIN, e Configurações abre |
| `ADMIN_EMAILS` com o e-mail | login promove a ADMIN |
| `ADMIN_EMAILS` vazio | login rebaixa a USER — **ninguém** é admin por omissão |

O papel é reavaliado a cada login (`role` também no `update` do upsert). O
efeito colateral é deliberado: promover alguém direto no banco não sobrevive ao
próximo login. A variável de ambiente é a fonte da verdade, e é o que impede
uma promoção manual esquecida de virar admin permanente.

**O que não foi verificado:** a entrada de verdade pelo Google, que precisa de
um `GOOGLE_CLIENT_ID` real com a origem cadastrada. O caminho foi exercitado
até o ponto em que só o Google pode continuar — o botão renderiza e o 403 que
volta é exatamente *"The given client ID is not found"*, o esperado para um id
inventado.

## Efeitos colaterais tratados

- **O healthcheck do compose batia em `/api/tracks`**, que agora exige token.
  Ficaria eternamente *unhealthy* e derrubaria o container. Passou a bater em
  `/api/auth/config`, que é público por natureza.
- **O `scripts/qa-rapido.py` parou de funcionar** — sem sessão, ele abria a
  tela de login e reprovava tudo. Agora assina um token de teste com o segredo
  de dentro do próprio container (ele não conhece o segredo, e não deveria), e
  ganhou quatro checagens novas do *fail closed*.

## Dívida registrada

- Token de 30 dias em `localStorage`, sem refresh. Um XSS lê o token. A defesa
  que existe é o backend reler o usuário a cada request, então desativar a
  conta corta a sessão na hora. Cookie `httpOnly` seria melhor.
- Sem rate limiting em `POST /auth/google`.
