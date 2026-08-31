# PLT-11 · A tela onde o dono gerencia os usuários

**Estado:** feito (31/08/2026)
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

- [x] O admin vê a lista de usuários, com papel, entrada e último acesso
- [x] Promover a `MANAGER` **sobrevive ao login seguinte** — é o defeito que
      este card existe para não introduzir, e tem de ser testado com um login
      de verdade, não só com um `UPDATE`
- [x] `ADMIN_EMAILS` continua ganhando: entrar na lista promove, sair rebaixa
- [x] Ninguém vira `ADMIN` pela tela
- [x] O dono não consegue rebaixar nem desativar a si mesmo
- [x] `active = false` derruba a sessão na requisição seguinte
- [x] O documento não aparece, nem em `hint`
- [x] Usuário comum recebe **403**; anônimo, **401**

**Manager:**
- [x] Vê a lista, com as mesmas colunas do admin
- [x] Consegue desativar e reativar um `COMMON_USER`
- [x] **Não** consegue desativar um `ADMIN` nem outro `MANAGER` — nem pela
      tela, nem chamando a rota direto
- [x] **Não** consegue mudar papel nenhum: a rota devolve 403, e os controles
      não aparecem
- [x] Desativar pede confirmação antes — o efeito é imediato
- [x] Fica registrado quem desativou, e quando

## Depende de

- [PLT-09](PLT-09-cadastro-em-dois-tempos.md) — a decisão dos três papéis e da
  regra de precedência. Este card é a primeira coisa que a torna real.


---

## O que foi feito (31/08/2026)

### A mudança no login, que é a razão do card

`auth.service.ts` ganhou **`papelPara(email, papelAtual)`**, e os três pontos
que calculavam `role` passam por ela:

```
esta em ADMIN_EMAILS?      -> ADMIN        (a variavel ganha sempre)
senao, e MANAGER no banco?  -> MANAGER      (respeita a promocao)
senao                       -> COMMON_USER
```

O `update` do `upsert` precisava do papel gravado, e `upsert` não dá acesso ao
registro anterior — então o login faz **um `findUnique` a mais** antes,
lendo só `{ role: true }`. Custa um SELECT num fluxo que acabou de falar com o
Google; não é o gargalo.

**O teste central foi visto falhar antes de passar.** Com a regra antiga
reinjetada no mesmo registro (`auth.papelPara = ehAdmin ? 'ADMIN' : 'COMMON_USER'`),
o login devolveu `COMMON_USER` e **gravou `COMMON_USER` no banco** — o defeito
que o card existe para não introduzir, reproduzido de propósito. Com a regra
nova, `MANAGER` antes e depois.

O login foi simulado chamando `AuthService.loginComGoogle` com o Nest de pé,
substituindo **só** `OAuth2Client.verifyIdToken` (o Google recusa esta origem).
Tudo o que está sob teste — `papelPara`, o `upsert`, o guard — é o código que
roda em produção. `lastLoginAt` mudou a cada chamada, provando que o `update`
executou de verdade.

As quatro regras de precedência, medidas com login real:

| Situação | Papel depois do login |
| --- | --- |
| MANAGER no banco, fora do `ADMIN_EMAILS` | `MANAGER` ✔ preservado |
| MANAGER que **entra** no `ADMIN_EMAILS` | `ADMIN` ✔ a variável ganha |
| ADMIN que **sai** do `ADMIN_EMAILS` | `COMMON_USER` ✔ e não `MANAGER` |
| `ADMIN` gravado à mão no banco | `COMMON_USER` ✔ ninguém se autopromove |

### O terceiro nível do guard

`@ManagerOrAdmin()` ao lado do `AdminOnly` em `auth/current-user.ts`, e o
`CHAVE_GESTAO` no `auth.guard.ts`. A checagem vem **depois** da de admin de
propósito: um handler marcado com os dois exige o mais restritivo.

`UsuariosController` é `@ManagerOrAdmin()` na classe, com `@AdminOnly()` no
método que muda papel.

### Migration `20260831210000_papeis_e_desativacao`

`USER` → `COMMON_USER` (`UPDATE` **antes** do `SET DEFAULT`: trocar o default
primeiro não mexe em linha existente, e as contas do banco ficariam com um
papel que não é papel de nada), mais `deactivatedAt` e `deactivatedById`
(`ON DELETE SET NULL` — apagar quem desligou não pode apagar a conta desligada).
Idempotente: a segunda subida do `migrate` responde *No pending migrations*.

### A matriz, com token real de cada papel

| Ação | ADMIN | MANAGER | COMMON_USER | anônimo |
| --- | :---: | :---: | :---: | :---: |
| `GET /usuarios` | 200 | 200 | **403** | **401** |
| `PATCH /:id/papel` | 200 | **403** | **403** | **401** |
| `PATCH /:id/ativo` (sobre comum) | 200 | 200 | **403** | **401** |

E as proteções, **chamando a rota direto**:

| Tentativa | Resposta |
| --- | --- |
| promover alguém a `ADMIN` | **400** — "O papel de admin vem da variavel ADMIN_EMAILS" |
| papel inventado (`SUPERADMIN`) | **400** no `ValidationPipe` |
| admin rebaixa a si mesmo | **403** |
| admin desativa a si mesmo | **403** |
| manager desativa a si mesmo | **403** |
| manager desativa um `ADMIN` | **403** |
| manager desativa outro `MANAGER` | **403** |
| manager desativa um `COMMON_USER` | **200** ✔ é o que ele pode |

**As regras vivem numa função só** (`podeMudarAtivo` / `podeMudarPapel`), usada
pelo `PATCH` para recusar **e** pela lista para preencher `canToggleActive` /
`canChangeRole`. A tela não recalcula nada: se a regra vivesse nos dois lados,
o botão apareceria para um gesto que dá 403 — ou, pior, o contrário.

### Desativar é imediato

Medido com o **mesmo token**, sem esperar os 30 dias:

```
1. antes de desativar : /auth/me -> 200
2. admin desativa     : 200 (active=false, by=Eu)
3. MESMO token, req seguinte: /auth/me -> 401 "Sessao invalida. Entre novamente."
   e em rota de sessao opcional: /tracks -> 401
4. reativa            : 200
5. mesmo token volta a valer: /auth/me -> 200
```

Reativar **limpa** `deactivatedAt`/`deactivatedById`: manter "disabled by Lucas"
ao lado de alguém que está dentro faria a tela mentir.

### O documento não aparece

`documentEnc`, `documentHint`, `documentCountry`, `phone` e as oito colunas de
endereço **não entram no `select:`** — não há `delete` a esquecer no caminho de
volta. As 13 chaves de cada item: `active, avatarUrl, canChangeRole,
canToggleActive, createdAt, deactivatedAt, deactivatedByName, email, id,
isSelf, lastLoginAt, name, role`. Conferido também no HTML servido.

### Dois defeitos achados por medir

**1. `sr-only` dentro de `<th>` dava rolagem horizontal à página inteira.**
O `sr-only` do Tailwind é `position:absolute`, e uma `<th>` não cria bloco
contido — o span se posicionava contra o bloco inicial, na borda direita da
**tabela**. Medido em 390px: `right=746`, e `document.scrollWidth` ia a **746**
apesar de a tabela já rolar dentro do seu container. Um elemento invisível de
1px empurrando o body. Virou `aria-label` na própria `<th>`; scrollWidth voltou
a **390**.

**2. O `qa-rapido.py` parou de testar papéis, em silêncio.** `token_de_papel("USER")`
não achava mais ninguém depois da migration, e o bloco inteiro se **pulava**
com "nenhum usuario USER no banco" — 8 checagens mortas sem uma linha de falha.
Corrigido para `COMMON_USER`, com o motivo escrito na docstring.

### Frontend

Sexta sub-página, `lazy` como as outras: chunk próprio de **7.817 bytes**, e o
bundle principal servido ficou em **366.322 bytes** (358 KB, teto de 440).

Busca por nome/e-mail com 350ms de espera (uma requisição, não sete), volta à
página 1 ao filtrar, e a `Paginacao` compartilhada de `components/vagas/`.

**O manager vê só a aba `Users`**, e o usuário comum não vê barra de abas
nenhuma: as outras cinco rotas são `@AdminOnly()`, e oferecê-las seria oferecer
caminhos que só dão 403. O item `Settings` do menu da conta passou a aparecer
para o manager, apontando para `/config/usuarios` — mandá-lo para `/config`
(Features, que é `@AdminOnly()`) abriria a área num erro.

A confirmação de `Disable` vive **na própria linha**, e não num modal: o efeito
é imediato, e a pergunta precisa estar ao lado da conta de que se fala. Reativar
não pede confirmação — devolver acesso é reversível pelo mesmo botão.

### O que foi verificado no navegador

**33 checagens** com token real de cada papel, mais **12** de teclado,
acessibilidade e temas:

- admin vê 7 linhas e 5 selects de papel (não na própria linha, **nem na de
  outro admin** — esse papel é da variável); nenhuma opção `ADMIN` no DOM
- manager: 0 selects, botão só nas linhas de `COMMON_USER`
- comum: erro, e nenhum e-mail de ninguém na tela
- todo controle alcançável por Tab, com nome acessível, ≥24px, `type="button"`;
  chega ao `Disable` só com Tab e `Enter` abre a confirmação
- claro e escuro: **18,61:1** e **17,45:1** de contraste no texto principal
- 390px: `scrollWidth` 390, sem rolagem horizontal da página
- zero erro de console em todas as sessões

`python3 scripts/qa-rapido.py`: **tudo certo**, com **8 checagens novas** de
papel (listagem nega comum, atende manager, manager não muda papel, a lista não
devolve dado pessoal, admin não se rebaixa nem se desativa, ninguém vira ADMIN).

## O que NÃO foi feito

- **O login foi simulado, não feito pelo Google de verdade.** O Google recusa
  esta origem, então `verifyIdToken` foi substituído. Todo o resto do caminho é
  o código real, mas **a validação do token do Google em si não foi exercida**
  nesta leva — ela não mudou.
- **`AUTH_DISABLED=true` não foi testado.** A máquina está com `false` e o
  `.env` não foi tocado. Com o login desligado o guard nem chega à checagem de
  papel (retorna antes), então a tela responderia a qualquer um — é o
  comportamento já documentado, não uma regressão deste card.
- **Não há log de auditoria**, só o autor e a data da **última** desativação. O
  histórico completo continua sendo card próprio, como o card já previa.
- **Rebaixar um `ADMIN` pela tela devolve 400** com a explicação, em vez de
  gravar um valor que o próximo login desfaz. Foi decisão desta implementação,
  não estava escrita no card.
