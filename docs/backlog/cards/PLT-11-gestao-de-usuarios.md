# PLT-11 · A tela onde o dono gerencia os usuários

**Estado:** aberto (31/08/2026)
**Tamanho:** M

## Por quê

O [PLT-09](PLT-09-cadastro-em-dois-tempos.md) decidiu três papéis e disse que
**o dono promove alguém a Manager pela tela**. A tela não existe — então hoje o
`MANAGER` é um valor que nada produz, e a decisão está no papel.

Pedido pelo stakeholder em 31/08, logo depois de separar o que é do admin do
que é dos outros usuários.

## O que a tela faz

**Lista quem se cadastrou, e deixa o dono mudar o papel.**

O mínimo que a lista precisa mostrar, e cada coluna responde uma pergunta que
alguém de fato faz:

| Coluna | A pergunta |
| --- | --- |
| foto + nome + e-mail | quem é |
| papel | o que pode fazer |
| entrou em | é novo? |
| último acesso | ainda usa? (`lastLoginAt` já existe no `User`) |
| ativo | a conta foi desligada? (`active` já existe) |

## A armadilha que este card existe para não repetir

**Hoje o papel é recalculado do `ADMIN_EMAILS` a cada login.**
`auth.service.ts` faz `role: this.ehAdmin(email) ? 'ADMIN' : 'USER'` no
`create` **e** no `update` — e o comentário lá explica que a variável é a fonte
da verdade a cada entrada.

**Promover pela tela sem mexer nisso não funciona:** o Manager entraria e seria
rebaixado a `COMMON_USER` no login seguinte, sem erro nenhum no log.

A regra que o PLT-09 fixou, e que este card implementa:

```
está em ADMIN_EMAILS?      → ADMIN         (a variável ganha sempre)
senão, é MANAGER no banco?  → MANAGER       (respeita a promoção)
senão                       → COMMON_USER
```

Assim o `ADMIN_EMAILS` mantém as duas garantias que já tem — sair da lista tira
o papel de admin, e **ninguém vira admin promovendo-se no banco** — e a
promoção a Manager sobrevive ao login.

⚠️ **Um admin removido do `ADMIN_EMAILS` cai para `COMMON_USER`**, não para
`MANAGER`. Quem tirou o admin decide se quer dar outro papel.

## O que o dono pode, e o que ele não pode

**Pode:** promover a `MANAGER`, rebaixar a `COMMON_USER`, desativar e reativar
uma conta.

**Não pode, e a tela tem de impedir:**

- **Promover alguém a `ADMIN`.** Isso é do `ADMIN_EMAILS`, e um botão aqui
  criaria uma segunda fonte de verdade que o próximo login desfaz — o defeito
  que a seção acima descreve, do outro lado.
- **Rebaixar ou desativar a si mesmo.** Um dono que se rebaixa perde o acesso à
  tela que o rebaixaria de volta. É irreversível sem mexer no banco, e a tela
  não deve oferecer.
- **Desativar outro admin.** Mesmo motivo, um passo adiante.

**O `active = false` derruba a sessão na requisição seguinte** — o guard relê o
usuário do banco a cada request (PLT-02), então desativar tem efeito imediato,
sem esperar o token de 30 dias expirar. Isso é o que faz o botão valer.

## O que cada papel pode nesta tela (31/08)

**O Manager vê a lista e pode desativar contas.** Decisão do stakeholder: quem
atende usuário precisa achar a pessoa, e precisa poder desligar uma conta
abusiva sem esperar o dono.

**O Manager NÃO muda papel de ninguém** — promover continua sendo só do dono, o
que o PLT-09 já fixou. Um manager que promovesse outros criaria managers sem o
dono saber.

| | ver a lista | desativar | mudar papel |
| --- | :---: | :---: | :---: |
| **ADMIN** | ✓ | ✓ | ✓ |
| **MANAGER** | ✓ | ✓ | — |
| **COMMON_USER** | — | — | — |

### O que essa escolha exige proteger

**Um manager não pode desativar um admin nem outro manager.** Só
`COMMON_USER` — senão o cargo vira uma forma de derrubar quem o supervisiona, e
dois managers podem se desativar mutuamente.

**E desativar é imediato**: o guard relê o usuário do banco a cada request, então
a sessão cai na requisição seguinte. É o que dá peso ao botão, e é por isso que
ele precisa de confirmação antes — um clique errado tira alguém do produto na
hora.

**Vale registrar quem desativou quem.** Sem isso, uma conta desligada é um
mistério: o dono vê `active = false` e não sabe se foi ele, um manager, ou um
engano. Um campo com o autor e a data resolve, e é o mínimo — o log de auditoria
completo continua sendo card próprio.

## Perguntas de produto que faltam decidir

**1. Quantos usuários antes de precisar de busca?** Com dez, uma lista basta.
Com mil, sem busca por e-mail ninguém acha ninguém. A `Paginacao` já existe e é
compartilhada — vale usar desde já, mesmo com poucos.

**2. A tela mostra os dados do [PLT-10](PLT-10-perfil-editavel.md)?** Telefone,
país e endereço estão lá. **O documento não pode aparecer nem em `hint`** — é
dado da pessoa, e o dono não precisa dele para gerenciar papel. Se um dia
precisar (disputa, cobrança), é outro card, com o motivo escrito.

## Onde isso se implementa

**Backend:** módulo novo em `backend/src/usuarios/`, seguindo `src/perfil/` —
`x.module.ts`, `x.controller.ts`, `x.service.ts`, `x.dto.ts`, sem barrel.

⚠️ **A rota de listagem NÃO é `@AdminOnly()`** — o Manager vê. Hoje o guard só
conhece dois níveis (`auth.guard.ts:76`, `if (soAdmin && user.role !== 'ADMIN')`),
então este card precisa de um terceiro decorador (`@ManagerOrAdmin()` ou nome
equivalente) ao lado do `AdminOnly` em `auth/current-user.ts`. **Mudar papel
continua `@AdminOnly()`.**

`select:` explícito (nada de `documentEnc` no select — o jeito
mais seguro de não vazar um campo é nunca buscá-lo).

**A mudança no login** é em `auth.service.ts`, nos dois pontos onde `role` é
calculado. É a parte mais delicada: mexer ali sem cuidado quebra o login de
todo mundo.

**Frontend:** sexta sub-página de Configurações. Entra na lista de
`components/settings/AbasDeConfig.tsx` **e** como rota antes do `path="*"`.

## Critérios de aceite

- [ ] O admin vê a lista de usuários, com papel, entrada e último acesso
- [ ] Promover a `MANAGER` **sobrevive ao login seguinte** — é o defeito que
      este card existe para não introduzir, e tem de ser testado com um login
      de verdade, não só com um `UPDATE`
- [ ] `ADMIN_EMAILS` continua ganhando: entrar na lista promove, sair rebaixa
- [ ] Ninguém vira `ADMIN` pela tela
- [ ] O dono não consegue rebaixar nem desativar a si mesmo
- [ ] `active = false` derruba a sessão na requisição seguinte
- [ ] O documento não aparece, nem em `hint`
- [ ] Usuário comum recebe **403**; anônimo, **401**

**Manager:**
- [ ] Vê a lista, com as mesmas colunas do admin
- [ ] Consegue desativar e reativar um `COMMON_USER`
- [ ] **Não** consegue desativar um `ADMIN` nem outro `MANAGER` — nem pela
      tela, nem chamando a rota direto
- [ ] **Não** consegue mudar papel nenhum: a rota devolve 403, e os controles
      não aparecem
- [ ] Desativar pede confirmação antes — o efeito é imediato
- [ ] Fica registrado quem desativou, e quando

## Depende de

- [PLT-09](PLT-09-cadastro-em-dois-tempos.md) — a decisão dos três papéis e da
  regra de precedência. Este card é a primeira coisa que a torna real.
