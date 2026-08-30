# PLT-09 · Cadastro em dois tempos, e três papéis

**Estado:** decidido, não implementado (28/08/2026)
**Tamanho:** M

## A decisão

O cadastro acontece em **dois momentos**, e o segundo só existe para quem
contrata:

| Quando | O que se pede | Por quê |
| --- | --- | --- |
| **Primeiro login** | nada além do Google | e-mail, nome e foto já vêm verificados |
| **Ao contratar** | nacionalidade, documento, telefone | pagamento e identificação |

**Nada muda na porta de entrada.** O produto já deixa ler as trilhas sem login;
pedir documento antes de mostrar valor inverteria isso.

## Por que o documento não entra no cadastro inicial

O stakeholder deu duas razões para querê-lo: **emitir pagamento** e **provar em
juízo** se alguém fizer algo fora da lei. As duas acontecem depois do cadastro —
então guardá-lo de todos, inclusive de quem nunca vai pagar, é assumir o risco
sem o benefício.

E contradiz uma decisão que o projeto já tomou. O [JOB-02](JOB-02-perfil-de-busca.md)
descarta o arquivo do currículo justamente por isso:

> Some o CPF, o endereço e o telefone. **Token se revoga; CPF não.**

**Cifrado, o dado ainda existe** — aparece em backup, em log descuidado, e numa
requisição judicial ou pedido de exclusão. Menos dado guardado é menos
superfície, independentemente da cifra.

## Como o documento é guardado

`ENCRYPTION_KEY` com **salt próprio**, separado do dos tokens de API.

O `crypto.ts` deriva a chave com `scryptSync(bruta, 'horizons.api-tokens', 32)`
— o salt é o segundo argumento. Um salt diferente para documentos produz uma
chave diferente da mesma `ENCRYPTION_KEY`, então quem quebrar os tokens de IA
não ganha nada contra os documentos.

**AES-256-GCM já é o algoritmo certo:** além de cifrar, autentica — um valor
adulterado no banco falha ao decifrar em vez de devolver lixo em silêncio.

⚠️ **Perder a `ENCRYPTION_KEY` perde os documentos**, e isso é pior que perder
as chaves de IA: chave se recadastra em minutos, documento exige pedir de volta
a cada usuário. A tela `Deploy Prod` ([PLT-08](PLT-08-prontidao-para-publicar.md))
já registra o custo de rotação; documento entra nessa lista.

## O IP foi descartado (28/08)

Chegou a ser considerado — pegar o país pelo IP a cada acesso, para saber de
onde vem o público e ter registro para uma disputa.

**Descartado pelo stakeholder**, e a razão é boa: o cadastro completo já entrega
a informação que interessa, com precisão que o IP não tem. Um desenvolvedor em
viagem aparece no país errado, e quem usa VPN aparece onde o servidor está.

O que se evita junto: IP é dado pessoal pela LGPD, e guardá-lo a cada acesso
traria decisões de retenção e um passivo sem uso claro.

## Os três papéis

```
ADMIN  ·  MANAGER  ·  COMMON_USER
```

Quem se cadastra nasce `COMMON_USER` — já é o comportamento de hoje, onde
`role` nasce `'USER'`. Só o nome muda.

**`MANAGER` é "algumas permissões abaixo do admin", e o que ele pode fica para
depois** — decisão do stakeholder em 28/08. O papel entra na estrutura agora
para não exigir migration quando as permissões forem definidas.

### O que cada papel faz (28/08)

**`ADMIN` é o dono.** Além de tudo o que já pode hoje, é quem **muda o papel
dos outros** — é o único que promove alguém a Manager.

**`MANAGER` toma conta da aplicação**: atende dúvida de usuário, e acompanha o
que está acontecendo. Precisa **ver** coisas que hoje só o admin vê, sem poder
**mudar** o que quebra: chaves de IA, interruptores de recurso, e o papel de
ninguém.

O corte, em uma frase: **Manager opera, Admin configura.**

**`COMMON_USER`** usa o produto.

### A armadilha, e por que a promoção muda o login

**Hoje o papel não é escolhido — é calculado a cada login.**
`auth.service.ts:165` e `:176` fazem `role: this.ehAdmin(email) ? 'ADMIN' : 'USER'`
no `create` **e** no `update`, com o comentário explicando que a variável é a
fonte da verdade a cada login. Isso é deliberado, e está no CLAUDE.md: promover
alguém direto no banco não sobrevive ao próximo login.

**Com o admin promovendo pela tela, essa linha passa a apagar a promoção.** O
Manager entraria, seria rebaixado a `COMMON_USER`, e ninguém veria erro nenhum.

Duas fontes foram consideradas:

1. **`MANAGER_EMAILS` no ambiente** — segue o padrão do `ADMIN_EMAILS`, mas
   cada promoção exige mexer em variável e redeployar. **Descartada**: o
   stakeholder quer que o dono promova pela tela.
2. **O admin promove, e o banco guarda** — escolhida.

**O que isso exige mudar:** o `ADMIN_EMAILS` continua decidindo quem é `ADMIN`,
e é a última palavra. Mas `MANAGER` passa a vir do banco, então o `update` do
login não pode mais sobrescrever o papel cegamente. A regra fica:

```
está em ADMIN_EMAILS?     → ADMIN   (a variável ganha sempre)
senão, é MANAGER no banco? → MANAGER (respeita a promoção)
senão                      → COMMON_USER
```

Assim o `ADMIN_EMAILS` mantém a garantia que existe hoje — sair da lista tira o
papel de admin, e ninguém vira admin promovendo-se no banco —, e a promoção a
Manager sobrevive ao login.

⚠️ **Um admin removido do `ADMIN_EMAILS` cai direto para `COMMON_USER`**, e não
para `MANAGER`. É o comportamento certo: quem tirou o admin decide se quer dar
outro papel.

### Quem é o admin

`vyeiralucas@gmail.com` — o dono (28/08). Já está no `ADMIN_EMAILS` desta
máquina.

⚠️ **O `.env` não vai para o git.** Em produção o valor precisa ser cadastrado
no painel do Coolify; sem ele, `ADMIN_EMAILS` fica vazio e **ninguém é admin** —
o que significa que ninguém alcança Configurações nem promove nenhum Manager. A
tela `Deploy Prod` ([PLT-08](PLT-08-prontidao-para-publicar.md)) já verifica
isso e mostra quantos endereços a lista tem.

O `eu@horizons.local` que aparece no banco local é a conta do `AUTH_DISABLED`;
ela deixa de existir quando o login é exigido.

### Onde isso se implementa

A checagem de papel está **num lugar só** — `auth.guard.ts:76`,
`if (soAdmin && user.role !== 'ADMIN')`. Acrescentar o nível intermediário é
mexer nessa linha e no `current-user.ts` (que exporta `AdminOnly`), não caçar
`role === 'ADMIN'` espalhado pelo código.

`role` é `String` e não enum — o `tsconfig.app.json` proíbe enum de TS —, então
o valor novo não pede migration de tipo.

## Critérios de aceite

**Cadastro:**
- [ ] Entrar com Google continua sendo o único passo do primeiro acesso
- [ ] Usuário novo nasce `COMMON_USER`
- [ ] Documento e telefone só são pedidos no fluxo de contratação
- [ ] O documento é cifrado com salt próprio, e o valor nunca volta para a tela
- [ ] A tela diz por que cada dado é pedido, no momento em que pede

**Papéis:**
- [ ] Só o `ADMIN` consegue mudar o papel de alguém
- [ ] Promover a `MANAGER` **sobrevive ao login seguinte** — é o defeito que
      este card existe para não introduzir
- [ ] `ADMIN_EMAILS` continua ganhando de tudo: entrar na lista promove, sair
      rebaixa, e ninguém vira admin pelo banco
- [ ] Um admin removido da lista vira `COMMON_USER`, não `MANAGER`
- [ ] Rota `@AdminOnly()` continua exigindo `ADMIN`, e não `MANAGER`
- [ ] O Manager vê o que precisa para atender, e não muda chave nem interruptor

## O que fica para quando houver requisito

- **Quais telas o Manager vê.** O corte está decidido (opera, não configura),
  mas quais rotas ganham `@ManagerOrAdmin()` depende de quais existem quando
  isto for implementado.
- **Nacionalidade como filtro de busca.** Hoje a elegibilidade vem dos filtros
  que a pessoa escolhe. Se o país do cadastro passar a alimentar a busca, vale
  distinguir **onde mora** de **cidadania** — um brasileiro com passaporte
  português tem a UE aberta, e nenhum campo único expressa isso.
- **Log de auditoria para disputa.** O que sustenta uma disputa em juízo é o
  registro do ato — aceite dos termos com carimbo de tempo, o que a pessoa fez
  e quando. O documento no banco não prova ato nenhum. Vira card próprio se e
  quando houver pagamento.

## De onde veio

Conversa com o stakeholder em 28/08/2026, ao desenhar o cadastro. Ele propôs
pedir nacionalidade, documento e telefone no cadastro; a conversa moveu os três
para o momento da contratação, e descartou o IP.
