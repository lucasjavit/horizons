# PLT-12 · `/config/*` é só do admin

**Estado:** feito (31/08/2026)
**Tamanho:** P

## Por quê

Pedido do stakeholder em 31/08: *"separar o que é do admin e o que é dos outros
usuários — o `/config/*` é somente do admin"*.

A auditoria mostrou que **19 das 20 rotas de administração já estavam certas**.
O `@AdminOnly()` cobria `/settings/tokens` (na classe), `/settings/deploy`,
`/jobs/descobertas`, `/email/metricas` e `/email/rodar`, e o guard global é
*fail closed*. Faltava uma.

`GET /api/settings/recursos` era aberto a qualquer sessão **de propósito**, e o
comentário que a justificava dizia:

> A LEITURA e para qualquer sessao, de proposito: a tela de vagas precisa saber
> se pode oferecer o upload, e quem usa a tela nao e admin. **So o que expoe
> aqui e um booleano — nao ha chave nem segredo nesta resposta.**

Era verdade quando foi escrito. Deixou de ser no JOB-33 e no JOB-36, que
acrescentaram campos ao mesmo DTO sem que nada apontasse para a frase. Medido
com token real de `outro@teste.com` (role `USER`) em 31/08 — 20 campos, entre
eles:

```json
{
  "provedores": [{ "id": "MISTRAL", "temChave": true, "status": "funcionando",
                   "httpStatus": 200, "checkedAt": "…", "hint": "XjZq" }],
  "ordemDaIa": ["MISTRAL","GEMINI","OPENAI","ANTHROPIC","GROQ","CEREBRAS"],
  "iaDaBusca": "ANTHROPIC", "iaDaExtracao": "MISTRAL",
  "provedoresDeBusca": 3, "provedoresDeExtracao": 4
}
```

O `hint` são os quatro últimos caracteres da chave do admin — o mesmo campo que
o `ApiToken` expõe para ele reconhecer qual chave está lá. Quatro caracteres não
abrem nada. O problema não é o segredo: é que **a configuração da instalação
inteira** — quais provedores têm chave, quais estão fora de cota, quando foram
verificados, em que ordem a cadeia os tenta — chegava a quem não administra
nada.

**O defeito de fundo não é o campo, é o mecanismo.** Um comentário correto
envelheceu em silêncio porque nada estava olhando para ele. Fechar só a rota
deixaria o mecanismo intacto para a próxima vez.

## O que faz

**Duas rotas com dois DTOs, e não uma resposta filtrada pelo papel.**

| Rota | Guard | DTO | Quem usa |
| --- | --- | --- | --- |
| `GET /settings/recursos/produto` | qualquer sessão | `RecursosDeProdutoDto` — 2 booleanos | aba Jobs (`ListaVagas`) |
| `GET /settings/recursos` | `@AdminOnly()` | `RecursosDto` — 20 campos | as 5 sub-páginas de `/config` |

### Por que duas rotas, e não `if (admin)`

Foi a decisão do card, e é o que responde à pergunta *"qual erra menos quando
alguém acrescentar um campo daqui a três meses?"*:

- **Uma resposta filtrada parte do objeto inteiro e subtrai.** O campo novo
  nasce **exposto**, e só deixa de ser se alguém lembrar de acrescentá-lo à
  lista de remoção. É exatamente o default que produziu este card.
- **Dois DTOs invertem isso.** O campo novo nasce **restrito**, e chega ao
  usuário comum só se alguém o escrever, de propósito, em
  `RecursosDeProdutoDto` — cujo comentário diz, na primeira linha, que tudo ali
  é visível a qualquer sessão.

É o mesmo princípio do guard global da casa: errar deve **fechar**, não abrir.

`paraProduto()` monta o objeto do zero em vez de desestruturar `obter()`.
Seria mais curto e daria a mesma resposta hoje — e reintroduziria o risco, já
que quem editasse `RecursosDto` teria de lembrar de um segundo consumidor com
regra diferente.

De quebra ficou mais barato, e a aba Jobs chama isso a cada carga da lista:
**81 ms contra 549 ms** de `obter()` (média de 20 chamadas, 31/08), porque lê
três flags em vez de montar a lista dos seis provedores com estado de
verificação.

`obter()` continua intacta para os serviços internos (`busca.service`,
`cv-extrator`, `email-agendado`, `descobertas`, …), que rodam no servidor e não
têm papel.

## Critérios de aceite

- [x] Usuário comum recebe **403** em `GET /settings/recursos` (era 200).
- [x] Usuário comum recebe **200** e **só** `leituraCvAtiva` e `historicoAtivo`
      em `/settings/recursos/produto` — sem `hint`, `status`, `httpStatus`,
      `checkedAt`, `ordemDaIa`, `iaDaBusca` nem as contagens.
- [x] Anônimo continua recebendo **401** nas duas.
- [x] Admin continua recebendo os 20 campos, e `/config/ia` mostra os seis
      provedores, os hints, os selos e as duas cadeias.
- [x] A aba Jobs funciona para usuário comum: upload de CV e histórico.
- [x] As 5 sub-páginas de `/config` carregam para o admin sem 4xx.
- [x] `scripts/qa-rapido.py` verde, com regressão nova que **falha de verdade**
      quando um campo vaza.

## O que foi medido (31/08/2026)

Token assinado com o `JWT_SECRET` de dentro do container, como o
`qa-rapido.py` faz. `AUTH_DISABLED=false` — com ela ligada todo mundo é admin e
o teste não valeria nada.

| Rota | anônimo | USER | ADMIN |
| --- | --- | --- | --- |
| `/settings/recursos` | 401 | **403** ← era 200 | 200 (20 campos) |
| `/settings/recursos/produto` | 401 | **200** (2 campos) | 200 |
| `/settings/tokens` | 401 | 403 | 200 |
| `/settings/deploy/prontidao` | 401 | 403 | 200 |
| `/jobs/descobertas` | 401 | 403 | 200 |
| `/email/metricas` | 401 | 403 | 200 |
| `/email/previa`, `/email/assinatura` | 401 | 200 | 200 |
| `/telegram/status` | 401 | 200 | 200 |
| `/auth/me`, `/perfil`, `/jobs/saved`, `/jobs/history`, `/jobs/profile` | 401 | 200 | 200 |

Resposta do usuário comum na rota de produto, na íntegra:

```json
{"leituraCvAtiva":true,"historicoAtivo":true}
```

**Navegador, usuário comum em `/vagas`:** as chamadas foram
`200 /settings/recursos/produto` e `200 /jobs/history`; o botão *Upload CV*
aparece, o modal abre com o `input[type=file]`; com a busca rodada, 133 itens e
25 botões *Dismiss*, e clicar num deles gravou `201 /jobs/history`. Zero erro de
console, zero 4xx.

**Navegador, admin:** as cinco sub-páginas (`/config`, `/config/ia`,
`/config/vagas`, `/config/notificacoes`, `/config/deploy`) carregam sem nenhuma
resposta ≥400. `/config/ia` conferido nos dois temas: os seis provedores, os
hints (`XjZq`, `v6QQ`, `0YgA`, `XgAA`), os selos de estado, as duas cadeias com
as setas e o botão *Test all keys*.

**Usuário comum em `/config/*`:** 403 em toda rota que alimenta as telas. O item
já não aparece no menu; o 403 é o que vale, porque quem sabe a URL chega no
backend de qualquer jeito.

## A regressão que impede a reincidência

Sete verificações novas no `scripts/qa-rapido.py`, com um `token_de_papel()` que
assina para o papel pedido (o `token_de_teste()` existente pega o primeiro
usuário que aparecer, e aqui o papel *é* o objeto do teste).

A que importa compara o **conjunto de chaves** da resposta de produto com
`{leituraCvAtiva, historicoAtivo}` e reprova se sobrar qualquer uma. Foi vista
falhar antes de ser aceita: acrescentando `ordemDaIa` ao `paraProduto()`, o QA
respondeu

```
FALHA  rota de produto nao vaza configuracao (sobrou: ['ordemDaIa'])
```

Com `AUTH_DISABLED=true` o bloco se **pula** e diz por quê — com o login
desligado todo mundo é admin, e cobrar papéis ali seria falha permanente. Falha
que sempre falha para de ser lida.

## O que não foi feito

- **Nenhuma outra rota exposta foi encontrada.** A varredura cobriu os 15
  controllers e as 3 públicas continuam sendo só `GET /auth/config`,
  `POST /auth/google` e o webhook do Telegram (protegido por `secret_token`, e
  404 sem `TELEGRAM_BOT_TOKEN`). As de e-mail com token de 32 bytes
  (`/email/sair`, `/email/contratado`, `/email/voltar-a-procurar`) são
  `@Public()` de propósito — critério do JOB-24, descadastrar sem login.
- `/email/previa`, `/email/assinatura` e `/telegram/status` respondem 200 a
  usuário comum e **está certo**: devolvem a assinatura, o vínculo e a prévia
  *da própria pessoa*. O `disponivel` do Telegram é um booleano de feature
  configurada, da mesma categoria dos dois de produto.
- **A distinção `MANAGER` não foi tocada.** Este card separa admin de usuário
  comum; o terceiro papel é do [PLT-09](PLT-09-cadastro-em-dois-tempos.md) e do
  [PLT-11](PLT-11-gestao-de-usuarios.md).
