# PLT-06 · Deploy no Coolify

**Estado:** feito (15/08/2026)
**Tamanho:** M

## Por quê

O app rodava em rede local desde o começo, e o `docker-compose.yml` refletia
isso: portas publicadas no host, senha fixa no Postgres, e `AUTH_DISABLED` com
default `true` — esquecer a variável **abria** o acesso. Servia para
desenvolver e **não podia ir para o servidor assim**, como o
[PLT-05](PLT-05-login-desligado.md) já dizia por escrito.

(O default de `AUTH_DISABLED` foi invertido para `false` nos dois compose ao
preparar o deploy: esquecer passou a fechar, nunca abrir.)

Publicar não é só apontar um domínio: é separar o compose de produção do de
desenvolvimento, tirar os defaults inseguros do caminho e ter como **verificar
depois** que o login está mesmo ligado. Um deploy que sobe com a autenticação
desligada não avisa ninguém pela interface — a aplicação simplesmente entra
direto, que é exatamente o que ela faz hoje na máquina local.

O Coolify foi escolhido porque faz deploy a partir do repositório Git com
docker-compose e roteia por Traefik, então o HTTPS e o domínio saem dele. Não
há Dockerfile novo nem mudança de arquitetura.

## O que faz

- `docker-compose.prod.yml`: sem portas publicadas no host (o Traefik alcança
  os serviços pela rede interna), senha do Postgres por variável, e
  `AUTH_DISABLED` com default `false`.
- `docs/DEPLOY.md`: passo a passo com o painel aberto na frente — criar o
  recurso, a tabela de variáveis (nome, obrigatória, como gerar, o que acontece
  se faltar), o cadastro da origem no Google Cloud Console, os `curl` de
  verificação e uma seção "Se der errado" com os sintomas prováveis.

O `curl` de verificação é a parte que importa, porque nada disso aparece na
interface: uma aplicação com o login desligado entra direto, e uma com o
backlog publicado tem a mesma cara de uma correta. O sinal é `authDisabled` no
`/api/auth/config` e o **401** nas rotas privadas.

(Este card foi escrito quando `/api/tracks` também exigia 401. O
[PLT-07](PLT-07-leitura-anonima.md) tornou a leitura pública de propósito no
mesmo dia, e o `DEPLOY.md` foi corrigido — seguir a versão antiga faria alguém
tratar um 200 correto como falha.)

## Feito

**O deploy está no ar, em HTTPS, e o login funciona.**

Endereço: `https://ojxqz4v8x7jda764e6p3k419.169.58.152.158.sslip.io`

Isso fecha o que o PLT-02 tinha deixado em aberto desde o começo. O login
estava implementado e verificado até o ponto em que só o Google podia
continuar; agora a origem está aceita e o console do navegador não reclama
mais.

Encerra o [PLT-05](PLT-05-login-desligado.md) na prática: `AUTH_DISABLED` era
temporário e valia só em rede local. Em produção o login está exigido —
`authDisabled: false`, medido.

## Riscos que existiram, e onde foram corrigidos

Registrados porque o compose de desenvolvimento continua no repositório com
todos eles. Quem apontar o Coolify para o arquivo errado herda os três de uma
vez.

| O que | Por que é risco | Onde foi tratado |
| --- | --- | --- |
| `AUTH_DISABLED: ${AUTH_DISABLED:-true}` | O default **inseguro**: subir sem definir nada desligava o login inteiro. Nenhuma rota exigiria token e `/api/settings/tokens` — onde ficam as chaves de IA — responderia a qualquer um. | Default `false` no compose de produção; o `DEPLOY.md` manda **não definir** a variável e explica o que ela abre. |
| `POSTGRES_PASSWORD: horizons` | Senha fixa, commitada, igual ao usuário e ao nome do banco. | Passou a vir de variável no compose de produção; obrigatória na tabela do `DEPLOY.md`. |
| Portas `5433`, `3333` e `5173` publicadas no host | No servidor, expõem o Postgres e a API direto na internet, contornando o Traefik e o HTTPS. | O compose de produção não publica portas; o acesso é só pela rede interna, via Traefik. |

Nenhum dos três foi explorado — o app nunca saiu da rede local. Ficam
registrados porque *estiveram lá*, e porque a correção mora num arquivo
separado que alguém pode não usar.

Vale notar o que **não** foi mudado: `ENCRYPTION_KEY` já não tinha default no
`.env.example`, e `ADMIN_EMAILS` já falhava para "ninguém é admin" quando vazia
— decisão do PLT-02, e ela se sustenta em produção.

## Critério de aceite

- [x] O recurso no Coolify aponta para `docker-compose.prod.yml`
- [x] `POSTGRES_PASSWORD`, `JWT_SECRET` e `ENCRYPTION_KEY` definidas no painel
- [x] `AUTH_DISABLED` **não** está definida no painel
- [x] Os containers ficam *healthy*
- [x] A aba **Quadro** fica fora do build público
- [x] `/api/auth/me` e `/api/settings/tokens` sem token respondem **401**
- [x] `/api/tracks` responde **200** com `completedLessons: 0` (leitura anônima
      do PLT-07 — **não** é mais para dar 401)
- [x] `/quadro.json` responde **404**
- [x] A origem pública cadastrada em "Authorized JavaScript origins", com
      `https://`; redirect URIs vazio
- [x] O Google aceita a origem — **zero erro de console**, onde antes vinha
      *"The given origin is not allowed"*
- [ ] A engrenagem só para quem está em `ADMIN_EMAILS` — depende de entrar com
      uma conta e conferir; não fiz

## Verificado no ar

Duas rodadas: 14/08 em `http`, e 15/08 depois do HTTPS. A tabela é a segunda.

Domínio: `https://ojxqz4v8x7jda764e6p3k419.169.58.152.158.sslip.io`, o
automático do Coolify.

| O que | Resultado |
| --- | --- |
| Certificado | **Let's Encrypt** válido (`issuer=C=US, O=Let's Encrypt, CN=YR2`) |
| `http://` | **302** — redireciona para HTTPS |

| `/api/auth/config` | `enabled: true`, **`authDisabled: false`** — login exigido |
| `/api/auth/me`, `/api/settings/tokens` sem token | **401** nos dois |
| `/quadro.json` | **404** — o backlog não vazou |
| `/quadro` no navegador | "Página não encontrada" |
| `/api/tracks` sem token | **200**, `completedLessons: 0` |
| Aula sem sessão | **200**, `completed: false`, `note: null` — o 500 do PLT-07 não está no ar |
| `Bearer abc.def.ghi` | **401** — token inválido não vira anônimo |
| `PUT /progress/:id` sem sessão | **401** |
| Navegador, claro e escuro | home nas trilhas, botão do Google na barra, sem aba Quadro, **zero erro de console** |

## O bloqueio que existiu: `http` não serve para o Google (resolvido)

Por um dia o login ficou inacessível no ar. O botão renderizava, e o Google
recusava:

```
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
```

A causa **não** é o cadastro da origem — é o protocolo. `location.origin` no ar
é `http://ojxqz4v8x7jda764e6p3k419…`, e o Google Sign-In só aceita origens
`https://`, com `localhost` como única exceção. Cadastrar a origem com `http`
no Google Cloud Console não resolve: o formato é rejeitado no próprio cadastro.

Medido: `https://` no mesmo domínio **não responde** (`000`), e `http://`
devolve 200 sem redirecionar. O TLS não está ativo para este domínio.

**Resolvido em 15/08/2026**, no painel do Coolify — nenhuma linha de código
mudou. O caminho, na ordem que importa:

1. HTTPS ligado no serviço `web`; o Coolify emitiu Let's Encrypt (`issuer=CN=YR2`).
2. A origem cadastrada **com `https://`** em "Authorized JavaScript origins".
   Redirect URIs segue vazio.
3. `CORS_ORIGIN` no mesmo `https://…`.

A ordem não é detalhe: cadastrar a origem antes de o TLS estar de pé não
funciona, porque o Google **rejeita URLs `http` no próprio formulário**.

Houve um estado intermediário que confundiu: o `443` respondia, mas com
`CN=TRAEFIK DEFAULT CERT` e **503** por trás — o Traefik anunciava a porta sem
ter rota para o container. O sinal de que o certificado não tinha sido pedido
era o `/.well-known/acme-challenge/` cair no 404 do app, em vez de ser
respondido pelo proxy.

Nesse período, tudo o que não depende de login continuou funcionando. Foi o
[PLT-07](PLT-07-leitura-anonima.md) que salvou o deploy de ser inútil — sem a
leitura anônima, do mesmo dia, o site inteiro estaria inacessível.

## Depende de

- Servidor com Coolify instalado e domínio apontado
- `GOOGLE_CLIENT_ID` real, com a origem pública cadastrada no Google Cloud
  Console

## Observações

A aba **Quadro** deixou de ser bloqueio manual: sai do build por
`VITE_QUADRO`, que o `docker-compose.prod.yml` passa vazio. O `Dockerfile`
também apaga o `quadro.json` do `dist` — o arquivo é estático em `public/`, e
sem isso esconder a aba não escondia o dado, que continuava baixável pela URL.

O critério de verificação mudou depois deste card ser escrito: o
[PLT-07](PLT-07-leitura-anonima.md) tornou `/api/tracks` **pública de
propósito**. O guia mandava tratar `200` ali como falha de segurança, o que
hoje faria alguém "corrigir" o comportamento correto. Corrigido no `DEPLOY.md`,
com nota explicando a mudança. O que define se o login está ligado é o
`authDisabled` do `/api/auth/config` e o 401 nas rotas privadas.

Dívida herdada do PLT-02 que continua de pé e passa a valer na internet, não
mais só na rede local: token de 30 dias em `localStorage` sem refresh (um XSS
lê o token), e `POST /auth/google` sem rate limiting.
