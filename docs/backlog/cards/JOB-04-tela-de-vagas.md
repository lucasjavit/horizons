# JOB-04 · A tela das vagas encontradas

**Estado:** em andamento (15/08/2026) — a lista está no ar; ver
[O que já está entregue](#o-que-ja-esta-entregue-15082026) no fim do arquivo.
**Tamanho:** M

## Por quê

O valor da feature não é "buscar vagas" — é **não ler as 40 que não serviam**.
A tela é onde isso se prova ou se perde.

## O cartão

Responde as quatro perguntas que decidem o clique, **sem a pessoa abrir a vaga**:

1. **Quanto paga** — em USD/EUR, faixa anual
2. **Posso ser contratado daqui** — "contrata PJ no Brasil" / "só CLT local,
   exige visto". **É a pergunta que mata 70% das vagas e quase nenhum site
   responde na listagem** — é o dado mais valioso da tela
3. **O fuso me quebra** — "4h de overlap (PST)" é diferente de "6h em CET"
4. **Ainda está aberta** — publicada há 2 dias ou há 9

E diz **o que falta** no perfil. Um match que só elogia é propaganda; dizer
"pedem Rust, você não tem" é o que faz confiar no resto.

O **domínio de origem** aparece — busca por IA erra, e mostrar a fonte deixa a
pessoa calibrar a confiança sozinha.

## Extraído versus inferido

"USD 140k (do anúncio)" e "provavelmente aceita PJ" **não podem ter a mesma
tipografia**. Se aparecem iguais, viram a mesma coisa aos olhos — e é assim que
uma alucinação passa por fato.

O trecho de origem do salário e da elegibilidade fica disponível sob demanda.
Isso é verificável, não é confiança.

## Compatibilidade em rótulo, não em percentual

**Forte / Boa / Parcial**, não "92%". Um número percentual de IA sugere uma
precisão que o pipeline não tem.

## O que reusar da invoice

- `Recolhivel` — o painel recolhe no celular quando a lista carrega
- `States.tsx` — Loading / Error / Empty
- o padrão de `Field.tsx`, copiado para `components/vagas/` (não promovido a
  global ainda)
- o par **painel à esquerda / resultado à direita**, com `sticky top-[57px]`

**Não** reusar o acordeão numerado: na invoice há 15 campos em sequência, aqui
há 4 ou 5 opcionais e sem ordem. Numerar sugere uma sequência que não existe.

## Idioma

**Em português.** O usuário é o dev brasileiro; a invoice é que mira o público
global.

## O estado vazio

É a primeira tela de todo mundo, e a única chance de explicar que a busca roda
sozinha. Precisa dizer **explicitamente** que a pessoa será avisada quando
houver vagas — foi decisão do stakeholder que ninguém espera olhando.

## Critério de aceite

- [ ] Lista as vagas não vencidas do grupo da pessoa
- [ ] O cartão responde as quatro perguntas
- [ ] Vaga sem salário mostra "não informado", nunca um número
- [ ] Extraído e inferido são visualmente distintos
- [ ] O trecho de origem do salário fica acessível
- [ ] Estado vazio explica que a busca roda sozinha
- [ ] Acessibilidade: label em todo campo, alvo ≥24px, erro por borda +
      `aria-invalid` + texto
- [ ] Os dois temas

## Depende de

- JOB-03 (ter vaga para mostrar)


---

## ⚠️ Filtrar na exibição não é opcional (15/08/2026)

O agrupamento do [JOB-02](JOB-02-perfil-de-busca.md) deixa fora da assinatura
os filtros que não mudam *quais vagas existem*, só *quais interessam*:
`salary_min`, `exclude_keywords`, `posted_within_days`.

**Esta tela precisa reaplicá-los**, lendo o perfil de quem está olhando. Sem
isso, a pessoa que pediu "mínimo 12k" recebe vaga de 8k, porque outra pessoa do
mesmo grupo pediu 8k — e a interface estaria mentindo sobre um filtro que ela
mesma ofereceu.

É o tipo de defeito que não aparece em teste: a lista carrega, os cards são
reais, e só quem conferir salário por salário percebe.

---

## O que já está entregue (15/08/2026)

**A lista de vagas**, dentro da `/vagas`, convivendo com o formulário de perfil
que já existia — as vagas em cima, o perfil embaixo. Só frontend; o backend
(`GET /api/jobs`) já estava pronto.

Arquivos novos, todos em `frontend/src/components/vagas/`:
`ListaVagas.tsx`, `CartaoVaga.tsx`, `BarraFiltros.tsx`, `vaga-formato.ts`,
`vaga-filtro.ts`. Mais `api.listarVagas` e o tipo `Vaga` no espelho manual.

### Decisão do stakeholder: sem nota (15/08/2026)

A referência visual que ele mandou (captura do look4job) trazia um número na
lateral de cada vaga — 79, 75. **Ele dispensou:** "não precisa de nota."

Então não há percentual, nem barra de compatibilidade, nem rótulo
Forte/Boa/Parcial, **nem ordenação por nota**. A lista sai por data, que é como
o backend já entrega (`postedAt desc`, `foundAt desc`). Isto substitui a seção
"Compatibilidade em rótulo, não em percentual" acima, que fica registrada como
o desenho anterior.

O resto do desenho da referência foi seguido: busca por texto no topo, filtros
em pílulas, cartão horizontal enxuto com `empresa · local · via fonte · escopo`
e as skills embaixo, selo de idade ao lado do título.

### Critérios já atendidos

- [x] Lista as vagas não vencidas do grupo da pessoa
- [x] Vaga sem salário mostra "não informado", nunca um número
- [x] Extraído e inferido são visualmente distintos — extraído em peso médio,
      ausente em itálico apagado
- [x] O trecho de origem do salário fica acessível — botão "ver trecho" que
      revela o texto do anúncio numa `<blockquote>`, com `aria-expanded`
- [x] Estado vazio explica que a busca roda sozinha **e que a pessoa será
      avisada**
- [x] Acessibilidade: alvo ≥24px (o link do título precisou de
      `inline-block py-0.5`; como `inline` media 19px), rótulo no campo de
      busca, `aria-pressed` nas pílulas, contagem em `aria-live`
- [x] Os dois temas

### O que ficou de fora

- **O cartão responde as quatro perguntas** — responde três (quanto paga,
  contratação do Brasil, ainda está aberta). **O fuso não**: o backend não
  devolve overlap de fuso, e o `VagaDto` não tem o campo. Precisa de dado novo,
  não de tela.
- **"O que falta no perfil"** ("pedem Rust, você não tem") não existe: exigiria
  cruzar as skills da vaga com o `cvProfile`, e o stakeholder pediu para manter
  como está por ora.
- **O par painel à esquerda / resultado à direita** com `sticky top-[57px]` não
  foi feito — a lista ficou em coluna única, sobre o formulário. O stakeholder
  disse que a referência "é só um exemplo de como eu quero que mostre no
  front, pode continuar como está, qualquer coisa muda depois".
- A **reaplicação dos filtros de exibição** (o aviso de 15/08 acima) **já é
  feita pelo backend**, em `vagas.service.ts` — a tela não precisou repetir.

### Uma armadilha que voltou

A barra "Salvar alterações" do formulário é `sticky bottom-0` no celular. Com a
lista de vagas acima, a posição natural dela passou a cair **no meio do
formulário** — medido: barra em y=1986 cobrindo "Seu perfil de busca", "O que
você procura" e "Cargos". É exatamente o defeito que o comentário no código já
descrevia, com a premissa mudada.

Correção: o `sticky` agora vale **só quando não há perfil salvo**, que é o caso
em que o formulário é a página inteira e a barra precisa ficar no polegar. Com
perfil, ela solta e fica no fim.


---

## Verificado por mim (15/08/2026)

Com as 5 vagas de exemplo semeadas (mais uma vencida, de propósito):

| O que | Resultado |
| --- | --- |
| `GET /api/jobs` sem token | **401** |
| Lista | 5 cartões, ordenados por data |
| Vaga vencida | **não aparece** |
| Salário ausente | *"não informado"* em itálico — nunca um número |
| "ver trecho" | revela o texto do anúncio de onde o salário saiu |
| Contador com filtro | "2 de 5 vagas", batendo com os 2 cartões visíveis |
| Busca por texto | filtra no cliente |
| Pílulas | `aria-pressed`, OU dentro do grupo, E entre grupos |
| Tema escuro | correto |
| Erros de console | **zero** |

### Um bug que achei na revisão

**Seis skills apareciam nos cartões sem ter pílula de filtro.** As vagas usavam
18 skills distintas; a barra mostrava 12, e o teto cortava Kotlin, PostgreSQL,
RabbitMQ, TypeScript, Node.js e Python — sem nada indicando que existiam. Um
cartão dizia "Kotlin" e não havia como filtrar por Kotlin.

O teto em si é certo (a barra não pode virar um muro de pílulas), e o cuidado
de nunca esconder uma pílula *marcada* já estava lá. Faltava tornar o resto
**alcançável**: agora há um `+6` que expande o grupo. Medido depois: 22 → 28
pílulas, Kotlin clicável, filtro aplicando.

### Dois falsos positivos meus, que quase viraram bug

- Li "5 vagas" como se fosse o resultado do filtro e achei que o filtro não
  aplicava. O texto real era **"2 de 5 vagas"** — minha regex parava no primeiro
  número. O filtro estava certo desde o começo.
- Um teste meu procurava "nota" por padrão numérico e acusou `75`. Era o
  **salário** "EUR 75k–95k".

Registro os dois porque a lição é a mesma das outras vezes: a asserção precisa
medir o que a pessoa vê, não um padrão parecido.

## Estado

**Em andamento**, não feito. Falta do card original: fuso/overlap (não existe
no `VagaDto` — precisa de dado novo na captura) e "o que falta no perfil".

E vale dizer o que isto **não** é: a busca não roda sozinha. As vagas estão no
banco porque eu as semeei. O que existe é a estrutura (`FoundJob`, expiração de
15 dias, agrupamento) e a tela. O job de 50 minutos é o [JOB-03](JOB-03-busca-em-segundo-plano.md).

## Sem nota, por decisão do stakeholder (15/08/2026)

A referência visual que ele mandou (look4job) tinha um número de compatibilidade
(79, 75) na lateral. Perguntei se entrava, e a resposta foi **"não precisa de
nota"**.

Isso resolve na prática o que o card já discutia em "Compatibilidade em rótulo,
não em percentual": não há nota, nem número, nem barra, nem rótulo. A ordenação
é por data.
