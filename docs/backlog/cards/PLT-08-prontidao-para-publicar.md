# PLT-08 · Prontidão para publicar, na tela

**Estado:** feito (27/08/2026) · guia de publicar na tela (28/08/2026)
**Tamanho:** M

## Por quê

O [PLT-06](PLT-06-deploy-no-coolify.md) escreveu, no próprio card, a frase que
originou este: *"o `curl` de verificação é a parte que importa, **porque nada
disso aparece na interface**"*. O material sobre publicar existia todo — as
340 linhas do `docs/DEPLOY.md`, o `.env.example`, os `${VAR:?}` do
`docker-compose.prod.yml` — e nenhum pedaço dele estava onde a pessoa
administra a aplicação.

Duas consequências práticas:

- **Um guia não sabe o estado do servidor.** O `DEPLOY.md` explica o que
  `JWT_SECRET` faz; ele não sabe se a variável chegou ao contêiner que está
  rodando agora. Responder "posso publicar?" exigia rodar `curl` à mão.
- **A pergunta que mais importa não estava escrita em lugar nenhum:** *o que
  acontece se eu trocar este valor depois?* Trocar `JWT_SECRET` desloga todo
  mundo e nada mais; trocar `ENCRYPTION_KEY` torna ilegível toda chave de IA já
  cadastrada. As duas são `openssl rand -base64 32` na tabela do guia, lado a
  lado, com a mesma cara. A diferença entre elas é destrutiva e estava só
  implícita num comentário do compose.

O `/config/ia` (JOB-36) já tinha provado o desenho certo para isto: em vez de
listar o que existe, mostrar **o que funciona agora e por quê**.

## O que faz

Uma quinta aba em Configurações, `/config/deploy` — **Going live**.

- **O veredito primeiro.** Uma frase no topo responde "posso publicar?", com a
  mesma regra que o compose e o boot aplicam (calculada no servidor, não na
  tela: duas cópias divergiriam na primeira mudança).
- **Quem consegue entrar.** `AUTH_DISABLED`, `GOOGLE_CLIENT_ID` e a contagem de
  `ADMIN_EMAILS`. Com `AUTH_DISABLED=true` a tela abre um bloco de alarme
  explicando que `GET /api/settings/tokens` responde a quem alcançar a porta —
  as chaves de IA são cifradas contra vazamento do banco, não contra uma
  requisição que chega autorizada.
- **Os quatro segredos**, cada um com: o que é, o comando para gerar (com botão
  de copiar), o que acontece se faltar, e **quanto custa trocar depois** —
  `seguro`, `desloga`, `coordenado` ou `destrutivo`.
- **Os passos de publicar, numerados, na ordem de execução** (28/08/2026).
  Antes a tela dizia só *"está em `docs/DEPLOY.md` no repositório"*, o que não
  serve para quem está no painel do Coolify: ele teria de sair, achar o arquivo
  no GitHub, e voltar.

  Nove passos, cada um ligado ao que o servidor já verificou — `Done on this
  server`, `Not done yet`, ou `You confirm this` quando a prova está fora do
  processo. É a diferença entre um guia e uma lista de tarefas viva.

**Não gera segredo, de propósito.** Um botão "generate" que devolvesse o valor
na tela criaria um caminho novo de vazamento (log do servidor, HTML, histórico
da aba) para substituir um comando de uma linha que a pessoa já roda no
servidor dela. E na `ENCRYPTION_KEY` um clique acidental tornaria ilegível toda
chave de IA já cadastrada. A tela ensina o comando; quem executa é a pessoa.

**Nenhum valor de segredo sai do backend.** Nem parcial, nem os últimos
caracteres. A regra da casa para os tokens de IA é mostrar o final da chave
(`ApiTokenDto.hint`) porque ali há várias e a pessoa precisa reconhecer qual
está guardada; aqui há um valor por ambiente — não há o que desambiguar, e cada
caractere exposto seria entropia perdida de graça. O DTO responde booleano e
**comprimento**, que é o que separa "chegou" de "chegou inteira".

## O bug que a implementação encontrou

**A primeira versão lia `process.env.POSTGRES_PASSWORD` na API, e teria dito
"Not set" num servidor de produção corretamente configurado.**

Nos **dois** compose a variável vai só para o contêiner do banco. A API recebe
a senha já embutida na `DATABASE_URL`, montada pelo compose:

```
DATABASE_URL: postgresql://horizons:${POSTGRES_PASSWORD}@db:5432/horizons
```

Medido rodando `docker compose -f docker-compose.prod.yml config` com
`POSTGRES_PASSWORD=SenhaTeste123`: no serviço `api` só existe a `DATABASE_URL`
— não há `POSTGRES_PASSWORD` nenhuma.

Uma tela de estado que erra sobre o próprio estado é pior que tela nenhuma,
porque as decisões passam a se apoiar nela. A leitura passou a vir da
`DATABASE_URL`, com `decodeURIComponent` (uma senha com `@` chega como `%40`, e
3 caracteres escapados não são 3 caracteres de senha).

De quebra, isso deu um sinal que a leitura da variável não daria: a senha do
compose de desenvolvimento é `horizons`, **pública no repositório**. Encontrá-la
não é "senha fraca", é senha conhecida — a tela marca como `Too weak`, não
como `Set`.

## O guia na tela (28/08/2026)

### O que entrou, e o que ficou no arquivo

O critério: **vai para a tela o que se faz COM a tela aberta**, e o que a
página já sabe verificar. Fica no arquivo a referência longa, o histórico e o
diagnóstico de caso raro.

| Seção do `DEPLOY.md` | Onde ficou | Por quê |
| --- | --- | --- |
| 1. Criar o recurso | **tela** | é o formulário do Coolify, preenchido com a tela do lado |
| 2. Variáveis | **arquivo** | a tela **já tem** os quatro segredos, com comando e custo de rotação. Repetir daria duas verdades para divergir na primeira mudança |
| 3. Google OAuth | **tela** | é o passo que travou o stakeholder, e o sintoma não sugere a causa |
| 4. Verificar depois | **tela** | os `curl` viraram blocos copiáveis; é o que se roda logo após publicar |
| 5. Se der errado | **arquivo** | diagnóstico: na maior parte desses estados **a aplicação não sobe**, e uma página que só existe com o servidor de pé não é onde se lê como consertar um servidor que não está |
| 6. Antes do 1º deploy público | **tela** | virou o passo do backlog vazado, com o `curl /quadro.json` |
| 7. Google aparece mas não entra | **arquivo**, menos a regra de origem | a forense de TLS (issuer do Traefik, 503, acme-challenge) é caso raro; a **regra de origem** subiu para o passo 3 da tela |
| 8. O que já foi verificado | **arquivo** | registro histórico de 14/08, não passo de execução |

`docs/DEPLOY.md` **passou a apontar para a tela** em vez de repetir os passos.
Escolher um dos dois era obrigatório: dois guias sempre divergem.

### O segundo bug que a implementação encontrou

**`NODE_ENV` não distingue desenvolvimento de produção neste projeto.** A
primeira versão do aviso *"este não é o servidor de produção"* usava
`process.env.NODE_ENV !== 'production'` — e ficaria **apagado exatamente na
máquina que precisa dele**.

Medido no contêiner de desenvolvimento:

```
NODE_ENV=[production]
```

O Dockerfile é o mesmo nos dois compose e constrói a imagem de produção sempre.
O sinal que de fato separa os dois é o valor **público**: o
`docker-compose.yml` embute a senha `horizons` e `CORS_ORIGIN:
http://localhost:5173`, enquanto o de produção exige `${VAR:?}` em ambos e
recusa subir sem eles. Achar um valor público prova que o processo subiu pelo
compose de desenvolvimento.

### O que a tela mede, e o que ela declara não saber

Dos nove passos, **cinco** são verificáveis por este processo e **quatro** são
`You confirm this` — Coolify, TLS, `VITE_QUADRO` e a requisição vinda de fora.
Marcá-los como pendentes sugeriria que um redeploy resolve; marcá-los como
cumpridos seria mentira. O selo é cinza, e não verde nem vermelho.

### Custo de altura, medido

O recolhimento é a decisão de desenho, e o número é o argumento:

| Estado | Desktop | 390px |
| --- | --- | --- |
| Antes do guia | 2.759px | 3.951px |
| **Com o guia, recolhido (padrão)** | **2.894px (+4,9%)** | **4.127px (+4,5%)** |
| Com os 9 passos abertos | 5.909px (2,1×) | 9.419px (2,4×) |

Aberto por padrão, o guia **dobrava** a página e empurrava para fora da tela o
alarme de `AUTH_DISABLED` e o veredito — que é o que alguém abre esta página
para ver. Recolhido, custa uma linha. O alarme e o resumo continuam no topo.

Vários passos podem ficar abertos ao mesmo tempo: um acordeão que fecha o
anterior atrapalharia quem compara dois passos.

## Critérios de aceite

- [x] A rota é `@AdminOnly()` — medido: sem token **401**, token inválido
      **401**, token de usuário comum **403**, admin **200**
- [x] Nenhum valor de segredo na resposta da API nem no DOM — medido no
      navegador: `JWT_SECRET` e `ENCRYPTION_KEY` ausentes do HTML, **e também
      seus 8 primeiros e 8 últimos caracteres**
- [x] A tela mostra o estado real do servidor, não só instruções
- [x] `AUTH_DISABLED=true` dispara um bloco de alarme próprio
- [x] Cada segredo diz se pode ser trocado depois
- [x] Botão de copiar funciona e tem retorno visível **e** anunciado
      (`role="status"`); alvo de 32px
- [x] Dois temas e 390px conferidos no navegador
- [x] `scripts/qa-rapido.py` passa inteiro

Do guia (28/08/2026):

- [x] Passos numerados na ordem de execução, seguíveis sem abrir outra aba
- [x] Cada passo ligado ao que o servidor verificou — medido: 3 `cumprido`,
      2 `pendente`, 4 `manual`, batendo com a resposta da API
- [x] A regra de origem do Google (HTTPS obrigatório, IP cru recusado,
      `localhost` isento) está no passo 3
- [x] O recolhimento faz o trabalho — medido: +4,9% desktop e +4,5% em 390px,
      contra 2,1× e 2,4× se aberto
- [x] Alarme de `AUTH_DISABLED` e resumo continuam no topo
- [x] Teclado: guia e cada passo abrem e fecham por Enter, com foco visível
- [x] Nenhum valor de segredo no DOM nem na API — reconferido com o guia
      aberto: `JWT_SECRET` e `ENCRYPTION_KEY` ausentes, e a `DATABASE_URL`
      inteira e o par `user:senha@` também
- [x] Dois temas e 390px, sem overflow horizontal e sem erro de console
- [x] `docs/DEPLOY.md` aponta para a tela em vez de repetir os passos

## O que esta tela ainda não responde

Vale escrito, porque é o que alguém vai procurar aqui e não vai achar:

- **Se a origem está cadastrada no Google Cloud Console.** A tela vê que
  `GOOGLE_CLIENT_ID` existe; ela não tem como saber se
  `https://seudominio` está em *Authorized JavaScript origins*. O sintoma
  (`The given client ID is not found`) só aparece quando alguém clica em
  entrar, e continua no `DEPLOY.md`.
- **Se o TLS está de pé** e se o certificado é do Let's Encrypt ou o padrão do
  Traefik. É de fora do processo, e o `DEPLOY.md` tem o `openssl s_client` que
  distingue os dois.
- **Se a `ENCRYPTION_KEY` é a MESMA de antes.** A tela vê que existe uma chave
  de 44 caracteres; ela não sabe se é a que cifrou o que está no banco. O
  sintoma de ter trocado é a decifragem falhar ao ler um token — e é por isso
  que a tela insiste em guardá-la num cofre.
- **Se `VITE_QUADRO` vazou para o build**, que é do frontend e não do processo
  da API. O `curl /quadro.json` do `DEPLOY.md` continua sendo o teste.
- **O estado do servidor de produção.** A tela lê o processo em que ela mesma
  roda: aberta em desenvolvimento, descreve o desenvolvimento. **Desde
  28/08/2026 ela avisa** quando detecta valores de desenvolvimento, em vez de
  deixar o "cumprido" verde ser lido como produção pronta.

## Onde mexeu

- `backend/src/settings/deploy.service.ts` (novo) — lê o ambiente do processo
- `backend/src/settings/deploy.controller.ts` (novo) — `@AdminOnly()`
- `backend/src/settings/settings.module.ts`
- `frontend/src/pages/ConfigDeployPage.tsx` (novo)
- `frontend/src/components/settings/BotaoDeCopiar.tsx` (novo) — com queda para
  `execCommand`, porque `navigator.clipboard` não existe em `http://` fora de
  `localhost`
- `frontend/src/components/settings/AbasDeConfig.tsx`, `App.tsx`,
  `lib/api.ts`, `types/api.ts`

Do guia (28/08/2026):

- `backend/src/settings/deploy.service.ts` — `passos` e
  `ambienteDeDesenvolvimento` no DTO; só o **estado** cruza a rede, o texto é
  interface
- `frontend/src/pages/ConfigDeployPage.tsx` — a constante `PASSOS`, e
  `GuiaDePublicar` / `PassoDoGuia` / `SeloDePasso` sobre o `Recolhivel` que já
  existia
- `frontend/src/types/api.ts`, `docs/DEPLOY.md`
