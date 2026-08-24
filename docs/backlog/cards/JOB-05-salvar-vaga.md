# JOB-05 · Salvar vaga

**Estado:** feito (21/08/2026)
**Tamanho:** P
**Decisão do stakeholder:** "não vou querer as vagas no banco de dados, a não
ser que o usuário decida guardar a vaga para ele."

## O que faz

Uma estrela no cartão. Clicou, a vaga **sai da regra dos 15 dias** e fica para
sempre.

## Salva um retrato, não uma referência

Guardar só a URL faria a lista de salvas virar coleção de 404 — a vaga sai do ar
em semanas, e é justamente o que a pessoa vai querer reler depois.

Salva título, empresa, URL, os selos, o "por que combina" e o texto capturado.
Assim a página cair não apaga a informação, e a interpretação da IA continua
auditável contra o texto que a gerou.

## Onde ela vê depois

Painel "Minhas vagas" à esquerda, no mesmo padrão do histórico da invoice —
recolhível, com contagem visível. É o mesmo gesto e pela mesma razão: dizer
"o que você guardou está aqui" sem exigir um clique às cegas.

## Critério de aceite

- [x] A estrela salva e desfaz, sem confirmação
- [x] Vaga salva continua legível depois dos 15 dias — tabela separada, sem `expiresAt`
- [x] Salvar duas vezes não duplica — conferido: 2 POSTs, 1 registro
- [x] O painel mostra a contagem
- [x] `aria-live` anuncia "vaga salva", sem toast que some

## Verificado (21/08)

**Backend**, por `curl`:

```
POST   /jobs/saved          → grava com snapshot (salário, elegibilidade)
POST   a mesma de novo      → 201, e continua 1 registro
GET    /jobs/saved          → devolve com os campos do retrato
DELETE /jobs/saved?url=…    → 200, restam 0
DELETE de uma que não existe → 404
```

**Tela**, com Playwright:

```
25 estrelas na lista
aria-pressed  false → true
aria-label    "Save…" → "Remove…"
aria-live     "Programmeur Backend DevOps senior saved."
painel        aparece só depois de salvar, com a contagem
zero erro de console
```

## Duas decisões que fogem do card

**As salvas ganharam ABA PRÓPRIA** (`/salvas`), a pedido do stakeholder em
21/08 — e é melhor que o painel que eu tinha feito primeiro. São momentos de
uso diferentes: buscar é explorar, reler o que se guardou é preparar a
candidatura, e a segunda coisa merece a tela inteira sem oito filtros
disputando espaço.

Na tela de busca ficou só um link — *"3 saved jobs"* — que aparece quando há
alguma. Diz que existem sem ocupar o lugar da lista.

**`upsert` em vez de erro no duplicado.** Clicar na estrela de uma vaga já
salva é engano comum (a tela pode estar desatualizada), e responder 409
transformaria um gesto inofensivo em erro na cara da pessoa. O retrato é
atualizado: se ela salvou de novo, a versão que está vendo é a que vale.

**A estrela some sem sessão.** `salvas === null` significa "não sei", e a
estrela não aparece — melhor ausente que mostrando um estado que pode estar
errado, ou falhando no clique.

## Depende de

- JOB-04 (a tela)
- PLT-02 (vaga salva precisa de dono)


## O QA achou 5 bugs (21/08) — todos corrigidos

**1. GRAVE — `DELETE /jobs/saved` sem `url` apagava a lista inteira**, com
status 200. `@Query('url')` vinha `undefined`, e o Prisma **descarta a
condição `undefined`** em vez de não casar com nada: virou
`deleteMany({ userId })`. Perda permanente, porque vaga salva não tem
`expiresAt` — é o arquivo da pessoa.

É a mesma armadilha que o CLAUDE.md já registra para `where: { userId: null }`.
Corrigido em dois lugares: `RemoverSalvaDto` com `@IsNotEmpty`, e uma checagem
no serviço — quem o chama pode não ser o controller.

**2. MÉDIO — 404 fazia a vaga removida VOLTAR.** Com a lista aberta em duas
abas, remover na segunda devolvia 404 e o rollback desfazia uma remoção que o
servidor já tinha feito. Agora 404 não é falha: é a vaga já não estar lá, e o
estado da tela já é o desejado.

**3. MÉDIO — falha de rede era invisível.** "Could not remove X" só existia na
região `sr-only` de 1×1px. Contraria a convenção da casa — *erro sinalizado
por borda + texto, nunca só cor*, e nunca só para leitor de tela.

**4. MÉDIO — datas davam 500 em vez de 400.** `foundAt: "banana"` virava
`Invalid Date` e estourava no Prisma. Pior: `"01/08/2026"` era lido como **8
de janeiro** (mês/dia dos EUA) e gravava calado — corrupção silenciosa, que é
pior que o erro. `@IsISO8601` nos dois campos.

**5. A11Y — o foco caía no `<body>`** ao remover pelo teclado. Vai para o
título, que é o marco estável da tela.

### Conferido depois

```
DELETE sem url        400 (era 200 + apagava tudo) · as 3 intactas
foundAt "banana"      400 (era 500)
"01/08/2026"          400 (era 201, gravava em janeiro)
title/url vazios      400 (era 201)
404 em duas abas      a vaga NÃO volta
falha de rede         rollback + erro visível na tela
```

### O que o QA confirmou que não quebrou

5 cliques em rajada (estado final sempre bate com o banco); rollback do POST;
vaga já salva reencontrada aparece com `aria-pressed=true`; 40 salvas com GET
em 7ms e ordem correta; limites do DTO; `<script>`, emoji e RTL gravam como
texto sem XSS; alvo de toque 36×36 e foco visível.

### A pergunta que ele deixou, respondida

**A aba Saved não paginava** — 40 salvas viravam 4.514px de rolagem contínua,
enquanto a busca paginava de 25 em 25. Era falta, não escolha. Resolvido em
21/08.

A paginação virou **componente próprio** (`components/vagas/Paginacao.tsx`),
usado pelas duas telas, com o `POR_PAGINA` exportado dali: duas constantes
iguais em arquivos diferentes divergem na primeira vez que alguém mexe numa
só.

Conferido com 30 salvas: 25 na página 1, 5 na página 2, `aria-current` no
número certo, e remover na página 2 não quebra a navegação. O caso limite
também se resolve — esvaziar a última página volta para a anterior, e a
régua some quando sobra uma página só.
