# QA-04 · Testes de componente para `ListaVagas`

**Estado:** feito (01/09/2026)
**Tamanho:** M

Fecha a lacuna que o [QA-03](QA-03-camadas-2-3-4.md) deixou explícita: a camada
4 entregou `Paginacao` (15 testes) e `DadosPessoais` (14), e **`ListaVagas`
ficou de fora** — apesar de ser a primeira da lista do card e a que tem mais bug
medido.

## Por que ficou de fora, e por que volta como card

São **1.053 linhas** (`frontend/src/components/vagas/ListaVagas.tsx`), com
upload de arquivo, filtros, paginação sob demanda e histórico — muitas
dependências de rede para dublar. Testá-la bem custa mais do que coube na leva
do QA-03, e testá-la mal produziria a "cobertura sem teste real" que o QA-03
existe para não fazer.

A infraestrutura agora existe e não precisa ser refeita: `jsdom`,
`@testing-library/react`, `/user-event`, `/jest-dom`, o `setupFiles` com
`cleanup()`, e o `include` já aceitando `*.spec.tsx`.

## O que foi entregue

Frontend **139 → 269 testes** (4 → 8 arquivos, 3,5s → 4,4s), em quatro arquivos
novos:

| Arquivo | Testes | O que cobre |
| --- | ---: | --- |
| `components/vagas/ListaVagas.spec.tsx` | 31 | Os três bugs do card, o que viaja na busca, o histórico, as falhas de rede |
| `invoice/validate.spec.ts` | 40 | O que é obrigatório, o que é **só aviso**, e os tetos |
| `invoice/storage.spec.ts` | 29 | Versão, JSON corrompido, storage que lança, merge aninhado |
| `invoice/history.spec.ts` | 30 | A assinatura de deduplicação, a cópia profunda, o teto de 200 |

Os três de `invoice/` são a lógica pura que ficou de fora do QA-01.

## Os três bugs medidos que os testes têm de cobrir

1. **Perda de escolha durante o upload do CV** — o que a pessoa marcou some
   quando a leitura do currículo volta e preenche os filtros.
2. **O selo `CV` mentindo depois de "Clear filters"** — o selo continua
   dizendo que os filtros vieram do currículo depois de eles terem sido
   limpos.
3. **A contagem divergindo dos selos** — o número de filtros ativos não bate
   com os selos desenhados.

Cada um vira teste **visto falhar** com o bug reintroduzido, como manda o
QA-01. Um teste que passa com o bug presente não testa nada.

## A tabela de mutações

**23 mutações aplicadas, 23 mataram teste.** Cada uma reintroduz um defeito
real no código de produção; o arquivo é restaurado depois de cada rodada, e o
`git diff` foi conferido vazio ao fim.

### Os três bugs do card

| # | Mutação | Testes que morreram |
| --- | --- | ---: |
| 1 | `juntar()` deixa de acumular (`new Set([...atual, ...novos])` → só os novos) | 1 |
| 1b | `aoLerCv` descarta o estado anterior (`{...atual}` → `{}`) | 1 |
| 2 | O selo do CV volta a ter fonte própria, fora do alcance do `Clear all` | 2 |
| 3a | `quantosAtivos` ignora o texto da busca | 3 |
| 3b | `quantosAtivos` conta **eixos** em vez de **valores** | 2 |

### O resto do `ListaVagas`

| # | Mutação | Testes que morreram |
| --- | --- | ---: |
| 4 | Descartada volta a aparecer em "All" | 1 |
| 5 | O histórico é pedido mesmo com o recurso desligado | 1 |
| 6 | O corte em 20 da stack do CV some (`ArrayMaxSize` → 400) | 1 |
| 7 | O cargo do CV vai para `roles` em vez do campo de texto | 1 |
| 8 | A senioridade do CV viaja **sem tradução** (`pleno` em vez de `middle`) | 1 |
| 9 | Erro de leitura do CV preenche os filtros mesmo assim | 1 |
| 10 | A caixa de CV aparece com a leitura desligada no servidor | 1 |

### `invoice/validate.ts`

| # | Mutação | Testes que morreram |
| --- | --- | ---: |
| 11 | Quantidade aceita zero (`<= 0` → `< 0`) | 4 |
| 12 | Rate recusa zero (`< 0` → `<= 0`) | 1 |
| 13 | O teto do rate esquece os centavos (`MAX_VALOR * 100` → `MAX_VALOR`) | 2 |
| 14 | E-mail com regex estrita demais | 1 |
| 15 | Vencimento anterior vira **erro** em vez de aviso | 1 |

### `invoice/storage.ts` e `invoice/history.ts`

| # | Mutação | Testes que morreram |
| --- | --- | ---: |
| 16 | `storage` sem guarda de versão | 2 |
| 17 | Spread raso no objeto aninhado (`from`/`billTo` perdem campos) | 2 |
| 18 | Moeda inválida passa direto para o PDF | 1 |
| 19 | Lista de pagamento vazia repõe os padrões | 1 |
| 20 | Histórico sem cópia profunda | 2 |
| 21 | A assinatura inclui o **id da linha** (mata a deduplicação) | 6 |
| 22 | Sem deduplicação (sempre cria registro novo) | 6 |
| 23 | Sem o corte em `MAX` (200 registros) | 2 |

### Duas mutações que ensinaram, e os testes que mudaram por causa delas

**MUT-3b sobreviveu na primeira tentativa.** Contar eixos em vez de valores dava
o mesmo número em todos os testes, porque todos usavam **um valor por eixo** — e
essa é exatamente a forma do bug medido ("3 filters" onde a barra mostra oito
selos). Entraram dois testes com um eixo de três valores, e a mutação passou a
morrer. Um teste que não distingue os dois cálculos não testa a contagem.

**MUT-20 sobreviveu no teste que parecia mais forte.** `editar o rascunho DEPOIS
nao reescreve o historico` lia de volta com `loadHistory()` — que **re-parseia o
JSON do `localStorage`**, e o round-trip corta a referência sozinho, escondendo
a cópia profunda ausente. O teste passou a afirmar sobre a lista **em memória**
devolvida pelo `recordDownload()`, que é o objeto que a tela segura na mão.

Nos dois casos o defeito estava no teste, e não no código — e só apareceu porque
a mutação foi rodada.

## Uma armadilha já conhecida

O `DadosPessoais.spec.tsx` custou uma rodada de testes intermitentes por
esperar só o formulário aparecer: o componente monta assim que o `useAsync`
resolve, mas quem aplica os dados ao estado é um `useEffect` que roda **depois**
— e entre os dois há um render com o estado vazio. A espera tem de ser pelo
**valor assentado**, e não pela presença do elemento. `ListaVagas` tem o mesmo
formato e vai repetir a armadilha.

**Não repetiu.** O `renderizar()` do spec espera o botão `Upload CV`, que só
existe depois de `recursosDeProduto` resolver e gravar `leituraCvAtiva` — é
esperar pelo valor que o efeito escreveu, e não pelo nó. Toda espera do arquivo
segue a mesma regra (o chip que apareceu, o número que mudou). **Zero
intermitência em 3 rodadas seguidas.**

## O bug achado

[INV-17](INV-17-historico-corrompido-derruba-o-download.md) — **um registro
corrompido no histórico derruba o download da invoice**. O filtro do `ler()`
aceita `{draft: {}}` (só exige `typeof draft === 'object'`), e a `assinatura()`
faz `d.invoiceNumber.trim()` — `TypeError`. Como `recordDownload()` assina
**todo** registro guardado para achar a duplicata, um registro velho e ruim
impede o download de uma invoice nova e válida.

O `storage.ts` se protege com `version !== DRAFT_VERSION`; o `history.ts` **não
tem checagem de versão nenhuma**. A assimetria é a causa de fundo.

O teste entrou **antes da correção**, como o QA-02 fez. **O Vitest 4 removeu o
`it.failing`** (`TypeError: it.failing is not a function`, medido em 01/09), que
era o mecanismo do QA-02 no Jest — então o mesmo efeito foi escrito à mão: o
teste afirma o comportamento **errado** e se chama `BUG INV-17 · registro
corrompido AINDA derruba o download`. Verde hoje, e **falha no dia em que
alguém corrigir sem apagar o bloco**. Confirmado aplicando a correção sugerida
no card: o teste falhou, como devia.

## Critérios de aceite

- [x] Os três bugs acima cobertos, cada um **visto falhar** com o bug de volta
- [x] Tabela de mutações no card, como o QA-01 e o QA-03 fizeram
- [x] `npm test` passa no frontend, sem teste intermitente (rodar 3x seguidas)
- [x] Nenhum teste depende de dado que outro criou

## Verificação

| O quê | Resultado |
| --- | --- |
| Frontend, 3 rodadas seguidas | **269 passando** (8 arquivos, ~4,4s), sem intermitência |
| Backend | **383 passando** (15 suítes, 26,5s), intacto |
| `tsc -b --noEmit` | limpo |
| `scripts/qa-rapido.py` | tudo certo |
| Banco de desenvolvimento | **4 usuários e 5 chaves**, antes e depois |

## O que ficou de fora

- **Os serviços sem teste do backend** (prioridade 2 do pedido): `busca`,
  `busca-ats`, `email`, `ia`, `descobertas`, `sessao-de-busca`. Não foram
  tocados — o `ListaVagas` bem feito veio primeiro, como o pedido mandava.
- **A paginação sob demanda dentro do `ListaVagas`** (`carregarMais`, o
  `motivoDoFim`, o `erroDeMais`). O componente `Paginacao` já tem 15 testes
  próprios do QA-03; o que falta é a integração dos dois, e ela pede dublar a
  sessão de cache do servidor.
- **`VagasSalvas`**, o outro braço do `vendoSalvas`. É componente próprio, e
  merece spec próprio em vez de entrar por dentro deste.
- **`invoice/logo.ts`, `companies.ts`, `useInvoiceDraft.ts`** — os dois
  primeiros são pequenos e sem regra de negócio; o terceiro é hook e pede
  `renderHook`.
- **12 schemas `qa03_test_*` residuais** no banco de desenvolvimento, de
  execuções interrompidas anteriores. Não vieram desta leva (o harness dropa o
  schema ao fim) e não afetam nada, mas alguém vai querer limpá-los.

## Depende de

- [QA-03](QA-03-camadas-2-3-4.md) — a infraestrutura de teste de componente
