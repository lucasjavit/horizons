# JOB-32 · Telegram como segundo canal de notificação

**Estado:** feito (24/08/2026) — falta token real de bot
**Tamanho:** M

## Por quê

O e-mail do [JOB-24](JOB-24-email-semanal.md) está inteiro e conferido, e não
entrega nada. O provedor padrão registra no log porque não há SMTP — e o
caminho para haver SMTP não é preencher uma variável.

**Os dois melhores planos gratuitos (Resend e Brevo) exigem domínio próprio
verificado**, com DKIM, SPF e DMARC. Isso é comprar domínio, configurar DNS e
esperar propagação antes do primeiro e-mail sair. É um custo real, e é ele que
hoje trava a única coisa que o produto promete fazer sozinho:

> "Vamos encontrar uma vaga para você e te mando um email."

O Telegram entrega sem domínio, sem DNS e sem custo: um bot criado no
@BotFather devolve um token, e o envio é `POST
api.telegram.org/bot<TOKEN>/sendMessage` com `{chat_id, text}`.

**Isso não substitui o e-mail** — decidido nesta conversa (24/08/2026). É canal
adicional. O trade-off está em [Trade-off registrado](#trade-off-registrado)
abaixo, e é o motivo de o e-mail continuar existindo.

## O que fazer

A pessoa liga "Receber no Telegram" na aba Jobs, vincula a conta, e passa a
receber a **mesma seleção de vagas** do e-mail semanal por lá — respeitando a
mesma cadência (semanal, ou mensal para quem clicou "consegui a vaga").

Pode ter os dois canais ligados ao mesmo tempo, um só, ou nenhum.

## A restrição que decide o desenho

**Um bot do Telegram não pode iniciar conversa com quem nunca falou com ele.**
É anti-spam por design da plataforma, e não tem contorno — não existe "mandar
para um @usuario". O `chat_id`, que é o endereço de entrega, só passa a existir
depois que a pessoa aperta START no bot.

Confirmado na documentação oficial da Bot API. O que ela dá para tornar isso
suportável é o deep link: `t.me/<bot>?start=<token>` chega ao bot como
`/start <token>`, e o parâmetro aceita **até 64 caracteres de `A-Z a-z 0-9 _ -`**
— cabe um UUID.

O fluxo de vinculação que isso obriga:

1. A pessoa clica "Receber no Telegram" no Horizons
2. O backend gera um token de uso único e abre `t.me/<bot>?start=<token>`
3. A pessoa aperta START no app do Telegram
4. O bot recebe `/start <token>` e daí se obtém o `chat_id`
5. Grava (token → userId → chatId) e **invalida o token**

Quem for implementar precisa saber disso antes de estimar: não é "salvar o
usuário do Telegram num campo de texto". Sem os cinco passos, não há entrega.

## Trade-off registrado

**Troca custo de infraestrutura por custo de conversão.**

| | E-mail | Telegram |
| --- | --- | --- |
| Custo para ligar | domínio + DNS + verificação | criar bot, colar token |
| Endereço já se tem? | sim, o Google entrega verificado no login | não, exige vinculação |
| Passos até o primeiro envio | zero para o usuário | ter o app, sair do site, apertar START |

**Cada passo perde gente.** O e-mail já está na mão: o login com Google entrega
o endereço verificado, e a pessoa não faz nada. O Telegram pede três coisas, e
quem não tem o app instalado provavelmente não instala para receber vaga.

O público do Horizons é dev brasileiro buscando vaga fora. Telegram é forte
entre devs — mas não é universal, e ninguém mediu quanto dele existe *neste*
público. **A taxa de vinculação é o número que este card produz**, e é o que
decide se vale investir mais no canal.

## Decisão de arquitetura: abstração compartilhada, não módulo paralelo

**Generalizar o transporte, não duplicar a seleção.** O `EmailProvider` já é
abstrato de propósito, e a mesma seleção de vagas ("novas desde o último envio,
respeitando a cadência") deve servir os dois canais.

O que **não** fazer: um módulo `telegram/` paralelo com sua própria varredura
de vagas. Seriam duas implementações da regra que define o produto, e a
segunda divergiria da primeira na primeira correção — como já quase aconteceu
no JOB-24, onde o agendador gateava numa condição diferente do serviço e virou
código morto por um dia.

O que fazer: **`NotificacaoProvider`**, com `EmailProvider` e
`TelegramProvider` como implementações, e a seleção de vagas acima dos dois.

O detalhe que não pode ser ignorado ao generalizar: a `Mensagem` de hoje tem
`para: string` (um endereço de e-mail), `html` e `texto`. Telegram não aceita
nenhum dos três — o destino é um `chat_id` numérico, e o corpo não é HTML de
e-mail. Então a abstração **não é a `Mensagem` atual renomeada**. O que se
compartilha é a seleção e os dados da vaga (`DadosDoEmail`, que já existe em
`email-corpo.ts`); a renderização é por canal, e `montarCorpo` ganha um irmão.

Se ao implementar isso se mostrar mais custoso que o previsto, **registre no
card por que** — mas o custo de duplicar a seleção é maior, e essa parte não
está em aberto.

## O interruptor

Convenção da casa: funcionalidade nova nasce com interruptor, e desligar um
motor não derruba a feature.

**Sem `TELEGRAM_BOT_TOKEN`, o canal fica inerte e registra no log**, exatamente
como o `EmailLogProvider` faz hoje. A aplicação sobe, a aba Jobs abre, o e-mail
continua funcionando, e a opção "Receber no Telegram" não aparece — em vez de
aparecer e falhar no clique.

**O interruptor vale para o webhook também**: sem token, a rota pública não se
registra no Telegram e não fica de pé. Feature desligada não deve deixar
superfície exposta para trás — é a mesma lição do `quadro.json`, que continuava
baixável pela URL depois de a aba sumir.

E a mesma regra do JOB-24 vale aqui: **provedor que não entrega não avança o
carimbo de último envio**. Se o log fingisse entrega, no dia em que o token
real entrasse a pessoa receberia um começo do zero, como se as semanas
anteriores tivessem sido entregues.

## Critérios de aceite

- [ ] Sem `TELEGRAM_BOT_TOKEN`: a app sobe, a aba Jobs abre, a opção "Receber no
      Telegram" **não aparece**, e o log diz uma vez no boot que o canal está
      desligado
- [ ] Com o token preenchido, a opção aparece na aba Jobs junto de
      `AssinaturaEmail.tsx`, e diz que é adicional ao e-mail (não "em vez de")
- [ ] Clicar em "Receber no Telegram" abre `t.me/<bot>?start=<token>` com um
      token de no máximo 64 caracteres, só `A-Z a-z 0-9 _ -`
- [ ] Apertar START no Telegram faz o Horizons mostrar o canal como vinculado
      **sem a pessoa recarregar a página**
- [ ] Depois de vinculado, um token já usado **não vincula uma segunda conta**
- [ ] Token de vinculação nunca aparece em resposta de API (é credencial, mesma
      regra do token do JOB-24)
- [ ] Rodar a notificação com os dois canais ligados envia **uma mensagem em
      cada** — e a lista de vagas é a mesma nos dois
- [ ] Quem tem só o Telegram ligado recebe pelo Telegram e **nenhum e-mail**
- [ ] Desvincular é um clique, e o `chat_id` some do banco
- [ ] Semana sem vaga nova: **nenhuma mensagem** no Telegram (mesma regra do
      e-mail — mensagem vazia treina a pessoa a ignorar)
- [ ] Quem clicou "consegui a vaga" recebe no Telegram **uma vez por mês**, não
      por semana
- [ ] Falha na chamada ao Telegram registra o motivo no log e **não avança o
      carimbo de último envio** daquele canal
- [ ] Um update real do Telegram (o `/start` de verdade, com o objeto inteiro
      que ele manda) **não toma 400** do `ValidationPipe` — conferido com o
      corpo capturado do bot, não com um exemplo montado à mão
- [ ] A rota do webhook é a **única** rota pública nova da feature, e responde
      sem sessão; as demais continuam exigindo login
- [ ] Sem `TELEGRAM_BOT_TOKEN`, a rota do webhook **não fica de pé**

## Casos de borda

- **A pessoa abre o deep link e não aperta START.** O token fica pendente. Deve
  expirar (sugestão: 30 min) e o botão volta a oferecer vincular, em vez de
  ficar "aguardando" para sempre.
- **A pessoa bloqueia o bot depois de vincular.** O Telegram responde com erro
  ao enviar (403 `bot was blocked by the user`). Isso é um descadastro de fato:
  marcar o canal como inativo em vez de tentar de novo toda semana.
- **A pessoa apaga a conversa e aperta START de novo.** O `chat_id` é o mesmo —
  não pode criar vínculo duplicado.
- **Duas contas do Horizons tentam vincular o mesmo `chat_id`.** Decidir e
  registrar: hoje a inclinação é recusar a segunda, porque um `chat_id`
  recebendo vagas de dois perfis diferentes é confusão sem dono.
- **Vaga com título muito longo, ou muitas vagas.** `sendMessage` tem limite de
  4096 caracteres por mensagem. Truncar com "ver todas no Horizons" é
  preferível a quebrar em cinco mensagens.
- **Caractere especial no título da vaga.** O escape do Telegram é diferente do
  HTML — o `escaparHtml` do e-mail não serve. O JOB-24 já levou um susto com
  `<script>` no corpo; a versão Telegram precisa do teste equivalente.
- **`url` da vaga com esquema `javascript:`.** Nota pré-existente registrada no
  JOB-24. Não é deste card, mas o link do Telegram herda o mesmo dado.

## Fora de escopo

- **Substituir o e-mail.** Decisão de produto: o Telegram é adicional.
- Conversar com o bot (perguntar, filtrar, buscar vaga por comando). Aqui ele
  só entrega.
- WhatsApp, Discord, Slack. Se a abstração ficar certa, cada um vira um card de
  uma implementação — mas nenhum é escopo agora.
- Botões inline do Telegram para "consegui a vaga" / "não quero mais". A
  primeira versão pode levar os mesmos links de um clique do e-mail, que já
  funcionam sem login (`EmailAcaoPage.tsx`).
- Medir a taxa de vinculação num painel. O número importa, mas contá-lo à mão
  no banco resolve a primeira pergunta.

## Depende de

- [JOB-24](JOB-24-email-semanal.md) — feito. É de onde vêm a seleção de vagas, a
  cadência, o `EmailProvider` abstrato e o `DadosDoEmail`.
- [JOB-25](JOB-25-consegui-a-vaga.md) — feito. A cadência mensal vale nos dois
  canais.
- [JOB-26](JOB-26-historico-do-usuario.md) — não bloqueia, mas o mesmo motivo
  vale aqui: canal que repete vaga vira ruído mais rápido no celular que na
  caixa de entrada.

## Decidido (24/08/2026)

As três perguntas que estavam em aberto foram respondidas pelo stakeholder.
Registradas com o motivo, para não voltarem ao debate sem informação nova.

### 1. Webhook, não `getUpdates`

O bot recebe o `/start` por webhook. **O custo foi aceito de olhos abertos**, e
está aqui para não virar surpresa de quem implementa:

- **Exige uma rota `@Public()` nova**, num guard que é *fail closed* por
  projeto. É a única rota pública desta feature, e a terceira do sistema
  inteiro — hoje só `GET /auth/config` e `POST /auth/google` são públicas.
- **Exige URL pública HTTPS.** Em produção o Coolify já entrega. **Em
  desenvolvimento local, exige túnel** — o Telegram não alcança
  `localhost:3333`. Quem for mexer nisso precisa de um, e isso é trabalho de
  configuração antes da primeira linha.

**A rota do webhook é a superfície exposta desta feature.** É por onde entra
dado que ninguém do time escreveu, vindo de quem souber a URL. Duas
consequências práticas:

- O payload merece validação de verdade, não confiança.
- **O `ValidationPipe` global usa `forbidNonWhitelisted`**, então campo sem
  decorador **rejeita com 400** em vez de ser ignorado. O update do Telegram é
  um objeto grande e variável, e um DTO que cubra menos do que o Telegram
  manda de verdade faz **a mensagem legítima tomar 400** — o bot fica mudo, e
  o log mostra uma rejeição de validação em vez de um erro de integração.
  Cobrir o formato real do update é parte do trabalho, não detalhe.

### 2. `chat_id` em coluna comum, não cifrado

**É identificador de destino, igual ao e-mail que já fica em claro na mesma
feature.** Cifrar o `chat_id` ao lado de um endereço de e-mail em texto puro
seria incoerente: protegeria o endereço menos sensível dos dois e deixaria o
outro exposto.

Além disso, cifrado ele não se consulta direto — e é por ele que se acha o
vínculo. Diferente dos tokens de API do PLT-01, que são **credencial** (dão
acesso a uma conta de terceiro) e por isso são cifrados. `chat_id` não abre
nada: sem o token do bot, não serve para enviar mensagem nenhuma.

### 3. Dois tokens desde já — um bot por ambiente

Não é otimização para depois; é o default. **Um bot só faria desenvolvimento e
produção disputarem o mesmo webhook** — o Telegram entrega cada update a uma
URL só, então quem registrasse por último roubaria as mensagens do outro. E
**mensagem de teste chegaria a gente real.**

Isso vale para as variáveis de ambiente e para os **dois compose**:

- `TELEGRAM_BOT_TOKEN` — vazio é estado válido, como `SMTP_HOST` já é. Sem ele
  o canal fica inerte e registra no log. **Não** usar `${VAR:?}` no
  `docker-compose.prod.yml`, ao contrário dos segredos que derrubam o boot.
- `TELEGRAM_BOT_USERNAME` — o `<bot>` do deep link `t.me/<bot>?start=<token>`.
  Muda junto com o token, por isso é variável e não constante no código.
- `TELEGRAM_WEBHOOK_URL` — deriva de `APP_URL` quando não informada.

Em desenvolvimento, o bot de teste e a URL do túnel; em produção, o bot real e
o domínio do Coolify. `.env.example` lista os três, como já lista `SMTP_HOST` e
`APP_URL`.

## Ainda em aberto

**O mesmo `chat_id` vinculado a duas contas do Horizons.** Continua com
inclinação, não decisão: recusar a segunda vinculação, porque um `chat_id`
recebendo vagas de dois perfis diferentes é confusão sem dono. Está listado
também em [Casos de borda](#casos-de-borda) — quem implementar decide e
registra aqui.


## O QA achou 3 bugs (24/08) — todos corrigidos

**1. GRAVE — uma vaga longa apagava TODAS as vagas da mensagem.** O laço que
monta o texto dava `break` no primeiro bloco que não coubesse no limite de
4.096 caracteres do Telegram, descartando os seguintes — inclusive os
pequenos. Com 8 vagas e a primeira grande, a notificação chegava com
*"We found 8 new jobs"* e **nenhum anúncio**.

Trocado por `continue`. Conferido com a primeira vaga de 3.850 caracteres:
**7 vagas na mensagem**, contra 0 antes.

Os dados reais hoje são curtos (título de até 72 chars), mas nada na ingestão
limita esses campos — e notificação vazia é pior que notificação sem uma vaga.

**2. MÉDIO — duplo clique em Connect deixava o primeiro link morto.**
`criarConvite` apaga os convites pendentes, então o segundo clique invalidava
o token da primeira aba, e o `/start` respondia *"This link is not valid"*. O
botão agora não se libera no sucesso: enquanto `aguardando` está de pé, ele
fica fora de ação.

**3. BAIXO — erro do backend em português numa tela em inglês.** As duas
mensagens de `telegram.service.ts` chegavam direto ao usuário.

## O que o QA confirmou que não quebrou

**O webhook, que é a superfície mais arriscada** — é rota pública e recebe
JSON de fora. Sem segredo ou com segredo errado → 404. `chat.id` de 1e30,
negativo, fracionário, string, `null`; `text` como array; `chat` ausente;
texto de 100 mil caracteres; `<script>`; `from.username` como objeto — todos
respondem 200 sem crash e **sem tocar no banco**.

Reuso de token, token expirado, e token de uma conta sobre o chat de outra:
todos recusados. Sequestro de chat bloqueado, com o `@@unique` no `chatId`
cobrindo a corrida.

Com `AUTH_DISABLED=false`: status, vincular e desvincular exigem login; o
webhook segue público — que é o desenho certo, já que quem chama é o Telegram.

**Nenhum vazamento do token do bot nem do segredo em log**, verificado com DNS
falho e timeout.

## O que falta

**Um token real de bot.** O ambiente tem
`TELEGRAM_BOT_TOKEN=123456:FAKE-TOKEN-PARA-TESTE-LOCAL`, e o envio chega até a
API do Telegram e falha com **401 Unauthorized** — o caminho inteiro funciona,
só falta a credencial. Criar o bot leva um minuto no @BotFather.

E o webhook real precisa de URL HTTPS pública; em desenvolvimento, um túnel.

## Duas perguntas em aberto

- Revincular de outro chat move o link em silêncio, sem avisar o chat antigo.
- Convite expirado fica no banco sem limpeza agendada.
