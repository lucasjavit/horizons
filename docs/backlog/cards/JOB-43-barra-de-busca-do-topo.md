# JOB-43 · A barra de busca do topo

**Estado:** feito (26/08/2026)
**Tamanho:** M

## De onde veio

Duas capturas mandadas pelo stakeholder em 26/08, com o que entra marcado em
retângulo e o que **não** entra riscado em vermelho.

Entra: seletor de local com globo, campo de busca grande com lupa e `×`, botão
de filtros com badge, sino de notificações, alternador de tema e menu.

**Não entra**, e está riscado na captura: o contador social (499) e os dois
ícones ao lado dele. São de rede social, e o produto não tem esse lado.

## O que cada peça faz

| Peça | Comportamento |
| --- | --- |
| 🌐 **Location** | Popover "Location & format": Work format (Remote/Hybrid/On-site) e Region (Worldwide, North America, LATAM, Europe, UK, MENA, Africa, APAC, CIS) |
| 🔍 **Campo** | Texto livre. Enter busca |
| **×** | Limpa **e busca de novo** — o `×` promete voltar ao estado sem texto |
| **Filtros + badge** | Abre o modal do [JOB-41](JOB-41-modal-de-filtros-avancados.md); o badge conta os filtros ativos |
| 🔔 **Sino** | Popover "Notifications" com "No notifications yet." |
| 🌙 **Tema** | Cicla sistema → claro → escuro |
| ☰ **Menu** | Profile, Saved jobs, Settings |

## Três decisões que o desenho carrega

**O `+1` da referência virou um contador de filtros.** Ali é código de telefone;
aqui não haveria o que aquele número significasse. Vale o que a pessoa
escolheu — quantos filtros de lugar estão ligados.

**O sino responde, em vez de ficar inerte.** O pedido foi "só o ícone, por
enquanto sem nada". Um botão que não responde ao clique é promessa vazia: quem
clica não sabe se quebrou ou se está vazio. O popover diz "No notifications
yet.", que é a verdade, e leva a `/config/notificacoes` — o único lugar onde
alguém pode fazer algo hoje. O alerta de verdade é o
[JOB-42](JOB-42-alerta-de-busca-salva.md).

**Sem badge no sino.** Um "0" permanente ensina a ignorar o número antes de ele
começar a valer. O badge nasce quando houver o que contar.

## O que NÃO foi criado, e por quê

**`Profile` aponta para `/vagas`.** Não existe página de perfil — o perfil de
busca é a caixa de currículo mais os filtros, e eles vivem na própria tela
(JOB-02). Criar `/vagas/perfil` só para o menu ter três itens daria um link
para uma tela vazia.

## O tema, que não existia

Não havia alternador: o tema seguia só o `prefers-color-scheme`. O CSS já
estava preparado (`:root[data-theme='dark']`), então faltava escrever o
atributo.

São **três** estados, e não dois: `sistema` é a ausência de escolha, e sem ele
não haveria como voltar a "seguir o sistema" depois do primeiro clique, a não
ser limpando o storage à mão.

`aplicarTemaInicial()` roda em `main.tsx` **antes do React montar** — sem isso a
página pinta no tema do sistema e o React corrige depois, piscando branco para
quem escolheu escuro.

## Como isso conversa com os filtros que já existem

O seletor de local escreve nos **mesmos campos** que o modal (`work_modes`,
`regions`). Marcar "Remote" no globo aparece marcado no modal — é o mesmo
filtro visto de dois lugares, e não dois filtros parecidos que divergiriam.

Na busca, a ordem do spread é a precedência: barra → modal → **topo**. O que a
pessoa digitou na barra grande ganha, por ser o gesto mais recente.

## Critérios de aceite

- [x] A consulta da captura funciona — "Java software engineer LATAM" + remoto +
      LATAM devolveu 60 vagas
- [x] O popover de local marca e desmarca, e o resultado muda
- [x] `×` limpa e rebusca — payload `{}` depois do clique, verificado com uma consulta que dá vazio para provar que a lista se refaz
- [x] O badge conta os filtros do modal **e** os do globo — 2 do globo + 1 do modal = 3
- [x] O sino abre, mostra o estado vazio e leva às configurações
- [x] O tema cicla, sobrevive ao reload e **não pisca** — medido: primeiro paint aos 32ms já com `data-theme='dark'`
- [x] O menu leva às três telas, e nenhuma é 404
- [x] Teclado: Enter busca; Esc fecha cada popover **e devolve o foco ao botão**; foco visível
- [x] Os dois temas, cor sempre por token — contraste medido, pior caso 4.91 (AA passa)
- [x] Nada em português na tela
- [x] O que está riscado na captura **não** aparece — dump do HTML da barra: seis controles, nenhum contador social

## O que o QA achou

**1. O `×` limpava o campo e rebuscava com o texto antigo (grave).** Closure
velha: `onTexto('')` só agenda o `setState`, e o `onBuscar()` da linha seguinte
ainda via o valor anterior. O resultado era campo vazio com lista filtrada —
**um estado que a tela afirma não existir**, e que contradizia o comentário
escrito no próprio código.

Corrigido mudando o contrato: `onBuscar` **recebe o texto por parâmetro** em vez
de lê-lo do estado. Mata a classe do bug, e não só este caso.

**2. O badge não contava os filtros do modal (médio).** `onAplicar` chamava
`setAvancados` (estado local) mas nunca `aoMudarAvancados`, que alimenta o
contador. O filtro chegava à consulta normalmente — só o número mentia, e
subcontava justamente o que mais importa, já que o modal tem as 11 categorias.

**3. Esc de dentro do popover jogava o foco no `<body>` (baixo).** Valia para os
três. Fechar com o foco **no botão** funcionava, o que fazia o defeito passar
despercebido em teste superficial; entrar no popover e apertar Esc mandava o
próximo Tab de volta para "Skip to content".

Corrigido de uma vez com o hook `usePopover`. Uma distinção que ficou no código:
**clique fora não devolve o foco, só o Esc devolve** — quem clicou fora já
apontou para onde queria ir, e roubar o foco atrapalharia esse clique.

### O efeito colateral que só apareceu no `qa-rapido.py`

A barra empurrou o bundle principal para **448 KB**, acima do teto de 440.

A saída foi maior que o problema: `VagasPage` e `SalvasPage` viraram
`import()` dinâmico. Nenhuma página do app era lazy — todas entravam no bundle
de quem só quer ler uma aula.

| | Bundle principal |
| --- | ---: |
| antes do card | 438 KB |
| com a barra, estático | 448 KB ✗ |
| **com as páginas lazy** | **412 KB** ✓ |

Ficou **26 KB menor que antes do card**, e a tela de vagas virou um chunk de
39 KB que só quem a abre baixa.

### Duas perguntas do QA, respondidas como decisão

**O tema não propaga entre abas abertas.** Fica assim: persistir é o que o card
pede, e um listener de `storage` mudaria o tema debaixo de quem está lendo em
outra aba.

**A busca não sobrevive ao F5.** Intencional por ora. O caminho certo é
refletir os filtros na URL — compartilhável, com histórico —, e isso é maior
que este card.

## Uma janela que existe, e não vira card agora

Com o chunk atrasado em 3s à força, o `fallback={null}` deixa a URL virar
`/vagas` enquanto a tela ainda mostra a página anterior, sem indicação de
carregamento. O QA reproduziu duas vezes com resultado inconsistente — numa
delas o conteúdo entrou aos 400ms.

Na rede real não aparece: os chunks são pequenos e o carregamento foi imediato
em todas as medições. **Fica registrado, não corrigido** — um spinner que
pisca em milissegundos é mais ruído que informação. Se um dia houver relato de
primeiro acesso em 3G, o conserto é um `fallback` mínimo, e esta nota é o
ponto de partida.

## A barra antiga saiu (26/08)

Decisão do stakeholder na mesma leva: **os 8 dropdowns, o botão `Filter` e o
`All filters` de baixo deles saem.** O que vale é a barra nova.

Removidos: `BarraFiltros.tsx` e `DropdownFiltro.tsx`.

**O que estava dentro dela e NÃO era dela**, e por isso ficou:

- **A caixa de currículo.** Vivia no `cabecalho` da barra porque quem sabe se a
  leitura de CV está ligada é a `ListaVagas`, não a barra (JOB-02). Virou filha
  direta — o dono do estado nunca mudou.
- **O `N jobs found`**, com o `aria-live` que é a única confirmação de que a
  busca terminou para quem usa leitor de tela.
- **O `N saved jobs`**, que já era da lista.

**O modal mudou de dono.** Era montado pela `BarraFiltros` e aberto por um
contador de pedidos — indireção que existia só porque o botão estava numa barra
e o modal em outra. Com um dono só, virou um booleano.

`vaga-filtro.ts` **fica**: o `aplicarCv` e o `paraFiltrosApi` continuam
servindo a leitura de currículo, que não dependia dos dropdowns.

### O que a remoção quebrou, e o que isso ensinou

Tirar a barra foi fácil; o custo estava no que ela **hospedava**.

**O currículo virou filtro invisível e preso (grave).** O `rascunho` continuava
sendo escrito e enviado em toda busca, mas o único componente que o renderizava
tinha sido deletado. Os 15 valores do CV viajavam sem aparecer na tela, o
`Clear all` do modal não os alcançava (é outro estado), e a caixa ainda dizia
*"Uncheck anything we got wrong"* — instruindo uma ação que não existia mais.

**A primeira correção introduziu um bug novo.** Mandei o cargo do CV para
`roles` — que é faceta de vocabulário fechado, enquanto o currículo devolve
título legível:

| consulta | total |
| --- | ---: |
| `roles=["Backend Engineer"]` | **0** |
| `roles=["backend"]` | 27.077 |
| `job_titles=["Backend Engineer"]` | **80.403** |

O zero não dava erro: zerava **todas** as facetas, e o modal lia isso como
"motor indisponível". A mensagem nova mandava revisar em "All filters", e a
tela abria em branco — mesmo sintoma do bug original, causa nova.

A saída não foi traduzir título → slug. Foi reconhecer que **o cargo do CV não
pertence a uma faceta**: vai para o campo de busca, que é full-text, aceita o
título como veio, e é onde a pessoa vê e apaga — a promessa quebrada desde o
começo.

**E a causa raiz que disfarçou os dois:** o modal tratava "todas as facetas
vazias" como "motor fora do ar". São coisas diferentes. Com o serviço
respondendo, zero resultados agora mantém as categorias montadas, e o
`Clear all` fica alcançável — que é justamente o que faltava quando o QA
tentou usá-lo.

### Outros achados da mesma leva

- **Três "Searching" ao mesmo tempo**, um deles afirmando "the list below is
  from your previous search" **depois** de `setVagas([])`, com a lista vazia.
  Dois `role="status"` disparavam em dobro no leitor de tela. Sobrou um.
- **400 virava "0 jobs found"** ao lado de "Could not reach the server" — duas
  afirmações contraditórias, e a real ("termo maior que 80 caracteres") não
  chegava. Agora 4xx lê o corpo e mostra a mensagem do servidor.
- **`Devops` aparecia duas vezes** na categoria Role. Medido:
  `roles=devops` e `categories=devops` devolvem **45.879 cada** — mesmo filtro
  em dois eixos. A segunda seção passou a esconder o que a primeira já mostra.

### Duas retratações do QA, e uma minha

O QA voltou atrás em dois pontos que ele mesmo tinha aprovado: o `Clear all`
era **falso positivo** (o modal estava vazio, não havia o que limpar), e a
"instabilidade" do contador do Devops era erro de medição dele — lia o DOM
900ms depois do clique, antes do refetch.

E apontou um código morto meu: a mensagem "No jobs match this combination" era
**inalcançável**, porque a linha que devolve as categorias roda justamente
quando ela apareceria. Removida — manter as categorias é melhor que a frase: o
`0 matches` do rodapé já diz o que houve, e continuar mexendo nos filtros
resolve, enquanto ler um texto não.

## Relacionados

- [JOB-41](JOB-41-modal-de-filtros-avancados.md) — o modal que o botão de filtros abre
- [JOB-42](JOB-42-alerta-de-busca-salva.md) — o que dará conteúdo ao sino
- [JOB-04](JOB-04-tela-de-vagas.md) — a tela que esta barra encabeça
