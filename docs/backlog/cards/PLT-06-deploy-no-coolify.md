# PLT-06 · Deploy no Coolify

**Estado:** feito (14/08/2026)
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

O `curl` de verificação é a parte que importa: `/api/tracks` sem token tem de
responder **401**. Um **200** ali significa que a aplicação inteira está aberta
na internet, e o guia diz para corrigir na hora, não para anotar como pendência.

## Feito

**O deploy está no ar, e o login funciona** — relatado pelo stakeholder em
14/08/2026.

Isso fecha o que o PLT-02 tinha deixado em aberto desde o começo: o login com
Google estava implementado e verificado até o ponto em que só o Google podia
continuar (com um id inventado, o botão renderizava e voltava *"The given
client ID is not found"*). Agora entrou de verdade, por um domínio público,
com a origem cadastrada.

Também encerra o [PLT-05](PLT-05-login-desligado.md) na prática: `AUTH_DISABLED`
era temporário e valia só em rede local.

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

Marcados a partir do relato de quem fez o deploy — **não conferidos por mim
contra o domínio**, que não me foi informado. Veja "O que não foi verificado".

- [x] O recurso no Coolify aponta para `docker-compose.prod.yml`
- [x] `POSTGRES_PASSWORD`, `JWT_SECRET` e `ENCRYPTION_KEY` definidas no painel
- [x] `AUTH_DISABLED` **não** está definida no painel
- [x] A origem pública com `https://` cadastrada em "Authorized JavaScript
      origins"; "Authorized redirect URIs" vazio
- [x] Entrar com Google de verdade funciona pelo domínio público
- [x] Os containers ficam *healthy*
- [x] A aba **Quadro** fica fora do build público

Estes dependem de rodar `curl` contra o domínio e continuam abertos:

- [ ] `/api/auth/me` e `/api/settings/tokens` sem token respondem **401**
- [ ] `/api/tracks` responde **200** com `completedLessons: 0` (leitura anônima
      do PLT-07 — **não** é mais para dar 401)
- [ ] `/quadro.json` responde **404**
- [ ] A engrenagem aparece só para quem está em `ADMIN_EMAILS`

## O que não foi verificado

O domínio não me foi passado, então **não rodei nenhum comando contra o que
está no ar**. O que está marcado acima vem do relato do stakeholder.

Os quatro itens abertos são os que se verificam em um minuto, e valem a pena
justamente porque nenhum deles aparece na interface: uma aplicação com o login
desligado ou com o backlog publicado tem exatamente a mesma aparência de uma
correta. Os comandos estão em [docs/DEPLOY.md](../../DEPLOY.md).

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
