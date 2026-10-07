# JOB-54 · A busca mostra as mais recentes primeiro, com `Posted` e `Sort`

**Estado:** feito (05/10/2026)
**Tamanho:** M
**Pedido pelo Lucas (05/10/2026).**

## Por quê

Quem busca vaga quer ver primeiro a que acabou de abrir: vaga velha já tem
fila. Hoje, com texto na busca, a API ordena por relevância e a vaga de ontem
pode estar na terceira página. E a pessoa não tem como escolher outra ordem.

O filtro de idade existe (`idades` em `vaga-filtro.ts`, que vira
`posted_within_days`), mas com janelas largas (7/20/30/90 dias) — não dá para
pedir "hoje" nem "3 dias".

## O que a API de vagas oferece (medido em 05/10, `openapi.yaml` do freehire)

`sort` em `/api/v1/agent/jobs/search` aceita `created_at`, `posted_at`,
`view_count`, `salary_min`, `salary_max`, com `order=asc|desc` (padrão `desc`).
Sem `sort`: consulta com texto ordena por relevância; sem texto, por
`posted_at desc`. `view_count` é quantas pessoas abriram o anúncio.

Não existe "best match" na API.

## Decisão

**Sort**, um seletor único, com `Newest` de padrão:

| opção | como |
| --- | --- |
| `Newest` (padrão) | `sort=posted_at&order=desc` |
| `Relevance` | sem `sort` (a ordem da API para o texto buscado) |
| `Most viewed` | `sort=view_count&order=desc` |
| `Best match` | reordena o que veio pela sobreposição com o perfil da pessoa (stack do CV / tecnologias marcadas); empate cai em mais recente |

**Posted**, escolha única (era múltipla, pegando a maior — que é escolha única
disfarçada): `Any time` (padrão), `Today`, `Last 3 days`, `Last 7 days`,
`Last 14 days`, `Last 30 days`.

## Restrições

- **O anônimo continua com a regra do JOB-47** (só 14+ dias, `posted_at asc`
  dentro da janela). A ordenação escolhida não pode furar esse corte, e os
  testes de `limites-anonimos` continuam passando.
- **Opção que o motor não honra não é oferecida como se honrasse.** ATS e IA
  não têm `view_count`; decidir (e registrar aqui) se a opção some, desabilita
  com explicação, ou ordena localmente.
- A ordenação entra na chave do cache e na sessão de paginação: trocar o
  `Sort` não pode devolver a página guardada da ordem anterior, e a página 2
  tem de continuar a ordem da página 1.
- Busca salva antiga com `posted_within_days` de 20 ou 90 continua abrindo.

## Critérios de aceite

- [x] Busca sem mexer em nada vem da mais recente para a mais antiga
- [x] `Sort` oferece as quatro opções, e cada uma muda a ordem de fato
- [x] `Posted` oferece `Today`, `Last 3 days`, `Last 7 days`, `Last 14 days`,
      `Last 30 days` e `Any time`, e a janela é respeitada
- [x] Trocar `Sort` ou `Posted` refaz a busca e volta para a página 1
- [x] Paginação mantém a ordem escolhida
- [x] O corte do anônimo (JOB-47) continua valendo
- [x] Acessível: `<label>` nos dois controles, operável por teclado, os dois temas
- [x] Testes automatizados no backend e no frontend

## Feito (05/10/2026)

### O que entrou

- **Backend.** `sort` no `FiltrosDto` (`newest | relevance | views | match`,
  `@IsIn`), traduzido em `freehire-consulta.ts`; módulo novo `ordenacao.ts`
  com a reordenação do `Best match` e a **ordem aplicada**, que vai no evento
  `fim` (`ordem`). Sem `sort` a consulta não muda — busca agendada e alerta de
  busca salva continuam como estavam.
- **Frontend.** Dois `<select>` nativos (`OrdemEData.tsx`) logo abaixo da
  barra, fora do quadro dela. Trocar qualquer um busca na hora. `Posted` vira
  chip na faixa de filtros (`Posted: Today ×`) e sai no `Clear all`; `Sort`
  não sai — ordem não é filtro.

### Decisões que o card pedia

1. **A ordem mora nos filtros, e isso resolve cache e paginação sem código.**
   `chaveDoCache` percorre todas as chaves do `FiltrosDto` e a sessão guarda o
   objeto inteiro: `sort` entra na chave e chega à página 2 sozinho, sem viajar
   no corpo de `POST /jobs/search/mais` (que continua mandando só o id).
2. **Opção que o motor não honra: continua oferecida, e a tela diz depois.**
   Qual motor responde só se sabe no fim da cascata, então não dá para esconder
   a opção antes. O `fim` declara a ordem que a lista de fato tem — freehire: a
   pedida; ATS: `newest` (ele só ordena por data) ou `match`; IA e Firecrawl:
   nenhuma — e, quando difere, aparece *"This search was answered by a source
   that cannot sort by "Most viewed". Showing newest first instead."*
   **Não ordenamos `view_count` localmente**: o ATS não tem o dado.
3. **`Best match` reordena só o que já foi carregado, em lotes de 60.** A API
   não tem a ordem, então não há como pedir "as 60 mais afins de 4.846". Cada
   lote (página 1, cada `Load more`) é reordenado dentro de si: mais
   tecnologias em comum primeiro, empate → mais recente. A consulta vai sem
   `sort` (relevância do texto). A dica ao lado do seletor diz isso: *"ranks the
   jobs already loaded, in batches of 60 — not the whole catalogue"*.
4. **O "perfil" do `Best match` são as tecnologias do filtro** (`technologies`)
   — que é onde o upload do CV escreve a stack e onde a pessoa vê e corrige.
   Não lê perfil guardado no servidor. **Sem tecnologia marcada a opção fica
   desabilitada**, com *"Best match needs skills: add some in All filters, or
   upload your CV."*; se a pessoa tira a última skill com `Best match`
   escolhido, o seletor volta a `Newest`. O backend aplica a mesma regra a quem
   chama a API direto (`match` sem tecnologia = `newest`, não relevância calada).
5. **`Today` = `posted_within_days=1`** (últimas 24h — a menor janela da API).
6. **Colisão de nome: a categoria do modal virou `Freshness`.** Ela é a faceta
   `reality` (seção "Posting freshness"), não uma janela de dias.
7. **Anônimo: `Sort` desabilitado e janelas abaixo de 30 dias desabilitadas**,
   com *"Sign in to sort results and to see jobs posted in the last 14 days."*
   A ordem dele é fixa (`posted_at asc`) e só há vaga de 14+ dias — `Today` a
   `Last 14 days` dariam lista vazia sempre.
8. **Busca salva antiga (20/90 dias)**: o DTO aceita como antes; aberta pelo
   modal, o valor vai para o seletor `Posted`, que mostra `Last 20 days` como
   opção extra em vez de fingir `Any time`.
9. **A contagem do modal leva a janela `Posted`** (`janelaEmDias`), senão o
   rodapé prometeria um total que a lista não entrega.

### Medido (05/10/2026)

API do freehire direto, `q=backend engineer&regions=latam`:

| consulta | `ignored_params` | primeiras linhas |
| --- | --- | --- |
| sem `sort` | vazio | 03/10, 01/10, 29/09, 25/09 — relevância |
| `sort=posted_at&order=desc` | vazio | 05/10 13:16, 12:41, 12:33… |
| `sort=view_count&order=desc` | vazio | 44, 38, 37, 36, 32 views; `offset=8` continua em 30, 26… |
| `sortx=view_count` (controle) | `[{param: 'sortx'}]` | catálogo inteiro |

Pela nossa API no ar, com sessão, `job_titles=["backend engineer"]`,
`sort=views` (que espalha as datas e por isso prova a janela):

| `Posted` | vagas | mais antiga | fora da janela |
| --- | ---: | ---: | ---: |
| Today (1) | 60 | 0,93 dia | 0 |
| Last 3 days | 60 | 2,99 dias | 0 |
| Last 7 days | 60 | 6,92 dias | 0 |
| Last 14 days | 60 | 13,78 dias | 0 |
| Last 30 days | 60 | 28,19 dias | 0 |

No navegador (Chromium, sessão de teste assinada como no `qa-rapido.py`):

- Padrão, sem mexer: o pedido sai `{"job_titles":[…],"sort":"newest"}`, as 60
  vêm em ordem decrescente de data, e a ordem das linhas na tela é a da resposta.
- `Load more` em `Newest`: segundo lote decrescente e continuando o primeiro
  (última da página 1 às 13:52 → 13:52 … 13:26).
- `Best match` com python/aws/docker: skills em comum por linha
  `3,3,3,3,3,2×18,1×37` — não-crescente, empate por data.
- Trocar o `Sort` pelo teclado (foco + seta) busca e volta à página 1.
- Sem sessão: as quatro ordens saem `posted_at asc`, mais antiga de 07/07, e
  `Today` devolve 0. Zero `IGNOROU` no log da API em toda a sessão.

Testes: backend **516 → 562** (suíte nova `ordenacao.spec.ts`, 46), frontend
**412 → 434** (22 novos em `ListaVagas.spec.tsx`). Cinco mutações, cinco
reprovaram teste (sort fora do pedido; trocar `Sort` sem buscar; escolha
furando o anônimo; página 2 sem reordenar; `views` com nome errado).

### O que NÃO ficou resolvido

- **`Best match` não é ranking do catálogo** — é reordenação por lote (decisão
  3). Uma vaga muito afim na posição 200 da relevância só sobe quando o lote
  dela for carregado.
- **`Most viewed` na página 2+ não foi conferido pela nossa API**: o `VagaDto`
  não carrega `view_count`, então a continuidade foi medida direto no freehire
  (`offset=8`) e pela URL que sai (teste), não pelos números na tela.
- **O aviso de "fonte que não ordena" só foi exercitado em teste** — com o
  freehire no ar, a cascata não cai para o ATS nem para a IA.
- **A tela do anônimo foi conferida no navegador, mas não a de uma busca salva
  antiga real**: não havia nenhuma com 20/90 dias no banco; o caminho está
  coberto por teste de componente.
- **Busca salva não guarda `Sort` nem `Posted`** — o modal salva só a seleção
  dele. Salvar a janela junto é card próprio se alguém pedir.

### Achados fora do escopo (não mexidos)

- **`frontend/src/components/vagas/vaga-filtro.ts` é código morto**: só o
  próprio spec o importa desde que os dropdowns saíram (26/08). O `idades`
  7/20/30/90 de que este card fala não é renderizado em lugar nenhum — o filtro
  de data não existia na tela. Não foi apagado aqui.
- **A contagem do modal ignora o texto da barra**: com "backend engineer"
  digitado a lista diz 82.221 e o rodapé do modal 1.934.606.
- **`.env` local está com `AUTH_DISABLED=false`**, e o `CLAUDE.md` diz que o
  estado atual é `true`. A verificação com sessão usou token de teste.
- `npx tsc --noEmit -p tsconfig.json` no backend acusa `excluded_keywords` em
  `grupo.spec.ts` (já estava assim; o `tsconfig.build.json` passa).
