# QA-03 · Testes das camadas 2, 3 e 4

**Estado:** aberto (01/09/2026)
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

- [ ] `npm test` roda as três camadas e passa
- [ ] Cada teste **visto falhar** com o código quebrado — com a tabela de
      mutações, como o QA-01 fez
- [ ] **Nenhum teste escreve no banco de desenvolvimento**, e isso é
      impossível por construção
- [ ] Um teste que não pode rodar **falha**, não se pula
- [ ] Nenhum teste depende de dado que outro criou
- [ ] Os testes de papel **falham** se `AUTH_DISABLED=true`
- [ ] O `qa-rapido.py` continua passando
- [ ] Todo bug tem card na raia `Bugs`, com o teste junto

## Depende de

- [QA-01](QA-01-suite-de-testes.md) — a camada 1, o runner e o padrão de
  mutação
