# PLT-03 · Migrar as contas criadas pelo guard antigo

**Estado:** feito (13/08/2026)
**Tamanho:** P

## Por quê

O `CurrentUserGuard` cria conta a partir do header `x-user-email`. Já existem
contas assim, e **elas carregam dado real**:

- o progresso das 75 aulas de System Design
- os tokens de API guardados no PLT-01

Ao trocar por Google, essas contas ficam sem `providerId`. Se o login criar uma
conta nova para o mesmo e-mail, **o progresso vira órfão** — a pessoa entra e
encontra as trilhas zeradas.

## O que fazer

Na primeira entrada com Google, **casar por e-mail**: se já existe conta com
aquele endereço, preencher `providerId`, `avatarUrl` e `lastLoginAt` em vez de
criar outra.

É a única parte do `claimOrphanData` do arguição que vale portar — e como
**migração**, não como código de auth permanente que roda em todo login para
sempre.

## Critério de aceite

- [x] Quem tinha progresso nas trilhas continua com ele depois do login
- [x] Os tokens de API do PLT-01 continuam acessíveis pela mesma conta
- [x] Não nasce conta duplicada para o mesmo e-mail
- [x] Conta sem `providerId` que nunca entrar pelo Google continua intacta

## Como verificar

Antes de migrar, anotar quantas aulas estão concluídas e quais tokens existem.
Depois do primeiro login, conferir que os dois números batem.

## Depende de

- PLT-02 (o login em si)

## Como ficou

Não virou script de migração: virou o `upsert({ where: { email } })` do
`loginComGoogle`. Conta que já existe é **adotada**; conta que não existe é
criada. Um caminho só, sem código de migração para apagar depois — e sem nada
parecido com o `claimOrphanData` do arguição rodando em todo login.

## Verificado (13/08/2026)

Antes: `eu@horizons.local` com `providerId` vazio e **3** registros de progresso.

Rodado o mesmo upsert do login, com um payload de Google fingido:

```
upsert -> {"id":"3539f57c-…","email":"eu@horizons.local","name":"Eu (Google)","providerId":"G-123","role":"USER"}
total de contas: 2
progresso da conta: 3
```

**Mesmo `id`** — não é conta nova. O `providerId` foi preenchido, o progresso
continua em 3, e o total de contas seguiu 2. A conta `outro@teste.com`, que
nunca entrou pelo Google, ficou intacta com `providerId` vazio.

Estado de teste desfeito depois da medição.
