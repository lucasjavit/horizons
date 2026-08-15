# JOB-02 · Perfil de busca e agrupamento

**Estado:** backlog
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

- [ ] Subir CV preenche os campos, editáveis, antes de salvar — depende da
      tela (em andamento) e de uma chave de IA no servidor
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

**Falta**, e depende da chave de IA: o upload está desenhado e com o aviso de
privacidade no lugar, mas o input fica **desabilitado** — a extração não foi
ligada. O selo "do currículo" está escrito e conectado, mas nenhum fluxo o
aciona hoje, então o render final com dado real não foi visto. Falta também a
frase-resumo do que a IA entendeu, que o desenho previa.
