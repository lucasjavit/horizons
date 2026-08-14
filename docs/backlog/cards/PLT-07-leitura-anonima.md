# PLT-07 · Leitura anônima, login na barra

**Estado:** feito (14/08/2026)
**Tamanho:** M
**Decisão do stakeholder (14/08/2026):** "não precisa da página de login como
inicial, a pessoa já vai poder ver a home e na barra vai ter o botão de login".
Escopo do anônimo: "tudo isso aí vai ser livre por enquanto, depois eu vejo".

## Por quê

A tela de login era a primeira coisa que alguém via. Isso inverte a ordem do
que convence: **ler uma aula é o que faz alguém querer uma conta**, e pedir a
conta antes de mostrar a aula é o que faz fechar a aba.

Agora a home abre nas trilhas e o botão do Google fica no canto da barra.
Entrar não interrompe a leitura — depois de escolher a conta, a pessoa continua
na mesma página, e o progresso passa a contar.

## Como ficou

**Backend.** Nasceu o `@SessaoOpcional()`, diferente do `@Public()`: o token,
**se vier**, ainda é verificado e o usuário resolvido. É o que permite a mesma
rota servir a leitura anônima e, para quem entrou, devolver o progresso junto —
sem duplicar endpoint.

Token inválido continua sendo 401 mesmo em rota opcional. Aceitar em silêncio
esconderia sessão expirada: a pessoa veria a trilha zerada achando que perdeu
o progresso.

| Rota | Antes | Agora |
| --- | --- | --- |
| `GET /tracks`, `/tracks/:slug`, aula | 401 sem token | **200**, progresso zerado |
| `PUT /progress/*` | 401 | **401** (inalterado) |
| `GET /auth/me`, `/settings/tokens` | 401 | **401** (inalterado) |

**Frontend.** O portão saiu do `App.tsx`: a aplicação renderiza com ou sem
sessão. A `LoginPage` foi **apagada** — o `BotaoGoogle` cobre o mesmo, e código
morto que ainda compila é o que diverge em silêncio.

Nasceu também o `SessaoContext`, para as páginas que precisam mudar o texto sem
receber `user` por props atravessando três níveis.

## Três detalhes que custariam caro

1. **`where: { userId: null }` no Prisma não devolve vazio** — casa com as
   linhas cujo `userId` é nulo, que seriam de outra pessoa. O progresso de
   anônimo é curto-circuitado antes da consulta.
2. **O interceptor de 401 chamava `perdeuSessao()` sempre.** Um anônimo
   clicando em "marcar concluída" dispararia isso, limpando um token que nem
   existe. Agora só quando havia sessão para perder.
3. **"Não foi possível salvar: Entre para continuar" lia como defeito.** O 401
   do anônimo é o único que não é falha — a ação pede algo da pessoa. Virou
   convite: *"Entre com o Google, ali em cima, para guardar seu progresso."*

## Critério de aceite

- [x] A home abre nas trilhas, sem tela de login
- [x] O botão do Google fica na barra, em ambos os temas
- [x] Anônimo abre a aula e lê o conteúdo
- [x] Anônimo **não** vê progresso nem anotação de quem entrou
- [x] Marcar aula e anotar continuam exigindo sessão
- [x] Token inválido responde 401 em vez de virar anônimo
- [x] Configurações continua restrita a admin
- [x] O `qa-rapido.py` cobre o novo desenho

## Verificado (14/08/2026)

| O que | Resultado |
| --- | --- |
| `/tracks` e a aula, sem token | **200** |
| `/auth/me`, `/settings/tokens`, sem token | **401** |
| `PUT /progress/:id` sem token | **401** |
| Progresso: logado × anônimo, mesma aula | **2/75** contra **0/75** |
| Anotação privada: logado × anônimo | texto salvo × `None` |
| `Bearer abc.def.ghi` em rota opcional | **401** |
| Navegador, claro e escuro | home nas trilhas, botão na barra, zero erro |
| Clicar em "marcar" sem sessão | convite, não erro |

## Um bug encontrado e corrigido no caminho

A primeira implementação filtrava o progresso da aula por um id impossível
contendo o byte `0x00`. O Postgres recusou — *"invalid byte sequence for
encoding UTF8: 0x00"* — e **toda aula aberta sem sessão devolvia 500**. A lista
de trilhas funcionava, o que fazia o defeito parecer ausente até abrir uma aula.

Só apareceu porque o teste foi no navegador. Trocado por `take: 0`, que
devolve lista vazia sem inventar id.

## O que ficou para depois

O stakeholder decidiu deixar tudo livre por ora. Quando quiser restringir —
por exemplo, exigir login para abrir a aula e deixar só o catálogo aberto —
basta trocar `@SessaoOpcional()` por `@Public()` na rota da listagem e remover
o decorator da rota da aula.
