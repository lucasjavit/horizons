# PLT-02 · Login com Google

**Estado:** pronto para fazer
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

- [ ] Entrar com Google cria a conta e devolve à página de origem
- [ ] `GET /auth/me` confirma a sessão; token inválido cai na tela de login
- [ ] Rota nova sem `@Public()` responde 401 sem token (**fail closed**)
- [ ] `active = false` derruba a sessão na requisição seguinte, sem esperar o
      token expirar
- [ ] `JWT_SECRET` ausente ou curto impede o boot, com erro claro
- [ ] Nenhum e-mail hardcoded no código
- [ ] Os tokens de API do PLT-01 passam a ter dono de verdade

## Depende de

- Conta no Google Cloud com OAuth client configurado (`GOOGLE_CLIENT_ID`)

## Observações

Trocar o guard mexe em tudo que já funciona. O PLT-03 cuida da migração das
contas existentes e **precisa vir junto** — separado só para o card não virar G.
