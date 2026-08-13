# PLT-03 · Migrar as contas criadas pelo guard antigo

**Estado:** pronto para fazer
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

- [ ] Quem tinha progresso nas trilhas continua com ele depois do login
- [ ] Os tokens de API do PLT-01 continuam acessíveis pela mesma conta
- [ ] Não nasce conta duplicada para o mesmo e-mail
- [ ] Conta sem `providerId` que nunca entrar pelo Google continua intacta

## Como verificar

Antes de migrar, anotar quantas aulas estão concluídas e quais tokens existem.
Depois do primeiro login, conferir que os dois números batem.

## Depende de

- PLT-02 (o login em si)
