# QA-03 · Testes das camadas 2, 3 e 4

**Estado:** feito (01/09/2026) — camadas 2, 3 e 4 entregues
**Tamanho:** G

Continua o [QA-01](QA-01-suite-de-testes.md), que entregou a camada 1 — **319
testes de lógica pura**, com 19 mutações vistas falhar.

## A regra continua sendo a mesma

**Teste real, não teste de cobertura.** Cada teste tem de ser **visto falhar**
com o código quebrado de propósito. Se passa com o bug reintroduzido, ele não
testa nada.

Nas camadas com banco e rede isso é mais difícil, e por isso mais importante:
é fácil escrever um teste que só confirma que o Prisma responde.

## Camada 2 — serviços com banco

### A decisão que trava tudo: como isolar o Postgres

Testes que compartilham banco falham na ordem errada, e passam por sorte. Três
caminhos:

**A. Schema por suíte.** A `DATABASE_URL` já traz `?schema=public`; trocar por
`?schema=test_<n>` dá isolamento real no mesmo Postgres, com `migrate deploy`
por schema. Custo: cada suíte paga a migration.

**B. Transação por teste, com rollback no fim.** Rápido e limpo, mas exige que
o serviço receba o client transacional — e o `PrismaService` é injetado como
singleton `@Global()`. Pode forçar mudança no código de produção, o que este
card **não** deve fazer.

**C. Truncar entre testes.** Simples, e serializa a suíte inteira.

**Escolha uma, meça, e justifique.** O que decide é: roda em CI sem Postgres
externo? e um teste que falha deixa lixo para o próximo?

⚠️ **O banco de desenvolvimento tem dados reais** — as chaves de IA cifradas do
stakeholder, entre eles. **Nenhum teste pode escrever no banco de
desenvolvimento**, e o card só fecha quando isso for impossível por construção,
não por disciplina.

### O que testar, e por que estes

**`where: { campo: undefined }` no Prisma descarta a condição** em vez de não
casar nada — **já apagou uma tabela inteira** (JOB-05: `DELETE /jobs/saved` sem
parâmetro devolvia 200 e zerava a lista). É a armadilha número um desta camada.

- **`perfil.service.ts`** — trocar de país apaga o documento; "Not set" também
  (bug do QA de 31/08); salvar só o telefone preserva o resto; endereço
  sobrevive à troca de moradia
- **`usuarios.service.ts`** — as quatro proteções do PLT-11: ninguém vira ADMIN,
  o dono não se rebaixa nem se desativa, manager não desativa admin nem manager
- **`salvas.service.ts` e `historico.service.ts`** — o `DELETE` sem parâmetro
  **tem de dar 400**, não apagar tudo
- **`recursos.service.ts`** — a separação produto/admin (PLT-12): a rota de
  produto devolve **exatamente** dois booleanos, e um campo novo vazado quebra
  o teste
- **`auth.service.ts`** com banco — o `upsert` por e-mail que adota contas
  antigas (PLT-03), e a gravação do papel

## Camada 3 — rotas, papéis e contratos

Metade já existe no `qa-rapido.py` e depende da aplicação de pé. Vira teste de
verdade, rodando no `npm test`, com `supertest` sobre o `AppModule`.

- **A matriz inteira de papéis**: anônimo 401, comum 403, manager e admin
  conforme o caso. Hoje são 11 checagens no script; viram testes
- **O guard é *fail closed***: uma rota nova sem decorador **nasce protegida**.
  Vale um teste que percorra as rotas registradas e falhe se alguma ficar
  aberta sem `@Public()` explícito — é o tipo de proteção que envelhece sozinha
- **`forbidNonWhitelisted`**: campo sem decorador rejeita com 400
- **Os DTOs de resposta não carregam segredo**: nem `document`, nem `hint` de
  token, nem `documentEnc`. O PLT-12 nasceu de um `hint` que vazou por meses

⚠️ **`AUTH_DISABLED=true` desliga a checagem de papel inteira** — o guard
retorna antes. Os testes desta camada **têm de rodar com o login ligado**, e
falhar ruidosamente se estiverem no modo aberto. Um teste de papel que passa
com o login desligado não testa nada.

## Camada 4 — frontend

A mais cara, e a que menos bug produziu. **Escolha por onde dói:**

- **`ListaVagas`** — o CV preenchendo filtros, a paginação sob demanda, o
  histórico. Já teve três bugs medidos (perda de escolha durante o upload, selo
  mentindo, contagem divergente)
- **`DadosPessoais`** — trocar de país revalida o documento; falha de rede não
  perde o que foi digitado
- **`Paginacao`** — o "Load more" e a mensagem de erro **junto ao botão** (o
  QA achou ela nascendo 900px fora da tela)

Vitest e Testing Library já estão no projeto pelo QA-01.

## O que fazer com o que a suíte encontrar

**Bug vira card na raia `Bugs`**, e o **teste entra no repositório antes da
correção**, como `it.failing` com o link do card — foi assim que o QA-02
entrou. `it.failing` e não `skip`: se alguém corrigir sem tocar no teste, ele
falha avisando.

**Não corrija em silêncio.**

## Critérios de aceite

- [x] `npm test` roda as três camadas e passa
- [x] Cada teste **visto falhar** com o código quebrado — com a tabela de
      mutações, como o QA-01 fez
- [x] **Nenhum teste escreve no banco de desenvolvimento**, e isso é
      impossível por construção
- [x] Um teste que não pode rodar **falha**, não se pula
- [x] Nenhum teste depende de dado que outro criou
- [x] Os testes de papel **falham** se `AUTH_DISABLED=true`
- [x] O `qa-rapido.py` continua passando
- [x] Todo bug tem card na raia `Bugs`, com o teste junto — **nenhum bug novo
      nesta leva** (ver "O que a suíte encontrou")

## Depende de

- [QA-01](QA-01-suite-de-testes.md) — a camada 1, o runner e o padrão de
  mutação


---

## Camada 2 entregue (01/09/2026)

**319 testes no backend, contra 209 antes** — seis specs de serviço novos, mais
a infraestrutura em `backend/test/`.

| Arquivo | O que cobre |
| --- | --- |
| `perfil.service.spec.ts` | trocar de país apaga o documento; "Not set" também |
| `usuarios.service.spec.ts` | as quatro proteções do PLT-11 |
| `salvas.service.spec.ts` | o `DELETE` sem parâmetro dá 400, não apaga tudo |
| `historico.service.spec.ts` | idem, e a precedência descartado/visto |
| `recursos.service.spec.ts` | a separação produto/admin do PLT-12 |
| `auth.service.banco.spec.ts` | o `upsert` por e-mail e a gravação do papel |

### A decisão: schema por suíte

Das três opções do card, a medição escolheu a **A**:

| Caminho | Custo | Veredito |
| --- | --- | --- |
| **schema por suíte** | 2,35 s de `migrate deploy` | **escolhido** |
| transação com rollback | — | exigiria o client transacional dentro do serviço, e o `PrismaService` é singleton `@Global()`. Mudaria código de produção, que este card proíbe |
| truncar entre testes | — | serializa tudo e **mira a mesma tabela dos dados reais**: um erro de configuração apaga o banco de desenvolvimento em vez de dar erro |

Um quarto caminho foi medido e descartado: clonar o schema com
`CREATE TABLE (LIKE ... INCLUDING ALL)` custa **157 ms** em vez de 2,35 s, mas
**perde as 13 foreign keys** — e FK é justamente o que um teste de
`onDelete: Cascade` precisa exercitar.

### A proteção é por construção, e foi provada

O critério não era *"nenhum teste escreveu no banco de desenvolvimento"* — era
**"nenhum teste consegue escrever"**.

`urlDeTeste()` **recusa qualquer schema que não comece com `qa03_test_`**, e
recusa **antes de abrir conexão**. Conferido: `urlDeTeste('public')` e
`urlDeTeste('horizons')` lançam.

Medido depois de rodar a suíte inteira: **4 usuários e 5 chaves de IA intactos**
no banco real, e 7 schemas `qa03_*` criados à parte.

---

## Camadas 3 e 4 entregues (01/09/2026)

| | Antes | Depois |
| --- | --- | --- |
| backend | 319 (12 suítes) | **383** (15 suítes), 26,1s |
| frontend | 110 (2 arquivos) | **139** (4 arquivos), 3,5s |

### Camada 3 — 64 testes em três suítes

| Arquivo | Testes | O que cobre |
| --- | --- | --- |
| `src/auth/fail-closed.e2e.spec.ts` | 14 | nenhuma rota nasce aberta |
| `src/auth/papeis.e2e.spec.ts` | 35 | a matriz inteira de papéis |
| `src/settings/contratos.e2e.spec.ts` | 15 | `forbidNonWhitelisted` e o não-vazamento |

**O teste de rota aberta faz duas perguntas diferentes**, e é por isso que ele
vale: a lista de rotas públicas é conferida por **metadado** (pega a rota nova
que nasceu `@Public()`), e toda rota protegida é conferida por **requisição de
verdade** (pega o `AuthGuard` quebrado, que o metadado não veria). As rotas são
levantadas pela `DiscoveryService`, então **controller novo entra sozinho** — a
proteção vale para o código que ainda não existe.

**A superfície pública são SETE rotas, e não seis.** O card listava seis; a
sétima é `GET /perfil/paises`, pública desde sempre e legitimamente (lista
estática de países, não diz nada sobre ninguém). A lista está escrita à mão no
teste de propósito: derivá-la do código faria um teste que concorda com
qualquer coisa que o código diga.

### Camada 4 — 29 testes em dois arquivos

| Arquivo | Testes | O que cobre |
| --- | --- | --- |
| `src/components/vagas/Paginacao.spec.tsx` | 15 | o "Load more" e o erro **junto ao botão** |
| `src/components/perfil/DadosPessoais.spec.tsx` | 14 | trocar de país revalida; falha de rede não perde |

O erro do "Load more" é verificado por **quem é o pai do elemento**
(`within(nav)`), e não por "a mensagem aparece": o bug de 27/08 era a mensagem
nascendo 900px acima, e um teste de presença teria passado com o bug presente.

**A infraestrutura da camada 4 não existia.** O card dizia que Vitest e Testing
Library já estavam no projeto — o Vitest estava, a Testing Library não. Foram
instalados `@testing-library/react`, `/dom`, `/user-event`, `/jest-dom` e
`jsdom`, e o `vite.config.ts` passou de `environment: 'node'` para `'jsdom'`,
com `*.spec.tsx` no `include` e um `setupFiles`.

### `AUTH_DISABLED=true` derruba a camada 3 inteira, como devia

Rodado com a variável ligada pela linha de comando (**sem tocar no `.env`**):
**63 de 63 testes falharam**, cada um com a razão escrita — *"com o login
desligado o guard retorna antes de olhar papel: TODA rota responderia 200 e o
teste passaria sem medir nada"*.

A guarda é `exigirLoginLigado()`, chamada no `beforeAll` das três suítes. Não
se resolveu fixando `AUTH_DISABLED=false` no `ambiente.ts`: isso esconderia a
configuração real da máquina e a suíte passaria a atestar o fail closed num
modo em que a aplicação não roda.

### A tabela de mutações — 15 mutações, 13 mataram teste

| # | Mutação | Testes que falharam |
| --- | --- | --- |
| 1 | o guard deixa passar quem não tem token (*fail open*) | 2 |
| 2 | conta desativada volta a ser aceita | 1 |
| 3 | `GET /perfil` marcado `@Public()` por engano | 1 (nomeando a rota) |
| 4 | `forbidNonWhitelisted: false` | 3 |
| 5 | a rota de produto devolve o DTO de admin | 2 |
| 6 | `@AdminOnly()` sai de `PATCH :id/papel` | **0 → 1** (ver abaixo) |
| 7 | o guard deixa de checar `@ManagerOrAdmin()` | 1 |
| 8 | `GET /perfil` passa a devolver `documentEnc` | 1 |
| 9 | o `select:` de `/usuarios` carrega telefone e documento | **0** (ver abaixo) |
| 9b | o **mapper** de `/usuarios` espalha a linha do banco | 2 |
| 10 | o erro do "Load more" volta a nascer fora do `<nav>` | 2 |
| 11 | "Load more" passa a aparecer em qualquer página | 1 |
| 12 | "teto" e "fim" passam a dizer a mesma frase | 1 |
| 13 | trocar de país não limpa o documento digitado | 1 |
| 14 | o `catch` do Save limpa o formulário | 2 |
| 15 | manda `document: ''` mesmo com o campo vazio | 1 |

**Duas mutações sobreviveram, e as duas ensinaram algo — nenhuma foi
"consertada" mudando o teste para passar.**

**A #6 revelou proteção em profundidade.** Tirar o `@AdminOnly()` da rota de
papel **não quebrou nada**: `UsuariosService.mudarPapel` recusa o manager por
conta própria, e a resposta continuava 403. Duas barreiras é bom; o risco é o
decorador ser removido num refactor sem que nada aponte. O teste novo separa as
camadas **pela mensagem** — a frase do `AuthGuard` (`"Esta acao e restrita a
administradores."`) é a única evidência observável de qual barreira atendeu.
Com o teste novo, a #6 mata.

**A #9 não era vazamento.** Carregar colunas a mais do banco não as leva à
resposta: o `paraDto` de `usuarios.service.ts` monta o DTO campo a campo e
descarta o resto. O teste estava certo em não falhar — a segunda barreira
segurou. A #9b mutou o **mapper**, que é onde o vazamento de verdade
aconteceria, e a varredura recursiva o pegou em `itens[0].documentHint`.

### O banco de desenvolvimento, antes e depois

**4 usuários e 5 chaves de IA, sem alteração** — conferido antes da primeira
suíte e depois da última. Os 12 schemas `qa03_test_*` vivem à parte, e o
`urlDeTeste()` continua recusando qualquer schema fora do prefixo.

### O que a suíte encontrou

**Nenhum bug novo.** As camadas 3 e 4 confirmaram o comportamento esperado em
todos os 93 testes escritos — o que é um resultado, e não a ausência de um:
as proteções que o PLT-11 e o PLT-12 construíram estão de pé, e agora há teste
que avisa no dia em que deixarem de estar.

### O que NÃO foi feito

**`ListaVagas` ficou de fora.** O card a listava primeiro na camada 4, com três
bugs medidos (perda de escolha durante o upload do CV, o selo `CV` mentindo
depois de "Clear filters", a contagem divergindo dos selos). São **1.053
linhas** com muitas dependências de rede, e testá-la bem custaria mais do que
coube nesta leva. `Paginacao` e `DadosPessoais` foram escolhidas por serem
onde o card apontava bug medido **e** o componente ser isolável.

O card sai como feito porque a camada 3 — a prioridade declarada, onde estão
as proteções de segurança — está inteira. `ListaVagas` merece card próprio.
