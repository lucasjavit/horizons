# JOB-02 · Perfil de busca e agrupamento

**Estado:** feito (25/08/2026) — falta chave de IA válida para uma leitura real
**Tamanho:** M

## Por quê

Sem perfil não há o que buscar. É o que a pessoa cadastra uma vez, e o que o
job de 50 minutos lê para saber o que procurar.

## O que faz

A pessoa sobe o CV e/ou preenche filtros. **O currículo é um filtro a mais, o
mais poderoso deles** — não um caminho separado. Depois do upload, os campos
aparecem **preenchidos com o que a IA leu, e editáveis**.

Isso resolve os três caminhos que o stakeholder pediu, de uma vez:

- **só CV** → sobe, salva, ignora os campos preenchidos
- **CV + filtros** → sobe, corrige o que veio errado, adiciona salário mínimo
- **só filtros** → ignora a caixa de upload

E, mais importante: deixa a pessoa **ver o que o sistema entendeu do CV dela**.
Um CV lido errado que produz busca ruim, sem ela ver o porquê, é o pior desfecho.

## Do CV, só o perfil extraído

Guarda `{ stack, senioridade, anos }`. **Nunca o arquivo, nunca o texto bruto.**

Some o CPF, o endereço e o telefone — e isso importa porque o guard só passou a
ter dono agora. Token se revoga; CPF não.

O arquivo é processado em memória e descartado. A tela avisa, antes do upload,
que o conteúdo é enviado ao provedor de IA.

### ⚠️ O que "some" significa hoje, e o que não significa

Medido em 15/08/2026, com um CV sintético contendo CPF, endereço, telefone e
data de nascimento:

- **O que fica guardado:** só `{ stack, senioridade, anos }`. O dado pessoal
  não entra no banco. ✅
- **O que sobra no servidor:** nada. O upload usa `memoryStorage` explícito —
  o default do multer grava em disco. Verificado com `find` no container
  depois do upload: nenhum arquivo. ✅
- **O que sai daqui:** o **texto inteiro do CV**, incluindo CPF, endereço e
  telefone, vai para o provedor de IA na chamada de extração. O prompt manda
  não extrair esses campos, e a resposta é limitada por schema — mas isso
  filtra a **saída**, não a entrada.

A tela avisa antes do upload, então a pessoa escolhe com a informação na mão.
Mas o card dizia "some o CPF" sem essa distinção, e ela é grande: filtrar a
saída não é o mesmo que não enviar.

**Se isso não for aceitável**, o caminho é limpar o texto **antes** da chamada:
uma varredura por regex de CPF, telefone, CEP e e-mail no `CvParserService`,
substituindo por marcadores. Fica registrado como decisão em aberto, não como
feito — não dá para descobrir isso depois de um incidente.

### ⚠️ Isto ficou mais grave em 25/08/2026, e a tela passou a dizer

O [JOB-33](JOB-33-cadeia-de-ia.md) trouxe quatro provedores gratuitos, e **dois
deles treinam modelos com o que recebem no free tier**: Gemini (Google, fora de
EU/UK/EEA) e Mistral (Experiment tier).

Combinado com o que está escrito acima — o texto **inteiro** do CV sai daqui, com
CPF, endereço e telefone — isso deixa de ser "um terceiro processa" e passa a ser
"um terceiro pode treinar com". A tela promete que só guardamos stack,
senioridade e anos; **guardar pouco não é enviar pouco**.

**Decisão:** não bloquear — um provedor que treina e funciona vale mais que
nenhum provedor, e as chaves pagas estão mortas. Mas a tela de Configurações
**diz quais treinam**, em dois lugares (no cartão da chave, acima do campo; e ao
lado do nome na lista de ordem). Quem liga a chave decide com a informação na
mão, antes de ligar.

A limpeza do texto antes da chamada continua em aberto, e agora vale mais.

## Agrupamento

O campo `grupo` é a assinatura dos filtros normalizados. Perfis com a mesma
assinatura leem as mesmas vagas — **uma rodada serve a todos**.

Foi decisão do stakeholder, e é o que impede N perfis virarem N buscas a cada
50 minutos.

### O que entra na assinatura, e o que não entra

Implementado em `backend/src/jobs/grupo.ts` como
`senioridade|tecnologias|cargos|regime:locais`.

Entram os campos que mudam **quais vagas existem**: senioridade, tecnologias,
cargos e região. Ficam de fora os que mudam **quais interessam a cada pessoa**
— `salary_min`, `exclude_keywords`, `posted_within_days`.

O motivo é econômico: se salário entrasse, "senior React 8k" e "senior React
12k" dispararariam duas buscas idênticas, e o agrupamento perderia a razão de
existir.

### ⚠️ A consequência, e onde ela tem de ser tratada

**Os filtros que ficam fora da assinatura precisam ser aplicados na exibição,
por perfil** — não na busca.

Se o [JOB-04](JOB-04-tela-de-vagas.md) listar as `FoundJob` do grupo sem
reaplicar `salary_min` e `exclude_keywords` do perfil de quem está olhando, a
tela promete um filtro que o motor ignora: a pessoa pede "mínimo 12k" e recebe
vaga de 8k, porque alguém do mesmo grupo pediu 8k.

Levantado no desenho da tela (14/08/2026) e verificado: nem o JOB-03 nem o
JOB-04 diziam onde isso acontece. **Fica escrito aqui porque é o tipo de
defeito que não aparece em teste** — a lista carrega, os cards são reais, e só
quem conferir salário por salário percebe.

## A tela `/vagas` (frontend, 15/08/2026)

Implementada seguindo [o desenho](../../design/JOB-02-tela-perfil.md):
`frontend/src/pages/VagasPage.tsx` mais `frontend/src/components/vagas/`
(`CampoFichas`, `CaixaUploadCV`, `SeloOrigem`, `Field`). Rota e aba "Vagas" no
`App.tsx`; sem sessão a página mostra um convite para entrar, não o formulário
— que daria 401 só na hora de salvar, jogando fora o que foi preenchido.

**A caixa de upload está preparada mas desligada**: o input fica `disabled` e a
tela diz que a leitura de currículo chega em seguida, porque a extração está
sendo escrita em paralelo. O aviso de privacidade já está no lugar definitivo.

Fica por fazer junto com o upload: o selo "do currículo" e a frase-resumo do
que a IA entendeu. O caminho do selo está escrito e ligado (`doCv` em
`Field.tsx`, com `aria-describedby` e borda esquerda de 3px), mas **nenhum
fluxo o aciona hoje** — quem ligar a extração só precisa passar `doCv`.

Medido, não estimado: o selo usa `--accent-ink`, que dá **6,24:1** no claro e
**9,23:1** no escuro. Passa em AA nos dois.

### Duas armadilhas do contrato, para quem mexer depois

`GET /jobs/profile` sem perfil devolve **200 com corpo vazio**, e o axios
entrega isso como `''`, não como `null`. Sem normalizar em `api.ts`, a tela
trataria string vazia como perfil existente. Já está tratado.

E o `forbidNonWhitelisted` é implacável: `remote: ''` vira 400, porque `''` não
está em `REMOTOS`. Por isso `paraFiltros()` **omite** campo vazio em vez de
mandar vazio. Os tetos de item (`ArrayMaxSize`) são aplicados na entrada do
`CampoFichas`: descobrir o limite só no 400 ao salvar joga fora o formulário
inteiro por um erro que dava para avisar na hora.

### Um defeito encontrado e corrigido

A barra "Salvar" com `sticky bottom-0` **flutuava no meio do conteúdo**, por
cima do campo "Onde" no desktop e da caixa de upload no celular. `sticky` gruda
na posição natural do elemento, e numa página mais curta que a janela essa
posição não é o rodapé. Corrigido com altura mínima no container e `mt-auto` na
barra. Só apareceu na captura de tela — as asserções de funcionalidade passavam
com o bug no lugar.

## Critério de aceite

- [x] Subir CV preenche os campos, editáveis, antes de salvar — feito em
      25/08 na barra de 8 filtros: o CV marca os dropdowns Skills, Experience
      e Job title, e cada valor continua sendo um checkbox que dá para
      desmarcar. Medido no navegador: 7 skills, 1 senioridade e 2 cargos
      marcados a partir do CV sintético, e desmarcar leva de 7 para 6
- [x] Dá para cadastrar só com filtros, sem CV
- [x] Depois de salvar, nenhum arquivo no servidor — `memoryStorage` explícito,
      verificado com `find` no container
- [x] O que fica guardado é stack/senioridade/anos, não o texto do CV —
      **mas veja a ressalva sobre o que é enviado ao provedor**
- [x] Dois perfis com filtros iguais recebem o mesmo `grupo` — medido:
      ordem, caixa e acento não criam grupo novo; salário diferente mantém o
      grupo; stack diferente separa
- [x] A tela avisa que o CV vai para o provedor de IA, antes do upload — na
      `CaixaUploadCV`, acima do input de arquivo, com o texto do desenho;
      verificado no navegador nos dois temas

## Casos de borda

- PDF que é imagem escaneada: **recusa com mensagem**, nunca inventa perfil
- PDF protegido por senha, DOCX corrompido: erro explicado
- Arquivo acima de 5 MB: recusado no backend, não só no front
- Arquivo que não é CV: a IA classifica, e a pessoa vê o que ela entendeu

**Verificado em 15/08/2026** (chamando o parser dentro do container):

| Caso | Resultado |
| --- | --- |
| PDF sem texto extraível | *"Nao consegui abrir este PDF. Ele pode estar corrompido."* |
| DOCX corrompido | *"Nao consegui abrir este DOCX. Ele pode estar corrompido."* |
| Arquivo de 6 MB | *"O arquivo passa de 5 MB. Envie um PDF ou DOCX menor."* |
| Formato não suportado (`.txt`) | *"Formato nao suportado. Envie o curriculo em PDF ou DOCX."* |
| Sem arquivo no corpo | 400 |
| Sem sessão | 401 |
| PDF válido de 841 caracteres | texto extraído, chega ao extrator |

O PDF protegido por senha tem tratamento próprio (mensagem dizendo para
remover a proteção), mas **não foi testado** — não gerei um PDF com senha.

"Arquivo que não é CV" também não foi exercitado: depende de uma chamada de IA
real, e não há chave configurada nesta máquina. O caminho existe
(`ehCurriculo: false` no schema, com mensagem própria), mas está **não
verificado**.

## Depende de

- PLT-02 (perfil precisa de dono)


---

# O perfil alimenta o prompt (13/08/2026)

O prompt de busca (ver [PLT-04](PLT-04-crud-de-prompts.md)) tem dois espaços
que este card preenche:

```
Resume:
{{RESUME}}

Filters:
{{FILTERS}}
```

E ele já trata os três casos que o stakeholder pediu, por conta própria:

- **Case A — só CV**: identifica perfil, famílias de cargo, senioridade
- **Case B — CV + filtros**: o CV qualifica, os filtros restringem, e **filtro
  explícito vence o CV** ("resume information is used for qualification, not to
  override explicit filters")
- **Case C — só filtros**: não inventa qualificação nenhuma

Isso confirma o desenho deste card: os campos vêm preenchidos pelo CV e
**editáveis** — quando a pessoa corrige um campo, ela está exercendo o Case B.

## O formato dos filtros

O prompt espera JSON com `job_titles`, `keywords`, `exclude_keywords`,
`locations`, `remote`, `employment_types`, `seniority`, `salary_min`,
`salary_max`, `currency`, `posted_within_days`, `companies`, `industries`,
`technologies`, `visa_required`, `timezone` — todos opcionais.

O `JobProfile.filtros` guarda exatamente esse formato, e a assinatura do
`grupo` sai dos campos que mais restringem a busca: senioridade, tecnologias
ordenadas e região.

## O que NÃO vai para o prompt

`{{RESUME}}` recebe o **perfil extraído**, não o texto do CV. Some o CPF, o
endereço e o telefone antes de qualquer coisa sair daqui — o CV inteiro dentro
do prompt viajaria para o provedor de IA com dado pessoal junto.


---

## A barra "Salvar" flutuando sobre os campos (15/08/2026)

Vale registrar porque **as asserções passavam com o bug no lugar** — ele só
apareceu numa captura de tela.

A barra usava `sticky bottom-0` com `mt-auto` num container de altura mínima.
`sticky` gruda na posição **natural** do elemento, e num formulário mais alto
que a janela essa posição cai no meio do conteúdo: a barra flutuava sobre
"Senioridade" e sobre o campo de salário, **em qualquer rolagem**.

`mt-auto` resolve só quando o conteúdo cabe na janela. Aqui não cabe — com
"Mais filtros" aberto a página passa de 2.000px.

Corrigido mantendo o `sticky` **só no celular** (`sm:static` a partir de 640px),
onde ele existe por um motivo real: o botão perto do polegar numa página longa.
No desktop a barra fica no fim do formulário.

Medido depois, com "Mais filtros" **aberto**, rolando em cinco posições:

| | Sobreposição |
| --- | --- |
| Desktop 1280×900 | **nenhuma** |
| Celular 390×780 | nenhuma na área visível |

**Um falso positivo no meu próprio teste, que quase virou bug fantasma:** a
primeira medição acusava `salary-min` coberto mesmo depois da correção. O campo
está dentro do `Recolhivel` fechado — `aria-hidden` e `inert`, altura zero para
a pessoa, mas com `getBoundingClientRect` não-nulo. O teste passou a ignorar
elementos `[inert]` e sem `offsetParent`.

## Estado da tela

Feito e verificado no navegador, nos dois temas:

- Anônimo vê convite para entrar, **não** um formulário que daria 401 ao salvar
- Sete campos, fichas com Enter/vírgula/Backspace, "Mais filtros" recolhido
- Validação explica em vez de desabilitar o botão (mín > máx, salário sem moeda)
- Salvou de verdade: `job_titles` e `technologies` no banco, grupo
  `qualquer|node.js|backend engineer|qualquer:qualquer`, confirmação na tela
- Zero erro de console além do Google recusando `localhost` como origem

## A leitura de CV virou um interruptor (15/08/2026)

**Decisão do stakeholder:** *"pode colocar a leitura do cv como um toggle na
config para habilitar (somente se tiver a chave) e desabilitar"*.

Em vez de ficar desabilitada no código até alguém editar um arquivo, a leitura
virou um recurso que o admin liga em **Configurações → Recursos**.

A regra que dá sentido ao controle: **só liga se houver chave de IA
cadastrada.** Um interruptor que liga sem a dependência não liga nada — só
empurra a falha para o momento em que alguém sobe um currículo e recebe erro.
Sem chave o controle fica desabilitado e **diz por quê**.

### Onde a flag é checada, e por que em dois lugares

- **No servidor** (`POST /jobs/profile/cv`), antes de qualquer processamento.
  Um recurso desligado que o servidor ainda aceita não está desligado — está
  escondido, e qualquer um com `curl` continua gastando a chave do admin.
- **Na tela** (`/vagas`), que nem mostra a caixa de upload. Oferecer um upload
  que o servidor recusa é pior que não oferecer.

### Guardado em tabela, não em variável de ambiente

Nasceu o modelo `AppSetting` (uma linha por chave). Variável de ambiente
continua sendo o lugar de segredo e do que decide o boot; isto muda em tempo
de execução, pelo painel, e religar não pode exigir redeploy.

**A chave manda sobre a flag.** Apagar a chave com o recurso ligado desliga o
recurso na prática, mas a intenção do admin (`true`) fica guardada — recadastrar
a chave religa sozinho, sem precisar mexer no toggle de novo.

### Verificado (15/08/2026)

| O que | Resultado |
| --- | --- |
| `GET /settings/recursos` sem sessão | **401** |
| `PUT .../leitura-cv` como USER | **403** |
| Ligar sem chave (como admin) | **400**: *"Cadastre uma chave da Anthropic ou da OpenAI antes de ligar"* |
| Ligar com chave | `{"leituraCvAtiva":true,"temChaveDeIa":true}` |
| Upload com o recurso desligado | **400**: *"A leitura de curriculo esta desligada"* |
| Upload com o recurso ligado | passa o bloqueio e chega à API da Anthropic |
| **Apagar a chave com o recurso ligado** | `leituraCvAtiva` volta a `false`; upload recusado de novo; a flag segue `true` no banco |
| Toggle na tela, sem chave | desabilitado, explicando o motivo |
| `/vagas` sem o recurso | caixa de upload **não aparece** |
| `/vagas` com o recurso | input habilitado, aviso de privacidade acima dele |
| **Erro de upload com campo preenchido** | a ficha digitada **sobreviveu** — recusa não apaga nem preenche nada |

Corrigi de passagem um aviso desatualizado na tela de Configurações, que ainda
dizia *"não existe login de verdade nesta aplicação"* — falso desde o PLT-02.

**Continua faltando:** a frase-resumo do que a IA entendeu ("entendemos que você
é backend pleno, ~5 anos") e o selo "do currículo" nos campos preenchidos, os
dois previstos no desenho. O caminho de dados existe; falta a apresentação.
Testar a extração de ponta a ponta depende de uma chave real — com uma chave
falsa, o caminho vai até a API da Anthropic e volta com erro tratado.


## Ligando a leitura de currículo (25/08/2026)

Faltavam duas coisas: o extrator só falava com a Anthropic, e não havia caixa
de upload na tela desde `7fb2d72`.

### O extrator caiu para a outra IA

Reproduzido antes de mexer: `POST /api/jobs/profile/cv` devolvia **400 em
0,32s**, e o log dizia `401 authentication_error API key is invalid` — com
`temChaveOpenAi: true` ao lado. O `CvExtratorService` ignorava a escolha do
admin e a segunda chave.

Agora ele segue o mesmo desenho do `BuscaIaService`: lê `iaEfetiva` do
`RecursosService` e cai para a outra IA. **Com uma diferença que importa** — o
`BuscaIaService` cai só quando a preferida NÃO TEM CHAVE, e o que aconteceu
aqui foi chave PRESENTE e recusada. Então o CV também cai quando a preferida
falha com 401, 402, 403 ou 429 (`ehChaveMorta`), que são as respostas de chave
inválida, sem crédito, sem permissão e sem cota.

~~O `BuscaIaService` continua sem essa segunda queda~~ — **corrigido em
25/08/2026 pelo [JOB-33](JOB-33-cadeia-de-ia.md)**. A queda por chave recusada
subiu para o `IaService` e vale para os dois usos: era pré-requisito da cadeia
de provedores, e não escopo extra — uma cadeia que não cai quando o provedor
recusa não é uma cadeia. Medido: Anthropic 401 → OpenAI 429 → Gemini responde,
em 1,05s.

Recusa do modelo (`ehCurriculo: false`) **não** dispara a queda: a segunda IA
leria o mesmo texto e diria o mesmo, gastando crédito para repetir a resposta.
Medido — nesse caso o provedor secundário recebe **0 chamadas**.

### Verificação, e por que ela precisou de um provedor falso

**As duas chaves cadastradas estão mortas:** Anthropic devolve 401
(`API key is invalid`) e OpenAI devolve 429 (`You exceeded your current
quota`). Não há chave boa em lugar nenhum — nem no `.env`, nem no ambiente do
container. Isso é conta a pagar, não código.

Para exercitar o caminho de sucesso, os SDKs foram apontados para um servidor
falso via `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` (andaime de teste, fora do
repositório). Os seis casos:

| Caso | Resultado |
| --- | --- |
| Anthropic OK | **201** em 0,45s, perfil completo |
| Anthropic **401** → OpenAI OK | **201** em 0,20s; log: *"ANTHROPIC falhou (chave recusada) — lendo o CV com OPENAI"* |
| Anthropic **429** → OpenAI OK | **201** em 1,45s |
| As duas mortas | **400**: *"Nao consegui ler o curriculo agora… preencha os filtros a mao"* |
| `ehCurriculo: false` | **400**: *"Este arquivo nao parece um curriculo"*, e **0 chamadas** ao segundo provedor |
| Modelo devolvendo PII | ver abaixo |

Com as chaves reais e sem o andaime, o comportamento é o esperado: cai da
Anthropic para a OpenAI e só então falha, em 5,6s.

### O prompt não bastava para proteger o dado pessoal

O CV de teste tem CPF, telefone, e-mail e endereço de propósito. Simulando um
modelo **desobediente**, que devolve esses dados apesar da instrução:

- os campos EXTRAS que ele inventou (`cpf`, `telefone`, `endereco` no topo do
  JSON) já eram descartados — a montagem do DTO só lê os cinco campos
  conhecidos;
- mas o que ele escondeu **dentro** de `stack` e `cargos` (`"CPF
  123.456.789-00"` como se fosse tecnologia) **chegava inteiro na tela**.

Instrução é pedido, não garantia. Entrou uma segunda defesa no `limitar()`, por
onde `stack`, `technologies` e `job_titles` já passavam: cinco padrões (CPF,
telefone, arroba, logradouro, CEP). Medido: **68 tecnologias e cargos legítimos
passam** (`C#`, `.NET`, `Java 17`, `CI/CD`, `Ubuntu 22.04`, `SQL Server 2022`…)
e **11 formas de PII são bloqueadas**, inclusive `12345678900` e
`11987654321` sem pontuação. Depois da correção, a resposta ao modelo
desobediente traz só `["Java"]` e `["Tech Lead"]`.

### O selo "do currículo"

A barra de dropdowns não comporta um selo por campo dentro do botão sem
quebrar a grade de 8. A saída foi um selo **em dois níveis**:

- no botão fechado, um `CV` ao lado do contador verde — dá para ver que há
  chute da IA ali sem abrir os oito dropdowns;
- dentro do painel, um `CV` por opção, para saber **qual** valor veio do CV e
  desmarcar só o errado.

Cor `--accent-ink`, medida no navegador: **6,24:1 no claro** (`rgb(122,92,12)`)
e **9,56:1 no escuro** (`rgb(229,190,79)`) — AA nos dois. O selo carrega texto
("CV" + `sr-only` "N options from your CV"), então não é cor sozinha.

O selo só aparece em opção **marcada**: preso ao `marcado &&`, senão ele
sobrevivia ao desmarcar e ao "Limpar filtros", afirmando origem de um valor que
não está mais escolhido.

### O casamento entre o CV e o catálogo

A IA devolve `"Spring Boot 3"`, `"AWS (EC2, S3)"`, `"postgres"`; o catálogo tem
`Spring Boot`, `AWS`, `PostgreSQL`. Comparar por igualdade perderia os três, e
o upload pareceria não ter feito nada. `casar()` normaliza (minúscula, sem
acento, sem pontuação) e tenta igualdade antes de conter.

Dois achados do teste:

- **`C#` não casava consigo mesmo.** Tirada a pontuação, virava `"c"` — um
  caractere, abaixo do piso de 2 que existe para "Go" não casar dentro de
  "Django". `#` e `+` agora sobrevivem à normalização, porque são nome e não
  pontuação.
- A igualdade-antes-de-conter é o que impede `Java` de arrastar `JavaScript`,
  e `Go` de casar com `MongoDB`.

11 casos de casamento passam, incluindo os falsos positivos acima.

### O rascunho dos filtros subiu para a lista

Era estado interno da `BarraFiltros`. A caixa de upload é irmã dela e precisa
escrever nos dropdowns, então o rascunho passou para a `ListaVagas`. O
comportamento não mudou: continua rascunho, e só "Filter" o promove a busca.

O CV **acrescenta, nunca substitui** — quem já tinha marcado dois filtros à mão
os mantém, e esses não ganham selo.

### Conferido no navegador

Nos dois temas, em `localhost:5173/vagas`, com o bundle servido conferido
(hash `Be2zHDD9` → `DO-ZPWBY`, +4,7 KB): a caixa aparece, o aviso de
privacidade fica **acima** do input (y=295 contra y=388), o upload preenche os
três dropdowns, desmarcar funciona, uma escolha nova da pessoa não leva selo, e
não há erro de console. Com `jobs.leituraCv = false`: a caixa **some** da tela
e o endpoint responde 400.

`scripts/qa-rapido.py`: tudo certo.

### O que continua faltando

- **Chave de IA que funcione.** É o único motivo de o card não poder ser
  fechado com uma leitura real ponta a ponta. As duas cadastradas estão
  mortas por conta/billing.
- A frase-resumo do que a IA entendeu ("entendemos que você é backend pleno,
  ~5 anos") continua fora — o selo por campo resolveu a distinção que o card
  exigia, e a frase é reforço.
- `anos` é lido e devolvido, mas **não vira filtro**: a barra não tem eixo de
  anos de experiência, só de senioridade.


---

# A leitura ligou (25/08/2026)

O backend estava pronto desde 15/08 e **nunca tinha sido exercitado**. A
primeira chamada real devolveu 400, com `401 API key is invalid` no log.

## O extrator passou a escolher a IA, e a cair quando ela recusa

Ele só falava com a Anthropic, mesmo com `temChaveOpenAi: true`. O
[JOB-15](JOB-15-escolha-da-ia.md) já tinha resolvido isso para a busca; o CV
seguia ignorando a escolha do admin.

Agora lê `iaEfetiva` e cai para a outra IA — **e não só por ausência de
chave**: também quando a chave é recusada (401/402/403/429), que era exatamente
o caso aqui. Medido com as chaves reais:

```
ANTHROPIC falhou (chave recusada) — lendo o CV com OPENAI
Falha ao ler CV: 429 You exceeded your current quota
```

Cada passo nomeado no log, e 400 com mensagem mandando preencher à mão.

**Dívida que isto revelou — PAGA em 25/08/2026:** o `BuscaIaService` caía só
por ausência de chave, não por chave recusada. Corrigida pelo
[JOB-33](JOB-33-cadeia-de-ia.md), que substituiu a queda entre dois provedores
por uma cadeia percorrida até um funcionar.

## O prompt pedia que o PII não saísse; agora o servidor garante

Instrução é pedido, não garantia. Simulando um modelo desobediente, PII
escondido *dentro* de `stack` e `cargos` (`"CPF 123.456.789-00"` como se fosse
tecnologia) chegava inteiro à tela — o DTO descartava campos extras, mas não
olhava dentro dos arrays.

Filtro no `limitar()`, com o falso positivo barato e o falso negativo caro:
some um item de uma lista de sugestões, contra CPF gravado no perfil de alguém.

Medido: **39 tecnologias legítimas passam** (`@angular/core`, `C#`,
`Ubuntu 22.04`, `IEEE 802.11`, `SAP S/4HANA`, `AWS EC2 t3.medium`) e **14
formas de PII bloqueadas**. Zero erro dos dois lados.

Duas correções na regra original, ambas de medição:

- `/@/` apagava **pacote npm com escopo** — `@angular/core`, `@nestjs/common`,
  `@types/node`. O comentário afirmava que "nenhuma tecnologia tem arroba", e
  tem. Trocado por um padrão de e-mail que exige o ponto no domínio.
- A regra de telefone exigia dois blocos de 4+ dígitos e deixava passar
  `+1 (415) 555-2671`; **data de nascimento era proibida pela instrução e não
  tinha regra nenhuma atrás**. Ambas cobertas (QA, 25/08).

## O selo, e os quatro defeitos que o QA achou nele

O selo `CV` marca o que veio do currículo — é o que permite desmarcar só o que
a IA errou. Ele apareceu em dois níveis porque a grade de 8 dropdowns não
comporta um selo por campo: no botão fechado e por opção dentro do painel.

**Ele mentia em três situações**, todas medidas pelo QA e corrigidas:

| Situação | Dizia | Diz agora |
| --- | --- | --- |
| Marcar à mão **durante** a leitura | 5 selected (Kotlin apagado) | **6 selected, 5 do CV** |
| "Clear filters" e marcar Java à mão | CV · 1 option from your CV | **1 selected** |
| Desmarcar e remarcar um valor do CV | 5 selected, 5 do CV | **5 selected, 4 do CV** |

O primeiro era o pior: **perda silenciosa de escolha da pessoa**. A
`CaixaUploadCV` captura `onLeu` no clique, então a versão que resolvia segundos
depois carregava o rascunho de antes do upload e o sobrescrevia. O card promete
o contrário — "acrescenta ao que já estava marcado".

A correção não foi o updater funcional: são **dois** estados saindo do mesmo
cálculo, e chamar `setOrigemCv` de dentro de um updater é efeito colateral num
reducer, que o StrictMode roda duas vezes e faz o selo sair dobrado. Um ref
resolve sem nenhum dos dois.

**Decisão de produto, que o QA perguntou:** desmarcar apaga a origem para
sempre. O selo afirma "isto veio do currículo, confira" — depois que a pessoa
desmarcou e marcou de novo, a escolha é dela.

## Mais três, menores

- **O 413 aparecia cru.** Arquivo de 6 MB dava `{"message":"File too large"}` e
  a tela mostrava "Erro 413". O `limits` do multer corta **antes** do serviço,
  então a mensagem em português que o `CvParserService` tem era código morto.
  Um `@Catch(PayloadTooLargeException)` na rota traduz; a mensagem do serviço
  continua lá para quem o chamar direto.
- **O selo quebrava o nome acessível.** O leitor de tela anunciava
  `"JavaCVfrom your CV"` — os nós de texto entram no nome concatenados, sem
  separador. Agora o `aria-label` é montado no input e no botão:
  `"Java, from your CV"` e `"Skills, 5 selected, 5 options from your CV"`.
- **O CV podia fechar a própria tag.** `texto` ia cru para dentro de
  `<curriculo>…</curriculo>`, então um currículo contendo `</curriculo>`
  produzia quatro tags no prompt. Não foi possível demonstrar exploração (as
  chaves estão mortas) e a instrução de sistema continua no lugar, mas fechar
  a tag é barato: o prompt reduz a chance, isto tira o mecanismo.

E `Limpar filtros` virou `Clear filters` — era o único texto em português numa
aba em inglês.

## O que não foi verificado, e não dá para verificar aqui

**Nenhuma leitura real de CV completou.** As duas chaves cadastradas estão
mortas: Anthropic **401 `API key is invalid`**, OpenAI **429 `exceeded your
current quota`**. Todo o caminho de sucesso foi exercitado com um provedor HTTP
falso — o que prova o **encanamento**, não a qualidade da extração do modelo.

Isso é conta a pagar, não defeito. Com uma chave válida, o que falta conferir é
se o modelo lê o CV bem: se acerta senioridade, se não inventa stack, e se
`ehCurriculo: false` dispara num arquivo que não é currículo.

## Redesenho da caixa de upload (25/08/2026)

O designer levantou três direções e o stakeholder escolheu a **C** — faixa de
uma linha, mais o ciclo de vida completo dos quatro estados. O detalhe que
ocupava a tela foi para o tooltip que já existia.

### Os quatro problemas, medidos antes e depois

Medido com Playwright contra o app servido em :5173, viewports 1400×900 e
390×844:

| | antes | depois |
|---|---|---|
| altura da caixa (desktop) | 252px | **102px** |
| altura da caixa (celular) | 461px | **205px** |
| consumido até o 1º filtro (desktop) | 272px | **122px** |
| consumido até o 1º filtro (celular) | 473px | **217px** |
| y do 1º controle de filtro (celular, tela 844px) | 678px | **422px** |
| alvo de toque do upload | **20px** (reprova) | **38px** |

A caixa depois do sucesso colapsa para **54px** — o passo já usado deixa de
ocupar o topo como se fosse permanente.

Os outros dois problemas:

- **O input nativo vazava o idioma do SO** — "Escolher arquivo" em português
  numa aba toda em inglês. Agora quem aparece é um `<button>` de verdade que
  dispara um `<input type="file">` escondido por `sr-only`. O `<label htmlFor>`
  continua apontando para o input, então o campo continua tendo nome.
- **Não existia estado de sucesso.** Depois da leitura a caixa ficava idêntica
  e a pessoa tinha de inferir olhando os dropdowns. Agora nomeia o arquivo e
  conta os filtros: "Read cv.docx — we ticked 7 filters marked CV".

### O aviso perdeu peso de erro, não perdeu a tela

Correção ao diagnóstico inicial: **o contraste estava todo aprovado** (pior
caso 4,91:1). O problema nunca foi cor, era **peso** — o aviso usava linguagem
de erro (`border-l-4`, `⚠`, fundo `--surface-sunken`) para conteúdo
informativo, e pesava mais que o botão que era a ação. Agora é texto de 13px em
`--text-muted`, com o `⚠` em `WARN_INK` e `aria-hidden`.

**O que NÃO foi para o tooltip, e não pode ir:** o fato de que o arquivo é
enviado ao provedor de IA. Continua permanente na tela, sem depender de hover
nem de clique — é critério de aceite deste card, e um tooltip esconderia
justamente a informação que decide se a pessoa sobe o arquivo. O que foi para
dentro do `?` é o *detalhe*: o que é guardado, os formatos e o limite.

Verificado nos dois temas: o aviso aparece sem hover e sem clique em ambos.

### Decisão de produto: "Replace file" reabre o estado ocioso

No sucesso o aviso sai — a decisão já foi tomada. Mas **trocar o arquivo é um
novo envio ao provedor**, e o card promete o aviso *antes* de escolher o
arquivo, não apenas antes do primeiro. Então "Replace file" volta ao estado
ocioso com o aviso de volta, em vez de abrir o seletor direto.

Custa um clique a mais a quem troca de arquivo. Paga: o segundo upload também
é um upload. Verificado — depois de "Replace file" a caixa volta a 102px e o
`#cv-privacidade` reaparece.

### O erro passou a dizer a garantia que o código já dava

O `catch` nunca chamou `onLeu`, então uma leitura que falha nunca mexeu nos
filtros. Isso estava no código e não aparecia na tela. Agora o erro diz
**"Nothing was changed in your filters"** junto da mensagem do servidor, com
`role="alert"`, borda em `WARN_INK` na faixa e `aria-invalid` no controle.

### `Hint` subiu de `components/invoice/` para `components/`

Nada nele era do invoice, e a caixa de CV precisava do mesmo tooltip. Copiar
seria a mesma acessibilidade escrita duas vezes e corrigida uma só. O único uso
existente (`InvoicePage.tsx`) foi atualizado na mesma leva — conferido depois
no navegador: os 4 tooltips do invoice continuam abrindo, sem erro de console.

Ganhou uma prop opcional `label`, porque o `aria-label` padrão
(`What is {title}?`) sai torto quando o título é frase em vez de substantivo.

### Um defeito encontrado durante a verificação, e corrigido

Esconder o input com `sr-only` **o deixou na ordem de Tab**. O teclado parava
duas vezes para um controle só: primeiro no input invisível, que não mostra
foco nenhum e parecia foco perdido no nada, depois no botão. Corrigido com
`tabIndex={-1}` no input — e o `aria-describedby` migrou para o botão, que é
quem recebe o foco agora. Sem essa migração o aviso de privacidade deixaria de
ser anunciado a quem chega pelo teclado, que é exatamente o "antes do upload"
de quem não enxerga a tela.

Ordem de Tab conferida depois da correção: `Upload résumé` → `?` → dropdowns.
Ambos com outline de foco de 2px. O `?` alcança 24×24, abre no foco e fecha no
Escape.

### Como o caminho de sucesso foi exercitado

As chaves continuam mortas (Anthropic 401, OpenAI 429). Subi um provedor HTTP
falso no host respondendo no formato de `messages.create` e apontei
`ANTHROPIC_BASE_URL` para ele por um override de compose **fora do repo** — o
SDK lê essa variável sozinho, então não foi preciso tocar em código. Andaime
desmontado no fim: processo morto, porta 8791 fechada, `ANTHROPIC_BASE_URL`
ausente do container, API de volta ao healthy.

Continua valendo o que já estava escrito acima: isso prova o **encanamento**,
não a qualidade da extração do modelo.

## Fica de fora, deliberadamente

- **`anos` é lido e devolvido mas não vira filtro** — a barra não tem eixo de
  anos, só de senioridade. O dado está no `cvProfile` para quando houver.
- **A frase-resumo** ("entendemos que você é backend pleno") continua fora: o
  selo por campo resolve a distinção que o card exigia, e com mais precisão.


---

# A caixa foi redesenhada (25/08/2026)

O stakeholder olhou a caixa e pediu o designer. Ele mediu, contestou parte do
diagnóstico e propôs três direções; a escolhida foi a **C**, com o detalhe indo
para o tooltip que já existia.

## O que estava errado, medido

| | antes | agora |
| --- | ---: | ---: |
| 1º filtro (desktop) | y=468 | **y=319** |
| **1º filtro (celular, tela 844px)** | **y=678** | **y=422** |
| alvo do botão de upload | **20px** (reprova) | **38px** |
| depois de usada | 252px, para sempre | **encolhe 48px** |

**O caso pior era o celular, e ninguém tinha medido.** A caixa tinha 461px e
empurrava o primeiro filtro para fora da dobra: a pessoa abria a busca de vagas
e via uma tela inteira de currículo opcional, sem um filtro sequer.

O designer também corrigiu o diagnóstico do stakeholder num ponto: **o
contraste estava todo aprovado** (pior caso 4,91:1). O problema do aviso não era
cor, era **peso** — ele usava linguagem de erro (barra grossa, `WARN_INK`, fundo
rebaixado) para conteúdo informativo, e pesava mais que a própria ação.

## O que mudou

- O `<input type="file">` nativo virou **`<button>` de verdade** disparando um
  input `sr-only`. Mata de uma vez o alvo de 20px e o rótulo do SO — que
  aparecia "Escolher arquivo", em português, numa aba em inglês.
- O aviso perdeu o peso de erro e virou nota com o `⚠`.
- **O detalhe foi para o `Hint`**, o tooltip que já existia no invoice —
  promovido para `components/`. O que fica na tela, sem hover e sem clique, é
  "your file is sent to the AI provider to be read": o critério do JOB-02 é que
  a pessoa saiba disso **antes** de escolher o arquivo, e um tooltip não cumpre
  isso.
- **Estado de sucesso**, que não existia: a caixa colapsa e diz o que fez.
- **"Replace file" volta ao ocioso com o aviso de volta.** Trocar de arquivo é
  um novo envio ao provedor, e o card diz "antes do upload" — o segundo upload
  também é um upload.

## Os quatro defeitos do QA (25/08), corrigidos

**[GRAVE] O acúmulo entre currículos.** Subir um segundo CV, de outra pessoa,
dizia "we ticked 8 filters" nomeando só o arquivo novo — os 4 valores do
primeiro continuavam marcados e iam para a busca. **A busca saía com o stack de
dois currículos misturados.**

A correção não foi mudar a frase: **"Replace file" promete substituir**, e
acumular em silêncio faz o botão mentir sobre o que faz. Agora ele esquece a
origem anterior. O acúmulo continua valendo para quem sobe um segundo currículo
sem passar por ali — são gestos diferentes. Medido: selos 8 → 0 no Replace, e o
segundo CV dá 4.

**"we ticked 0 filters. Uncheck anything we got wrong."** — tique verde e
instrução para desmarcar o que não existe. Acontecia com um CV cujo stack não
casa com o catálogo, ou depois de a pessoa desmarcar tudo. Ler o arquivo e não
marcar nada são coisas diferentes de ler e marcar; agora a tela diz *"but
nothing in it matched our filters. Pick them by hand below."*, sem o ✓.

**O tooltip precisava de dois toques no celular.** O gesto dispara `focus` (que
abre) e `click` (que alternava para fechado) — o painel abria e fechava dentro
do mesmo toque. Pré-existente, mas o redesenho pôs um tooltip no aviso de
privacidade, onde o toque é o gesto principal. O clique deixou de alternar:
fechar tem Escape, toque fora e `blur`.

**`aria-label` torto em 2 dos 4 tooltips do invoice** — "What is Invoice
details?". A prop `label` existia justamente para isso e não tinha sido usada.

## Fica registrado, não corrigido

**As mensagens de erro do backend vêm em português** dentro da caixa em inglês:
"Formato nao suportado. Envie o curriculo em PDF ou DOCX." O CLAUDE.md manda
erro em português sem acento, então isto é dívida conhecida, não descuido — e
resolver exige decidir onde mora a tradução (código de erro no backend, ou mapa
no front). O QA classificou como médio, e maior que o do `/email/sair`: aqui é o
passo principal da feature, e sem acento parece texto quebrado, não outro idioma.
