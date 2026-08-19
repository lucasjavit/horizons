# JOB-18 · Três níveis de busca, e o que sustenta o nível pago

**Estado:** esperando decisão — **arquitetura medida em 18/08/2026**, ver
[docs/design/JOB-18-arquitetura-dos-niveis.md](../../design/JOB-18-arquitetura-dos-niveis.md)
**Tamanho:** G — e é G de verdade; ver [Isto é mais de um card](#isto-e-mais-de-um-card)
**Origem:** *"Quero ter diferentes tipos de buscas, pois assim o usuário poderá
escolher entre: busca ruim gratuita / média / boost que seria uma power"*
(18/08/2026)

E a objeção que o próprio stakeholder levantou, que vale mais que o pedido:

> *"Hoje o usuário pode pegar a descrição da vaga e ir buscar na internet, fica
> fácil."*

---

## A objeção está certa, e mata metade dos desenhos possíveis

Qualquer pessoa cola o anúncio no ChatGPT e pergunta *"aceito brasileiro? o que
falta no meu perfil?"*. Isso é grátis, é bom, e melhora sozinho a cada modelo
novo. **O Horizons não pode competir nisso.**

O que isso elimina, e é preciso dizer com todas as letras:

| Se o nível pago for… | Por que não sobrevive |
| --- | --- |
| Ler o anúncio mais fundo | É literalmente o que o ChatGPT grátis faz num prompt |
| Modelo melhor (Opus em vez de Haiku) | A pessoa já tem acesso ao mesmo modelo |
| "Análise de compatibilidade com o CV" | Cola CV + anúncio, mesma resposta |
| Mais vagas por busca | Diferença de quantidade, não de espécie — e barata de copiar |

O nível médio esboçado no pedido ("busca média") cai exatamente aí. **Se os três
níveis se diferenciarem por quantidade de vagas ou profundidade de leitura, o
pago não existe.**

---

## A vantagem defensável

**O ChatGPT responde sobre a vaga que a pessoa já achou. O Horizons acha a vaga
— continuamente, no catálogo inteiro, e sabendo o que ela já viu.**

A pergunta *"esta vaga aceita alguém no Brasil?"* o ChatGPT responde. A pergunta
*"quais das 3.000 vagas abertas agora aceitam alguém no Brasil, e quais são
novas desde ontem?"* ele **não** responde, e não é falta de inteligência — é
falta de três coisas que só um serviço tem:

### 1. O catálogo — dado que a pessoa não tem

864 empresas curadas com ATS e slug, filtradas por país; 27 mil boards conhecidos
nos `slugs-*.json`; 5 APIs de vagas remotas; ~90 startups em watchlist
([JOB-17](JOB-17-catalogo-de-ats.md)).

Isso não é uma lista de links — é o **endereço de API canônico** de cada
empresa. Medido: GitLab devolve 199 vagas numa chamada, Ramp 137 com faixa
salarial **estruturada**, Lever traz `workplaceType` pronto. Grátis, sem chave.

O ChatGPT com `web_search` acha uma amostra do que o Google indexou. O catálogo
lê a **fonte**, sem intermediário, sem SEO no meio. E o modelo não pode montar
esse catálogo na hora: medido no [JOB-13](JOB-13-busca-pela-ia.md), perguntado
onde a Elastic publica vagas ele respondeu `boards.greenhouse.io/elastic` —
errado. **Fato de empresa sobrevive ao treino; slug e URL de vaga apodrecem.**

### 2. O tempo — trabalho que acontece sem a pessoa

A busca roda a cada 50 minutos ([JOB-03](JOB-03-busca-em-segundo-plano.md)),
enquanto ela dorme. Ninguém abre o ChatGPT de hora em hora para perguntar "saiu
vaga nova?". Uma pergunta pontual não vira vigilância — e procurar emprego é
vigilância, não pergunta.

O corolário é o produto inteiro: **a vaga chega à pessoa, ela não vai buscar.**

### 3. O acúmulo — estado que só existe aqui

O que ela já viu, já descartou, já salvou, já aplicou. O perfil extraído do CV
já carregado. A vaga que apareceu ontem e sumiu hoje.

Cada conversa nova com o ChatGPT começa do zero. Aqui, na décima semana, o
sistema sabe que ela recusou 40 vagas americanas e clicou em 9 europeias — e a
busca seguinte é melhor por causa disso. **Isso não é copiável colando um
anúncio numa caixa de texto.**

### O teste que aplico a cada nível daqui para baixo

> *Uma pessoa com ChatGPT grátis e uma tarde livre consegue reproduzir isto?*

Se sim, o item **não pode** ser o que justifica o pagamento. Pode existir — só
não pode ser o argumento.

E o inverso vale como aviso: **o ChatGPT é o piso de qualidade, não o
concorrente.** Uma resposta pior que a dele sobre uma vaga isolada faz a pessoa
desconfiar de todo o resto, mesmo do que ele não faz.

---

## Os três níveis

O eixo não é *quanta inteligência* — é *quanto do catálogo, com que frequência,
e com quanta memória*.

| | **Grátis** | **Acompanhamento** | **Boost** |
| --- | --- | --- | --- |
| Cobertura | as 5 APIs remotas abertas | + catálogo por ATS | + watchlist e boards fora da curadoria |
| Quando roda | sob demanda, a pessoa clica | a cada 50 min, sozinha | idem, e mais fontes |
| Continuidade | nenhuma — cada busca é a primeira | histórico, "novas desde ontem" | + o que ela descartou realimenta |
| Elegibilidade | campo da API, sem IA | IA cita o trecho | idem |
| Custo/busca | ~0 | 1 chamada de IA | 1 + N |

### Nível 1 · Grátis — *"o que tem hoje"*

**Entrega.** A pessoa preenche o perfil e clica. O sistema consulta as APIs
abertas de vagas remotas (Remotive, Arbeitnow, Himalayas, RemoteOK,
WeWorkRemotely) e devolve o que houver, com elegibilidade **lida de campo, não
de IA** — `candidate_required_location` do Remotive responde a pergunta central
sem custo nenhum. Sem histórico: fechou a aba, acabou.

**Custo ao Horizons.** Praticamente zero. As APIs são grátis e sem chave. Zero
crédito de Firecrawl, zero chamada de IA.

**Por que sobe.** Porque ela volta amanhã e vê **a mesma lista**. O volume das
APIs abertas é pequeno e enviesado — medido: Remotive devolveu 17 vagas, "a
maioria marketing, freelance writer e sales". O limite aparece por si, sem
precisar de trava artificial.

### Nível 2 · Acompanhamento — *"a busca trabalha por você"*

**Entrega.** As três coisas defensáveis, juntas:

- **catálogo** — as empresas do `empresas.yaml` com ATS consultável, por API
  canônica;
- **tempo** — roda a cada 50 min, sem ninguém olhando; avisa por e-mail;
- **acúmulo** — histórico de 15 dias, vaga salva para sempre
  ([JOB-05](JOB-05-salvar-vaga.md)), e o distintivo **"novas desde a última vez
  que você entrou"**, que é o que faz abrir o app de manhã.

A IA entra **só onde ela é boa**: ler elegibilidade com trecho citado. Medido no
[JOB-15](JOB-15-escolha-da-ia.md): 15 de 15 com elegibilidade citada, contra 0
de 7 do Firecrawl.

**Custo ao Horizons.** As chamadas de ATS são grátis. Sobra a IA de
elegibilidade: 1 chamada por rodada por **grupo** — e o agrupamento do
[JOB-02](JOB-02-perfil-de-busca.md) é o que segura essa conta, porque perfis com
a mesma assinatura dividem a rodada. Sem ele, N usuários seriam N buscas a cada
50 minutos.

**Por que sobe do grátis.** Porque parou de procurar. É a diferença entre
consultar e ser avisado.

### Nível 3 · Boost — *"onde ninguém procura"*

**Entrega.** O que sobra depois que o ATS foi lido, e que ninguém alcança
sozinho:

- **watchlist de ~90 startups sem API** (Cursor, Baseten, Cognition, Dub) — é o
  único lugar onde o Firecrawl continua fazendo sentido, e o `fontes.yaml` já
  diz isso;
- **boards fora da curadoria** — os 27 mil `slugs-*.json`, empresa que a
  curadoria de julho não alcançou;
- **frequência maior** e fila de prioridade quando houver disputa por recurso.

**Custo ao Horizons.** É o único nível com custo marginal real: Firecrawl a 42
créditos por rodada de watchlist, mais 1+N chamadas de IA. É o que precisa ser
medido antes de precificar.

**Por que sobe do acompanhamento.** Porque a vaga boa em startup pequena não
está em board nenhum — e é exatamente a que paga em USD e contrata PJ sem
pensar duas vezes.

---

## Sendo cético com a própria proposta

**O nível 3 é o mais frágil dos três.** "Mais fontes" é diferença de grau, e
custa caro justo onde o retorno é incerto: a watchlist não foi medida. Não sei
quantas vagas ela rende, nem quantas são elegíveis. **Antes de vender o Boost,
rodar a watchlist uma vez e contar.** Se render 3 vagas, não é um nível — é uma
linha no nível 2.

**O nível 1 corre risco de ser ruim demais.** 17 vagas de qualidade mista é o
suficiente para alguém dizer "esse site não tem nada" e nunca voltar. O grátis
precisa ser **honesto sobre a própria cobertura**, e é o que o critério de
aceite do estado vazio cobra.

**O que continua copiável:** o nível 2 pode ser reproduzido por um dev que
escreva um script contra as APIs de ATS — as APIs são públicas e o
`empresas.yaml` veio de dado público. A defesa não é o segredo, é o **trabalho
acumulado**: a curadoria de 864 empresas, o filtro por país, as defesas contra
alucinação dos JOB-09/10/12. Reproduzível não é o mesmo que reproduzido — mas
não é fosso permanente, e não vale fingir que é.

---

## O que NÃO deve ser pago, nunca

O produto precisa ser bom de graça no lugar exato onde ele prova que funciona:

1. **A pergunta central — "aceita brasileiro?" — com o trecho que prova.**
   É a razão de o produto existir. Cobrar por ela é cobrar pelo argumento de
   venda. No grátis ela vem do campo da API; no pago, da IA — mas ela **vem**.
2. **O perfil e a leitura do CV.** É o que faz a primeira busca valer alguma
   coisa. Cobrar por cadastrar é cobrar para começar.
3. **A honestidade do dado.** Trecho de origem, "não informado" em vez de número
   inventado, extraído versus inferido distintos ([JOB-04](JOB-04-tela-de-vagas.md)).
   Um "salário verificado" pago implicaria um não-verificado grátis — e vender
   confiabilidade é admitir que o grátis mente.
4. **Salvar vaga.** É barato e é o que cria o hábito.
5. **A primeira semana completa.** Um teste do nível 2 sem cartão — a pessoa só
   entende "a busca roda sozinha" depois de acordar com vaga nova na tela. Isso
   não se explica em landing page.

---

## Critério de aceite

### Os níveis existem e são visíveis

- [ ] O perfil tem um nível associado, e a tela de vagas mostra qual está ativo
- [ ] Quem está no grátis vê, na lista, quantas fontes foram consultadas e
      quantas existem no nível seguinte (ex.: "5 fontes abertas · 864 empresas
      no Acompanhamento")
- [ ] Trocar de nível muda o resultado da busca seguinte sem recriar o perfil

### Nível 1 · grátis

- [ ] Buscar sem nenhuma chave de IA e sem Firecrawl devolve vagas — o grátis
      não depende de token de ninguém
- [ ] Elegibilidade vinda de campo da API aparece com a origem indicada
      ("do campo `candidate_required_location`"), diferente de elegibilidade
      lida por IA
- [ ] API fora do ar não derruba a busca: as outras respondem e a tela diz qual
      falhou
- [ ] Duas buscas seguidas com o mesmo perfil, sem vaga nova, mostram a mesma
      lista sem duplicar

### Nível 2 · acompanhamento

- [ ] A busca consulta as empresas do `empresas.yaml` por API de ATS, e a vaga
      traz URL canônica (não uma URL montada)
- [ ] Slug morto (`plaid` vazio, `netflix` inexistente no Lever) é tratado como
      resposta normal — a rodada continua e o log registra
- [ ] Toda vaga listada tem elegibilidade com trecho citado, ou aparece marcada
      como `unknown` — nunca `false` sem citação ([JOB-09](JOB-09-vaga-so-afirma-o-que-cita.md))
- [ ] A lista separa "novas desde a sua última visita" do resto
- [ ] Perfis do mesmo grupo consomem **uma** rodada, verificável no log
- [ ] Baixar do nível 2 para o grátis **não apaga** vaga salva

### Nível 3 · boost

- [ ] Uma rodada de watchlist é executada e o número de vagas elegíveis é
      **registrado neste card** antes de o nível ir para a tela
- [ ] Vaga vinda da watchlist mostra a origem, distinta de vaga vinda de ATS
- [ ] Estourar o crédito do Firecrawl degrada para o nível 2 na mesma rodada,
      com aviso — não devolve lista vazia

### O que precisa continuar grátis

- [ ] Elegibilidade com trecho de origem aparece em todos os níveis
- [ ] Upload de CV e edição de perfil não pedem nível
- [ ] Salvar vaga não pede nível
- [ ] "Não informado" continua sendo "não informado" em todos os níveis

---

## Casos de borda

- **Pessoa no grátis com zero resultado** (as APIs devolveram nada para o
  perfil): a tela diz o que foi consultado e o que existe no nível acima, em vez
  de "nenhuma vaga encontrada" — que soa como "não existe vaga para você".
- **Downgrade com 200 vagas em histórico**: as vagas do nível pago não somem na
  hora; expiram pela regra normal dos 15 dias. Salvas ficam.
- **Grupo com pessoas de níveis diferentes**: a rodada roda no nível mais alto
  do grupo, e cada pessoa vê só o que o nível dela alcança. Se isso for caro
  demais, o grupo passa a incluir o nível na assinatura — e aí o custo sobe.
  **Decisão em aberto.**
- **Nível cai no meio de uma rodada de 50 min** (assinatura vencida): a rodada
  em curso termina; a próxima já respeita o nível novo.
- **Todas as APIs abertas fora do ar**: o grátis fica sem nada. Precisa dizer
  "as fontes estão indisponíveis", não "nenhuma vaga".

---

## Fora de escopo

- **Cobrança de verdade** — gateway, assinatura, faturamento, cancelamento.
  Este card define *o que* cada nível entrega, não *como* se paga. A decisão
  registrada no KANBAN.md ("cobrança fica para depois") continua valendo.
- **Preço.** Não há informação para precificar; falta o custo medido do nível 3.
- **Ranking por aderência ao CV** e score numérico — decidido no
  [JOB-08](JOB-08-prompt-de-busca.md): rótulo, nunca número, e só quando houver
  CV de verdade.
- **E-mail de aviso.** Depende do nível 2 existir; vira card próprio.
- **LinkedIn e Indeed** como fonte, em qualquer nível.
- **Nível corporativo / múltiplos usuários.**

---

## Depende de

- [JOB-17](JOB-17-catalogo-de-ats.md) — o coletor de ATS é o que **é** o nível 2.
  Sem ele os três níveis se diferenciam por quantidade, que é o desenho que este
  card rejeita.
- [JOB-03](JOB-03-busca-em-segundo-plano.md) — sem a rodada automática, "o
  trabalho contínuo" não existe, e a vantagem defensável perde uma das três
  pernas.
- [JOB-05](JOB-05-salvar-vaga.md) — o acúmulo precisa de onde acumular.
- [JOB-02](JOB-02-perfil-de-busca.md) — o agrupamento é o que segura o custo do
  nível 2.

---

## Isto é mais de um card

Deu G, e G quase sempre são dois disfarçados de um. Este são **quatro**, e a
divisão sugerida é:

1. **JOB-19 · Coletor de ATS** — Greenhouse, Ashby e Lever contra o
   `empresas.yaml`. É o nível 2 inteiro do lado dos dados, e destrava tudo.
   (Absorve a decisão pendente do JOB-17.)
2. **JOB-20 · Fontes abertas** — as 5 APIs remotas, elegibilidade por campo. É o
   nível 1 inteiro, e é o único que dá para construir hoje sem depender de nada.
3. **JOB-21 · Novas desde a última visita** — o acúmulo, que é o que faz voltar.
4. **JOB-22 · Nível no perfil** — o campo, a tela, a degradação, os limites.

**A ordem importa:** 2 → 1 → 3 → 4. O nível 1 primeiro porque é o que dá para
medir sem gastar nada, e porque saber se ele é "ruim aceitável" ou "ruim de
desistir" muda o desenho dos outros dois.

---

## Observações — decisão de quem implementa

Anotado aqui para não virar requisito por engano:

- O coletor de ATS provavelmente resolve de graça o
  [JOB-11](JOB-11-listagem-dentro-do-ats.md) e o
  [JOB-12](JOB-12-url-de-vaga-nao-se-valida-por-status.md) — a API devolve um
  registro por vaga, com URL canônica. Vale conferir se esses dois podem fechar
  junto.
- O Ashby traz faixa salarial estruturada em 137 de 137. Se isso se confirmar em
  escala, salário deixa de precisar de IA nessa fonte — o que muda a conta do
  nível 2 para baixo.
- Nível como campo no `Profile` ou como entidade própria é escolha de quem
  implementa; o que o requisito exige é que exista e seja legível na tela.

---

## Medição de 18/08/2026 — duas das três pendências respondidas

Números completos em
[docs/design/JOB-18-arquitetura-dos-niveis.md](../../design/JOB-18-arquitetura-dos-niveis.md).
O que muda o desenho acima:

**Pendência 1 — "o nível 1 é bom o bastante?" Não, e o motivo redesenha os
níveis.** As 5 APIs abertas somaram **339 vagas** (Remotive 17, RemoteOK 101,
Arbeitnow 175, Himalayas 20, WWR 26). O catálogo de ATS devolveu **27.725 vagas
de 545 empresas em 58s, custo zero, sem um único 429** — 80x mais volume pelo
mesmo preço (zero). A tabela acima coloca o ATS no nível 2 por supor que ele
custa; **ele não custa.** Manter as APIs abertas como nível grátis entrega uma
busca ruim de propósito quando a alternativa boa é igualmente gratuita.

**Pendência 2 — o Boost se sustenta, mas não pelo Firecrawl como motor.**
Firecrawl: 42 créditos / 7 vagas. ATS: 0 créditos / 27.725 vagas. O Firecrawl
só se justifica na watchlist (~90 startups sem ATS), onde não há alternativa.

**O que passa a diferenciar os níveis** (já que volume não pode):
elegibilidade das vagas `"Remote"` puro. O campo estruturado resolve **86,4%**
do corpus com **0% de falso positivo**, mas os **13,2% indeterminados** (3.668
vagas) só a IA lê. Custo medido do recorte típico (Java/Spring): **US$ 0,04**
por busca em Haiku, **US$ 0,27** com finalistas em Opus.

**Consequência para a ordem dos sub-cards:** o JOB-19 (coletor de ATS) passa na
frente do JOB-20 (fontes abertas) — é ele que define o piso, e é grátis.

**Pendência 3 (grupo com níveis misturados) continua em aberto** — é decisão de
produto, nenhuma medição a responde.

## O que ficou pendente de decisão

**São três, e as três travam a implementação:**

1. **O nível 1 é bom o bastante para não afastar?** Não sei, e ninguém sabe —
   nunca rodamos uma busca só contra as APIs abertas com um perfil real. O único
   número que temos é ruim (Remotive: 17 vagas, maioria fora de dev) e o
   Arbeitnow (175 numa chamada) nunca foi testado direito. **Medir isso é o
   primeiro passo**, e o resultado pode obrigar a mover o catálogo de ATS para o
   grátis — o que redesenha os três níveis.
2. **O Boost se sustenta?** A watchlist nunca foi executada. Se render pouco, o
   nível 3 vira uma linha do nível 2 e o produto tem dois níveis, não três.
3. **Grupo com níveis misturados** — roda no nível mais alto e filtra na
   exibição (barato, mas alguém do grátis "paga" processamento que não usa), ou
   o nível entra na assinatura do grupo (correto e mais caro)? É decisão de
   produto com consequência de custo, e não dá para adivinhar.
