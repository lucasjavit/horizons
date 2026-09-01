# QA-01 · Uma suíte de testes de verdade, para o que já existe

**Estado:** camada 1 feita (01/09/2026) — camadas 2, 3 e 4 seguem abertas
**Tamanho:** G — vira vários cards, um por camada

## O estado hoje

**33.558 linhas, 164 arquivos, zero testes.** Há um `jest` no `package.json` e
um `jest-e2e.json` — o esqueleto que o NestJS gera e que nunca foi preenchido.

O que existe é o `scripts/qa-rapido.py`: 34 verificações de fumaça contra a
aplicação rodando. Ele prova que o caminho principal funciona **agora, nesta
máquina**. Não cobre lógica isolada, e não roda em CI.

## A regra que vale daqui para frente (01/09)

**Card → desenvolvimento → teste → commit.** Registrada no CLAUDE.md:

- não se desenvolve sem card
- não se commita sem teste
- card só fecha com teste passando

Este card trata do **passado**: o que já está no ar sem cobertura.

## ⚠️ Teste real, não teste de cobertura

**A regra mais importante deste card, e a mais fácil de violar sem perceber.**

Teste escrito olhando a implementação **confirma o que o código faz**. Se o
código está errado, o teste passa — porque foi derivado dele. Isso produz um
número de cobertura alto e nenhuma proteção.

| | Teste real | Teste de cobertura |
| --- | --- | --- |
| Vem de | o que a função **deve** fazer | o que a função **faz** |
| Com bug no código | **falha** | passa |
| Escrito a partir de | card, regra de negócio, medição | leitura da implementação |

**O critério prático:** antes de aceitar um teste, **quebre o código de
propósito e veja o teste falhar**. Se ele passar com o código quebrado, ele não
testa nada.

Isso não é teoria aqui. Em 31/08 o `qa-rapido.py` estava com **8 checagens de
papel se pulando em silêncio** — o usuário de teste sumiu numa migration, o
bloco caía no `skip`, e nada falhava. E na mesma leva, o tech-lead do PLT-11
**reinjetou a regra antiga** para ver o login gravar `COMMON_USER` por cima do
manager, antes de provar a correção. É esse o padrão.

## As camadas, na ordem em que pegam bug

### 1. Lógica pura — sem rede, sem banco

É onde **todos os bugs desta semana apareceram**, e o teste é rápido e barato.

- `backend/src/perfil/documentos.ts` — CPF, RFC, CUIT, cédula, RUT, DNI.
  **Três bugs medidos aqui em 31/08**: `digitos()` apagava letras em vez de
  reprovar (`"CPF 123.456.789-09"` passava), o RFC aceitava **31 de fevereiro**,
  e a cédula colombiana aceitava letras.
- `backend/src/perfil/endereco.ts` — validação de texto e código postal.
- `backend/src/auth/auth.service.ts` → `papelPara()`. **A armadilha do PLT-11**:
  `ADMIN_EMAILS` ganha sempre, `MANAGER` vem do banco, admin que sai da lista
  cai para `COMMON_USER` e não para `MANAGER`.
- `frontend/src/components/vagas/vaga-filtro.ts` → `casar()`. **Já quebrou**:
  `"C#"` não casava consigo mesmo depois de tirada a pontuação.
- `backend/src/jobs/elegibilidade.ts` — resolve 95,6% sem IA (JOB-21).
- `frontend/src/invoice/` — **dinheiro é centavo inteiro**;
  `Math.round(1.005 * 100)` devolve 100 e perde um centavo (INV-11).
- `backend/src/jobs/grupo.ts` — a assinatura que agrupa buscas.
- `backend/src/settings/crypto.ts` — cifrar/decifrar, e que **salts diferentes
  não se decifram entre si**.

### 2. Serviços com banco

Aqui mora a armadilha que **já apagou uma tabela inteira** (JOB-05):
`where: { campo: undefined }` no Prisma **descarta a condição** em vez de não
casar nada.

- `perfil.service.ts` — trocar de país apaga o documento; "Not set" também;
  salvar só o telefone preserva o resto
- `usuarios.service.ts` — as proteções de papel
- `salvas.service.ts`, `historico.service.ts` — o `DELETE` sem parâmetro
- `recursos.service.ts` — a separação produto/admin

### 3. Rotas, papéis e contratos

A matriz inteira: anônimo 401, comum 403, manager e admin conforme o caso.
Metade já está no `qa-rapido.py` e vira teste de verdade, que roda no `npm test`
em vez de depender da aplicação de pé.

E os contratos que já mordem: `forbidNonWhitelisted` rejeitando campo sem
decorador, DTO de resposta sem campo sensível.

### 4. Frontend

Componentes com estado e as telas. É a camada mais cara e a que menos bug
produziu — vem por último de propósito.

## O que fazer com o que a suíte encontrar

**Bug achado vira card na raia `Bugs`** do `KANBAN.md`, com:

- o teste que o pegou, **e o teste entra no repositório antes da correção**,
  marcado como conhecido (`.failing` / `skip` com o motivo e o link do card)
- o que se esperava e o que aconteceu
- como reproduzir

**Não corrija em silêncio no meio da suíte.** Um bug corrigido sem card é um
defeito que ninguém sabe que existiu — e a próxima pessoa não sabe que aquela
parte já falhou uma vez.

## Como rodar

`npm test` no backend precisa funcionar de verdade — hoje o `jest` está
configurado e não há o que rodar. Decidir se roda dentro do container ou fora
(o `node_modules` local tem o Prisma Client desatualizado por permissão de
cache, medido em 31/08).

O `scripts/qa-rapido.py` **continua existindo** e não é substituído: ele prova o
sistema montado, e é o que pega erro de integração que teste unitário não vê.

## Critérios de aceite

- [x] `npm test` roda e passa, no backend — **209 testes, 6 suítes**
- [x] Cada teste foi **visto falhar** com o código quebrado de propósito
- [ ] As camadas 1 e 2 cobertas; 3 e 4 com plano escrito — **camada 1 feita; a 2 não**
- [x] Nenhum teste que dependa de dado que outro teste criou
- [x] Nenhum teste que se **pule em silêncio** — se não pode rodar, falha
- [x] Todo bug encontrado tem card na raia `Bugs`, com o teste junto — QA-02
- [x] O `qa-rapido.py` continua passando

## O que foi entregue na camada 1 (01/09/2026)

**319 testes: 209 no backend (Jest) e 110 no frontend (Vitest).** Nenhum
`skip`, nenhum `only`, nenhum `todo` — conferido por `grep`.

| Arquivo | Testes | O que cobre |
| --- | ---: | --- |
| `backend/src/perfil/documentos.spec.ts` | 59 | CPF, CUIT, RUT, RFC, cédula, DNI |
| `backend/src/perfil/endereco.spec.ts` | 35 | texto e código postal |
| `backend/src/auth/auth.service.spec.ts` | 29 | `papelPara`, `authDesligada` |
| `backend/src/settings/crypto.spec.ts` | 28 | cifrar/decifrar, salts, adulteração |
| `backend/src/jobs/elegibilidade.spec.ts` | 39 | quem pode se candidatar |
| `backend/src/jobs/grupo.spec.ts` | 19 | assinatura do grupo de busca |
| `frontend/src/invoice/money.spec.ts` | 61 | centavo inteiro, INV-11 |
| `frontend/src/components/vagas/vaga-filtro.spec.ts` | 49 | `casar()` via `aplicarCv` |

**Os oito arquivos da camada 1 do card foram cobertos.**

### Os valores não saem da implementação

Os documentos válidos de CPF, CUIT e RUT foram gerados por uma
**implementação de referência independente, em Python**, escrita a partir da
especificação pública de cada dígito verificador. Se o TypeScript calcular
diferente da especificação, o teste falha — em vez de concordar com o próprio
código que deveria conferir.

### Cada teste foi visto falhar

Doze mutações reintroduzidas no código de produção, uma de cada vez, e o
resultado observado:

| Mutação | Testes que falharam |
| --- | ---: |
| `digitos()` volta a apagar letras (bug 31/08) | 2 |
| RFC volta a conferir o dia contra o teto 31 (bug 31/08) | 3 |
| Cédula colombiana volta a usar `digitos()` (bug 31/08) | 1 |
| CPF sem a rejeição dos repetidos | 3 |
| RUT sem o tratamento do `K` | 1 |
| CUIT sem a checagem de prefixo | 1 |
| Endereço com alfabeto ASCII | 7 |
| `papelPara` volta a `ehAdmin ? ADMIN : USER` (PLT-11) | 2 |
| `papelPara` preserva `ADMIN` do banco (escalar privilégio) | 4 |
| `parseAmountToCents` volta a `Math.round(n * 100)` (INV-11) | 7 |
| Vírgula volta a ser sempre milhar (INV-11) | 12 |
| Normalização perde `#` e `+` (bug do `C#`) | 3 |
| Piso de 2 caracteres cai para 1 | 1 |
| `aplicarCv` substitui em vez de acrescentar | 2 |
| `Worldwide` vai como `location` | 3 |
| "não disse" vira "aceita todo mundo" (JOB-09) | 6 |
| Salário entra na assinatura do grupo | 2 |
| Assinatura sem ordenação | 1 |
| Colchete deixa de ser removido com o conteúdo | 3 |

**Duas mutações sobreviveram, e as duas são equivalentes** — o código muda e o
comportamento não:

- `lineAmountCents` sem o guarda de `Number.isFinite`: o
  `Number.isSafeInteger` seguinte já rejeita `NaN` e `Infinity`, então os dois
  caminhos devolvem `0`. O guarda é redundante, não morto.
- `limparLugar` sem `.replace(/\[.*?\]/g, ' ')` **para a entrada
  `LATAM [Remote]`**: a palavra já saiu antes, e o `[[\]{}()]` seguinte
  remove os colchetes vazios. **Foi corrigido no teste**: com conteúdo dentro
  do colchete (`Berlin [EMEA]`) as duas regras divergem, e a mutação passou a
  matar 3 testes.

### Duas expectativas minhas estavam erradas, não o código

Registrado porque o erro oposto — mudar o código para o teste passar — é o
pior desfecho possível:

- exigi que a mensagem de erro do endereço fosse só ASCII, e ela usa travessão
  (`—`), que é tipografia inglesa legítima. O teste passou a cobrar ausência
  de **acento**, que é o sinal real de português vazando.
- esperei que `"TypeScript/JavaScript"` casasse com as duas skills. `casar()`
  devolve `string | null` — um termo rende uma skill, por desenho. Virou teste
  explícito do limite, para que ele seja deliberado e não acidental.

## Como rodar, e por que fora do container

```
cd backend  && npm test     # jest,   209 testes
cd frontend && npm test     # vitest, 110 testes
```

**Fora do container, e a decisão não foi de gosto:** a imagem final do backend
roda `npm ci --omit=dev`, então **não tem jest** — nem deve ter, porque a
imagem de produção não carrega ferramenta de teste. Rodar dentro exigiria um
estágio ou uma imagem só para isso.

**O que impedia o `npm test` local não era o Prisma, como o card supunha.** Era
o bug conhecido do npm com dependências opcionais
([npm/cli#4828](https://github.com/npm/cli/issues/4828)): o resolvedor do Jest
30 usa um *binding* nativo, e a máquina é `linux arm64` **glibc**, mas só o
`@unrs/resolver-binding-linux-arm64-musl` tinha sido instalado. O erro
aparecia como `Module ts-jest in the transform option was not found` — enganoso,
porque o `ts-jest` estava instalado e o Node o resolvia normalmente.

Corrigido com `npm i --no-save @unrs/resolver-binding-linux-arm64-gnu@1.12.2`.
**Isto não está no `package.json`** e some num `rm -rf node_modules` — é
ambiente, não dependência do projeto.

O Prisma Client **também** faltava (`npx prisma generate` nunca tinha rodado
localmente), e é necessário para qualquer teste que importe um serviço. Gerado
com `DATABASE_URL` de fachada — `generate` não conecta em banco nenhum.

## O frontend ganhou runner: Vitest

Não virou card próprio, porque sem ele metade da camada 1 do card ficaria de
fora. **Configurado dentro do `vite.config.ts`**, e não num `vitest.config.ts`
na raiz: o `Dockerfile` do frontend copia uma lista explícita de arquivos de
config, e arquivo novo fora dela seria ignorado em silêncio no build.

Uma armadilha encontrada e anotada no próprio arquivo: o `defineConfig` tem de
vir de `'vitest/config'`, não de `'vite'`. Com o import errado o `npm test`
passa e o `npm run build` quebra no `tsc -b`.

Com zero arquivos de teste o Vitest sai com código 1 (`passWithNoTests` é
`false` por padrão), e ficou assim de propósito: dado o "sem teste, não
commita", vermelho honesto é melhor que verde vazio.

## O que NÃO foi feito

- **Camada 2 (serviços com banco) não foi tocada.** É onde mora a armadilha do
  `where: { campo: undefined }` que já apagou uma tabela (JOB-05), e exige
  decidir como isolar o Postgres entre testes — banco de teste, transação com
  *rollback*, ou Testcontainers. É o próximo card.
- **Camadas 3 e 4 continuam sem plano escrito.** O critério de aceite pede o
  plano, e ele não foi escrito aqui.
- **Não roda em CI.** Não há workflow; os dois `npm test` são manuais.
- `frontend/src/invoice/validate.ts`, `history.ts` e `storage.ts` não têm
  teste — `money.ts` cobre a regra do dinheiro, que era o que o card pedia.

## Por onde começar

Camada 1, e dentro dela **`documentos.ts`** — três bugs comprovados em 31/08,
lógica pura, e o teste é escrito a partir da **especificação do dígito
verificador**, que é a definição de teste real: a regra existe fora do código.
