# PLT-06 · Deploy no Coolify

**Estado:** pronto para fazer
**Tamanho:** M

## Por quê

O app roda em rede local desde o começo, e o `docker-compose.yml` reflete isso:
portas publicadas no host, senha fixa no Postgres, `AUTH_DISABLED` com default
`true`. Serve para desenvolver e **não pode ir para o servidor assim** — o
[PLT-05](PLT-05-login-desligado.md) já dizia isso por escrito.

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

O `curl` de verificação é a parte que importa: `/api/tracks` sem token tem de
responder **401**. Um **200** ali significa que a aplicação inteira está aberta
na internet, e o guia diz para corrigir na hora, não para anotar como pendência.

## O que falta

**O deploy em si.** Depende de ter o servidor com Coolify no ar e o domínio
apontado — nada disso existe ainda. O que está pronto é o caminho: com o
servidor de pé, é seguir o `docs/DEPLOY.md`.

Falta também um `GOOGLE_CLIENT_ID` real com a origem pública cadastrada. O
PLT-02 exercitou o login até o ponto em que só o Google pode continuar: com um
id inventado, o botão renderiza e volta *"The given client ID is not found"*.
Com um id real e a origem cadastrada, é o mesmo caminho — mas **isso ainda não
foi verificado de ponta a ponta**, e só o será no primeiro deploy real.

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

- [ ] O recurso no Coolify aponta para `docker-compose.prod.yml`, não para o de
      desenvolvimento
- [ ] `POSTGRES_PASSWORD`, `JWT_SECRET` e `ENCRYPTION_KEY` definidas no painel,
      nenhuma com valor de exemplo
- [ ] `AUTH_DISABLED` **não** está definida no painel
- [ ] A origem pública com `https://` cadastrada em "Authorized JavaScript
      origins"; "Authorized redirect URIs" vazio
- [ ] `GET /api/auth/config` responde **200** com `authDisabled: false` e
      `enabled: true`
- [ ] `GET /api/tracks` sem token responde **401** — e o mesmo para
      `/api/auth/me` e `/api/settings/tokens`
- [ ] Entrar com Google de verdade funciona pelo domínio público, e as trilhas
      carregam com o progresso
- [ ] A engrenagem aparece para quem está em `ADMIN_EMAILS`, e só para essa
      pessoa
- [ ] Os containers ficam *healthy* (o healthcheck bate em `/api/auth/config`,
      que precisa continuar pública)
- [ ] A aba **Quadro** foi removida antes do domínio ficar público

## Depende de

- Servidor com Coolify instalado e domínio apontado
- `GOOGLE_CLIENT_ID` real, com a origem pública cadastrada no Google Cloud
  Console

## Observações

A aba **Quadro** (`/quadro`) é visível em qualquer build e expõe o backlog:
bugs conhecidos e decisões internas. O `KANBAN.md` lista os quatro itens a
apagar. **É bloqueio de publicação**, não melhoria — por isso está no critério
de aceite.

Dívida herdada do PLT-02 que continua de pé e passa a valer na internet, não
mais só na rede local: token de 30 dias em `localStorage` sem refresh (um XSS
lê o token), e `POST /auth/google` sem rate limiting.
