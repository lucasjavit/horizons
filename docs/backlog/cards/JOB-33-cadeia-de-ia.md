# JOB-33 · Cadeia de provedores de IA, com fallback gratuito

**Estado:** feito (25/08/2026) — chave real verificada pelo JOB-36 (ver *Atualização*)
**Tamanho:** M

## Por quê

**As duas chaves cadastradas estão mortas.** Medido em 25/08/2026:

| Provedor | Resposta |
| --- | --- |
| Anthropic | **401** `API key is invalid` no início do dia; **400** (schema rejeitado) depois que a chave foi trocada — ver [JOB-35](JOB-35-schema-do-cv-rejeitado-pela-anthropic.md) |
| OpenAI | **429** `You exceeded your current quota` |

Com isso, a leitura de currículo e a busca por IA **não funcionavam nesta
instalação**. Não é bug: é conta a pagar. Mas um produto que para de existir
quando um cartão vence tem um problema de desenho, e não de crédito.

Quatro provedores têm free tier **sem cartão**. Um deles rodando faz a feature
existir de novo.

## O que mudou no desenho

Antes havia uma função escrita para **exatamente dois** provedores:

```ts
escolherIa(preferida, temAnthropic, temOpenAi)   // recursos.service.ts
qual === 'openai' ? this.comOpenAi(…) : this.comAnthropic(…)   // busca-ia.service.ts:72
```

Cada provedor novo dobrava os ramos. Agora há **um registro percorrido até um
funcionar** (`backend/src/ia/provedores.ts` + `ia.service.ts`).

### Cadeia por CAPACIDADE, e não uma lista só

Os dois usos exigem coisas diferentes, e essa diferença é o que decide quem
entra em qual cadeia:

| Uso | Exige | Provedores |
| --- | --- | ---: |
| Busca de vagas | `web_search` **+** schema | **3** |
| Leitura de CV | só schema | **6** |

**Groq, Cerebras e Mistral não têm busca na web.** Eles ficam fora da cadeia de
busca — e isso não é detalhe de eficiência. Um modelo sem busca **não falha** ao
receber um pedido de vagas: ele responde, inventando URLs bem formadas que dão
404. Medido em 18/08/2026 e registrado no JOB-13: perguntado sem acesso à web, o
modelo acertou as cinco empresas e não soube UMA vaga.

Filtrar por capacidade é o que impede que "funcionar" seja pior que falhar.

## Os provedores

| Provedor | Dialeto | Busca web | Free sem cartão | Treina com os dados |
| --- | --- | :---: | :---: | :---: |
| Claude (Anthropic) | `anthropic` | sim | não | não |
| ChatGPT (OpenAI) | `openai-responses` | sim | não | não |
| Gemini (Google) | `gemini` | **sim** | sim | **SIM** |
| Groq (Llama 3.3) | `openai-compativel` | não | sim | não |
| Cerebras | `openai-compativel` | não | sim | não |
| Mistral | `openai-compativel` | não | sim | **SIM** |

**Um adaptador cobre três provedores.** Groq, Cerebras e Mistral expõem
`/chat/completions` com o corpo da OpenAI, então o `openai-compativel` é
parametrizado por `baseURL` + modelo e atende os três. Foi o que permitiu os
três entrarem na mesma leva, e é o que faz o próximo compatível (OpenRouter,
Cloudflare Workers AI, GitHub Models, SambaNova, Vercel AI Gateway) custar
**uma entrada no registro e nada mais**.

O Gemini entra por `fetch`, e não por SDK: o `@google/genai` são ~400 KB para
uma única chamada POST, e o repositório já fala HTTP cru com o Telegram e com
os ATS. Se um dia precisar de streaming ou multimodal, o SDK passa a pagar o
próprio peso.

## ⚠️ Decisão de privacidade: dois provedores treinam com os dados

**Gemini e Mistral usam o free tier para treinar** (Google fora de EU/UK/EEA;
Mistral no Experiment tier). Isso importa muito aqui, e não é genérico:

A leitura de currículo envia o **texto inteiro do CV** para o provedor — com
CPF, endereço e telefone. Está registrado no [JOB-02](JOB-02-perfil-de-busca.md):
o prompt e o schema filtram a **saída**, não a entrada. E a tela promete que "só
guardamos stack, senioridade e anos".

**Guardar pouco não é enviar pouco.**

**Decisão (25/08/2026):** não bloquear o uso — um provedor que treina e funciona
vale mais que nenhum provedor. Mas a tela **diz quais treinam**, em dois lugares:

1. No cartão da chave, **acima do campo** — depois dele a decisão já foi tomada.
2. Ao lado do nome na lista de ordem — quem escolhe a ordem pode nunca ter
   rolado até o cartão.

Contraste medido do aviso: **5,55:1** no claro e **7,54:1** no escuro. Passa AA
nos dois.

## A dívida do JOB-02, corrigida junto

O JOB-02 registrou: *"o `BuscaIaService` tem hoje o mesmo buraco que o CV tinha
— cai só por ausência de chave, não por chave recusada"*.

Corrigido. A queda por chave recusada agora vive no `IaService` e vale para os
dois usos — era pré-requisito da cadeia, não escopo extra: uma cadeia que não
cai quando o provedor recusa não é uma cadeia.

## O que foi medido

Sem chave válida na máquina, os provedores foram substituídos por um servidor
falso que fala os quatro dialetos, apontado pelas `*_BASE_URL` (andaime fora do
repositório, desmontado no fim).

| Cenário | Resultado |
| --- | --- |
| Anthropic **401** → próximo | **200**; log: *"Claude (Anthropic) falhou (chave recusada)"* + *"ChatGPT (OpenAI) respondeu depois de 1 provedor(es)"* |
| Anthropic 401 + OpenAI **429** → Gemini | **200** em **1,05s**; 3 chamadas HTTP |
| **Todos os 6** falham | **400** único e claro; log lista os 6 com o motivo de cada |
| Busca: provedor sem `web_search` | **Groq/Cerebras/Mistral NÃO foram chamados** — só os 3 com busca |
| Busca: os 3 falham | erro único, sem lista vazia mentindo "0 vagas" |
| Preferir Groq (sem busca web) | busca usa Anthropic; **extração vai direto no Groq** (1 chamada) |
| Provedor sem chave | pulado sem erro e sem `warn` — ausência não é falha |
| ATS ligado (não usa IA) | 7 vagas reais do GitLab, **0 chamadas de IA** |

### O achado que a medição produziu: retry interno era desperdício

O SDK da OpenAI repetia o **429 três vezes com backoff** antes de desistir.
Numa cadeia isso é contraproducente — a chave já foi recusada, e o próximo
provedor é uma resposta melhor que a mesma chave de novo.

| | Antes | Depois (`maxRetries: 0`) |
| --- | ---: | ---: |
| Tempo da requisição | 2,50s | **1,05s** (−58%) |
| Chamadas HTTP | 5 | **3** |

Não foi previsto no desenho: apareceu ao contar as chamadas que o servidor
falso recebeu.

## Três distinções que o log preserva

`sem chave` ≠ `chave recusada` ≠ `erro`. Verificado: 401/429 viram *"chave
recusada"*, 500 vira *"erro"*, ausência não gera `warn`. Quando a feature
parar, o log diz **qual** provedor e **por quê** — e o de todos, não só o do
último.

E `ehCurriculo: false` continua **não** gastando a cadeia: o próximo leria o
mesmo texto e diria o mesmo. A regra irmã (recusa do modelo por `refusal` /
`content_filter`) subiu para o `IaService`, porque vale para qualquer uso.

## Configurações: ordem, e não seletor

> **Superado pelo [JOB-36](JOB-36-tela-de-provedores-de-ia.md) (25/08/2026):**
> o radio virou setas ↑↓ e a ordem INTEIRA passa a ser gravada
> (`ProviderOrder`), no lugar da preferência única. O argumento abaixo — "a
> ordem dos demais quase nunca importa" — não sobrevive a seis provedores:
> quando o topo cai, quem atende é o segundo, e não "algum outro".

O que era "IA da busca" (escolha entre dois) virou **quem vai primeiro na
cadeia**. Um radio, e não arrastar-e-soltar: a ordem dos demais quase nunca
importa — o que importa é quem tenta primeiro. Um formulário de reordenação
custaria arrastar, teclado alternativo, persistir uma lista e explicá-la, para
resolver um caso que ninguém pediu.

Escolher um provedor **sem chave** continua legítimo (é preferência, não
exigência). Escolher um **sem busca web** também: ele lidera a extração, e a
busca usa o primeiro que sabe procurar — a tela explica a divergência em vez de
silenciosamente usar outro.

## Avaliado e NÃO implementado: separar scrape de extração no `lerVaga`

O `busca.service.ts:256` usa `fc.scrape(url, { formats: [{ type: 'json', … }] })`
— o Firecrawl roda a IA com o **nosso** prompt e o **nosso** schema, a 5
créditos por página. É a capacidade "schema, sem web search", que os 6
provedores atendem.

**Tecnicamente é separável.** Confirmado no SDK (`firecrawl@4.32.2`):
`formats: ['markdown']` é válido e `Document.markdown` existe. O desenho caberia
sem esforço — o `IaService` já aceita exatamente esse pedido.

**Não foi implementado, e a razão é honesta: não deu para medir o que importa.**
Duas perguntas decidem, e nenhuma se responde lendo código:

1. O markdown com `onlyMainContent` preserva o suficiente para o schema? O
   `salaryTrecho` exige **texto exato da página** — se o markdown perder a
   tabela de salário, o JOB-09 quebra em silêncio: a vaga aparece sem salário e
   ninguém percebe.
2. Quanto o `markdown` custa de fato contra o `json`? "Mais barato" é a
   suposição do pedido, não um número que eu tenha.

Medir exigiria gastar créditos reais do Firecrawl com a chave cadastrada. Não
fiz por conta própria — a tentativa de extrair a chave cifrada do banco foi
bloqueada, e **corretamente**: descriptografar segredo para um teste não é uma
decisão de quem implementa.

**Fica como card separado**, com o que já está resolvido: o desenho cabe, o SDK
suporta, e o que falta é uma medição de 2 páginas comparando os dois formatos —
salário, elegibilidade e trecho citado, lado a lado. **Se o markdown degradar o
`salaryTrecho`, não vale**: um caminho que não funciona é pior que o custo
atual.

## Um bug que a cadeia expôs no primeiro uso real

Com as chaves reais, o log mostrou algo que o provedor falso escondia: a
Anthropic **não está mais 401** — ela devolve **400**, rejeitando o schema do
extrator (`enum` com `null` sob `type: ['string','null']`).

Está aberto como [JOB-35](JOB-35-schema-do-cv-rejeitado-pela-anthropic.md).
Verificado contra `git show HEAD`: o schema é byte a byte o mesmo de antes —
**não foi introduzido aqui**. O que mudou foi o log passar a distinguir `chave
recusada` de `erro`, e o caso deixar de se parecer com mais um 401.

É o argumento da cadeia em uma frase: um erro que sempre falha do mesmo jeito
para de ser lido.

## Critérios de aceite

- [x] Provedor novo entra por **uma entrada no registro**, não editando seis arquivos
- [x] Cadeia filtrada por capacidade — sem `web_search` não é tentado na busca
- [x] Erro de um provedor não mata a cadeia; só todos falharem vira erro do usuário
- [x] Log distingue `sem chave` / `chave recusada` / `erro`, e nomeia quem falhou
- [x] `ehCurriculo: false` não gasta a cadeia
- [x] Tela diz quais provedores treinam com os dados, ao lado do nome
- [x] Interruptores e escolha continuam funcionando; ATS, busca e CV sem regressão
- [x] Migration do enum (`migrate deploy`), não `db push`
- [x] Uma chave real de provedor gratuito cadastrada — **feito** (25/08): chave do Gemini cadastrada e verificada `funcionando` pelo JOB-36

## Atualização (25/08/2026, pelo JOB-36)

O que este card deixou em aberto foi resolvido pela verificação de chaves do
[JOB-36](JOB-36-tela-de-provedores-de-ia.md), e ela contradisse duas coisas
escritas aqui:

- **A Anthropic não está mais 401 nem 400.** A chave foi trocada às 18:25 de
  25/08 e responde **200**. O que este card registra como "chave morta" valia
  para a chave anterior.
- **O Gemini nunca teve chance de funcionar**: `gemini-2.5-flash` está
  aposentado para contas novas e devolvia **404** com a própria API indicando
  `gemini-3.6-flash`. Corrigido no registro. A cadeia escondia isso como
  "erro" genérico — que é exatamente o argumento deste card, aplicado a ele
  mesmo.

Estado real das chaves em 25/08 21:00: Anthropic **funcionando**, Gemini
**funcionando**, OpenAI **429**, os outros três sem chave.

## O que ficava por fazer (resolvido acima)

**Nenhuma chave real foi testada.** Toda a verificação usou provedores falsos, e
isso prova o **fluxo da cadeia**, não a **compatibilidade dos schemas**. O que
pode divergir na primeira chave de verdade:

- Modelos servidos por Groq/Cerebras costumam aceitar `json_schema` com menos
  rigor que a OpenAI. Se um recusar `["string","null"]`, a queda para o próximo
  cobre — mas o log vai acusar `erro`, e o provedor será inútil na prática.
- O Gemini **não permite** `google_search` junto com `responseMimeType: json`.
  Contornado mandando o schema na instrução e limpando cerca de markdown. Isso é
  mais frágil que schema obrigatório, e só uma chave real diz quanto.

Os nove provedores que o stakeholder listou e não marcou (OpenRouter, Cloudflare
Workers AI, GitHub Models, Cohere, HuggingFace, NVIDIA NIM, Chutes, SambaNova,
Vercel AI Gateway) **não** entraram. Vários são compatíveis com a OpenAI e
custariam uma entrada no registro cada.
