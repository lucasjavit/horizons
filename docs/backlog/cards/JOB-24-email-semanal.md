# JOB-24 · O e-mail semanal — "encontramos vagas para você"

**Estado:** feito (24/08/2026)
**Tamanho:** M

## Por quê

É o produto, na frase do stakeholder:

> "Vamos encontrar uma vaga para você e te mando um email."

**É também a única coisa que o ChatGPT não faz.** A pessoa pode colar a
descrição de uma vaga no ChatGPT e perguntar se aceita brasileiro — e ele
responde bem. O que ele não faz é varrer 839 empresas toda semana enquanto ela
dorme.

Sem o e-mail, o produto depende de a pessoa lembrar de voltar. Com ele, o
produto aparece sozinho.

## O que fazer

Depende do [JOB-03](JOB-03-busca-em-segundo-plano.md) (busca rodando sozinha) e
do [JOB-20](JOB-20-motor-de-ats.md).

Um e-mail por semana com as vagas novas do grupo da pessoa, respondendo as
perguntas que decidem o clique: quanto paga, aceita quem mora onde ela mora, e
o trecho que prova.

## Critérios de aceite

- [x] Chega e-mail sem a pessoa abrir o site — cron de hora em hora, envio por
      pessoa quando vencem 7 dias do **último envio dela**
- [x] Só vagas **novas** desde o último envio — `foundAt > ultimoEnvioEm`
- [x] Cada afirmação de elegibilidade tem trecho (regra do JOB-09)
- [x] Descadastrar funciona em um clique, sem login
- [x] Não envia e-mail vazio — semana sem vaga nova não gera mensagem

## Cuidado

**E-mail vazio ou repetido treina a pessoa a ignorar.** Melhor pular a semana
que mandar "nenhuma vaga nova". E melhor três vagas certas que trinta.


## Como ficou (24/08/2026)

**Sem SMTP, e de propósito.** O stakeholder não tem servidor de e-mail e não vai
configurar agora, então o provedor padrão (`EmailLogProvider`) **registra no log
em vez de enviar**. Trocar por SMTP é implementar `EmailProvider` e mudar uma
linha do `email.module.ts`; o resto da feature já está pronta e conferida.

A decisão que sustenta isso: **`ultimoEnvioEm` só avança quando o e-mail saiu de
fato**. Com o provedor de log ele fica nulo, então no dia em que o SMTP entrar a
pessoa recebe as vagas acumuladas — e não um e-mail começando do zero como se as
semanas anteriores tivessem sido entregues.

O cron roda **de hora em hora, e não uma vez por semana**: quem decide se venceu
é o `ultimoEnvioEm` de cada pessoa. Um cron semanal fixo mandaria todo mundo no
mesmo minuto, e quem se cadastrasse na terça esperaria até domingo.

### O que foi medido

Com 50 vagas reais gravadas pelo motor de ATS (grátis; o de IA está sem crédito):

| Verificação | Resultado |
| --- | --- |
| Corpo montado com dados reais | assunto `50 new jobs for you this week`, 8 cartões, 8 citações |
| Toda afirmação com trecho | 8 de 8 — sem trecho, a linha não sai (20 testes das funções puras) |
| Rodada com provedor de log | 0 enviados, 1 pulado, `ultimoEnvioEm` **continua nulo** |
| Rodada com provedor que entrega | 1 enviado; **2ª rodada seguida: 0 enviados** (fora da cadência) |
| Depois do envio | `vagasNovas` = 0 e `previa` = `null` — as mesmas 50 não voltam |
| Semana sem vaga nova | 0 enviados e **nenhuma linha de log de e-mail** |
| Descadastro sem login (com `AUTH_DISABLED=false`) | `POST /api/email/sair?t=…` → 201 |
| `GET` no mesmo link | 404 — pré-carregador de cliente de e-mail não descadastra ninguém |
| Token inválido / ausente | 404 / 400 |

### Ressalvas

- **Nenhum e-mail foi entregue de verdade**, porque não há SMTP. O que se
  verificou foi o corpo, a seleção e a cadência — não a entrega.
- O token **não volta em nenhuma resposta de API**: é credencial, e a tela não
  precisa dele (lá a pessoa tem sessão).
- A elegibilidade às vezes lê cidade como país ("Hires from: United States San
  Mateo CA"), o que vem do `elegibilidade.ts` (JOB-21/22) e não do e-mail. O
  trecho ao lado deixa o erro visível; corrigir é outro card.


## O QA achou 3 bugs (24/08) — todos corrigidos

**1. GRAVE — o cron nunca rodava, nem com o interruptor ligado.** Ele gateava
em `emailAtivo`, que é `emailLigado && temProvedorDeEmail` — e sem SMTP isso é
sempre `false`. O agendador voltava na primeira linha e era **código morto**,
com o critério "chega e-mail sem a pessoa abrir o site" marcado como feito.

Passou pela verificação manual porque `EmailService.rodar()` direto (e o botão
"Rodar agora") funcionavam — só o agendador dormia.

Agora gateia em `emailLigado`. Com o provedor de log, **rodar é o
comportamento certo**: é assim que se vê o que sairia. Quem decide se
*entrega* é o provedor, não o agendador.

**2. GRAVE — abrir a aba Jobs inscrevia a pessoa, sem opt-in.** `GET
/email/assinatura` chamava `garantir()`, que criava a linha com o default
`ativo = true` do schema. Leitura com efeito de escrita — e, ligado o SMTP,
todo mundo que já tinha aberto a aba receberia e-mail que nunca pediu.

É exatamente o risco que o próprio código nomeia: *"e-mail não solicitado, que
queima o domínio e não tem desfazer"*. Agora a leitura não cria nada, e
`garantir()` cria **desligada** — inscrever exige um clique.

**3. COSMÉTICO — o título contradizia o texto.** Quem estava inativo e marcado
como contratado lia "One job a month" logo acima de "You're not getting job
emails". E o botão dizia "Email me new jobs" mas religava em mensal.

### Conferido depois

```
GET /email/assinatura     0 linhas criadas (era 1, ativa)
cron com a flag ligada    "51 new jobs for you this week" no log (era silêncio)
cron sem inscritos        0 considerados — correto
```

### O que o QA confirmou que não quebrou

Isolamento por token (o de A não toca a linha de B); token maiúsculo, com
espaço, URL-encoded, vazio, repetido, 300 chars → 404/400 corretos; "contratado"
5× e 10 requisições em corrida (`contratadoEm` idempotente, preserva o primeiro
carimbo); cadência mensal espera 30 dias de verdade, testada em 7 casos; escape
de HTML (`<script>`, `<img onerror>`) vira entidade; teclado alcança os botões
com foco visível.

### Uma nota pré-existente que ele levantou

`url` de vaga não valida esquema: `javascript:alert(5)` sai como `href` vivo no
e-mail e em `LinhaVaga.tsx`. Cliente de e-mail bloqueia, navegador não. **Não é
deste card** — vem da vaga que entra pela busca. Vira card próprio.
