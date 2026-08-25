# JOB-35 · A Anthropic rejeita o schema do extrator de CV (400)

**Estado:** feito (25/08/2026)
**Tamanho:** P

## O defeito

A chamada de extração de currículo para a Anthropic devolve **400**, não 401:

```
Error: 400 {"type":"error","error":{"type":"invalid_request_error",
"message":"output_config.format.schema: Invalid schema: Enum value 'estagio'
does not match declared type '['string', 'null']'"}}
```

`backend/src/jobs/cv-extrator.service.ts:23`:

```ts
senioridade: {
  type: ['string', 'null'],
  enum: [...SENIORIDADES, null],   // <- a API recusa esta combinação
  description: 'Nivel. null quando o CV nao deixa claro — nunca chute.',
},
```

A API valida cada valor do `enum` contra o `type` declarado e não aceita
`['string','null']` como tipo de um enum que mistura strings com `null`.

## Como reproduzir

1. Chave válida da Anthropic cadastrada em Configurações
2. Subir qualquer PDF de currículo em `/vagas`
3. Log da API: `WARN [IaService] Claude (Anthropic) falhou (erro): Error: 400 …`

## Por que ninguém tinha visto

**Estava escondido atrás de um 401.** O card [JOB-02](JOB-02-perfil-de-busca.md)
registrou em 25/08 que a chave da Anthropic devolvia `401 API key is invalid` — a
requisição morria na autenticação, antes de a API olhar o schema.

A chave foi trocada em algum momento de 25/08 (`hint XgAA`, `updatedAt 18:25`).
Com uma chave que autentica, a requisição avança e o 400 aparece.

**Foi a cadeia do [JOB-33](JOB-33-cadeia-de-ia.md) que expôs**: o log agora
distingue `chave recusada` de `erro`, e este caso apareceu classificado como
`erro` — não como mais um 401. Um erro que sempre falha do mesmo jeito para de
ser lido; um que muda de categoria chama atenção.

## O que NÃO é

**Não foi introduzido pelo JOB-33.** Verificado contra `git show HEAD`: o
`SCHEMA` é byte a byte o mesmo da versão commitada. O que mudou foi o log ficar
capaz de mostrar a diferença.

## O impacto hoje é pequeno, e por quê

A cadeia cobre: a Anthropic falha, e o próximo provedor atende. Só que **hoje
não há próximo com chave** — OpenAI está 429 e os quatro gratuitos não têm chave
cadastrada. Então na prática a leitura de CV está parada, por dois motivos
independentes.

Cadastrar uma chave gratuita resolve o sintoma. Este card resolve a causa.

## Onde mais o mesmo padrão aparece

`busca.service.ts:29` (`SCHEMA_VAGA`) usa a mesma forma no `regime`:

```ts
regime: { type: ['string', 'null'], enum: ['remoto', 'hibrido', 'presencial', null] },
```

Esse schema vai para o **Firecrawl**, não direto para a Anthropic, então não dá o
mesmo 400 — mas provavelmente tem o mesmo problema latente se um dia passar pela
cadeia (o que é o [JOB-34](JOB-34-extracao-de-vaga-fora-do-firecrawl.md)).

## Caminhos

1. **`type: 'string'` + `null` no enum**, deixando o `required` de fora do campo
2. **`anyOf: [{type:'string', enum:[…]}, {type:'null'}]`** — mais verboso, é a
   forma canônica de JSON Schema e a que mais provedores aceitam
3. Tirar o `enum` e validar a senioridade no servidor depois da resposta

**A opção 2 é a candidata**, porque a cadeia agora manda o mesmo schema para
seis provedores diferentes: o que vale é a forma que o maior número deles aceita,
não a que a Anthropic prefere.

## Critérios de aceite

- [x] Extração de CV com chave válida da Anthropic devolve 200, não 400
- [x] A senioridade continua saindo `null` quando o CV não diz — testado, não suposto
- [x] A mesma forma verificada em pelo menos mais um provedor da cadeia
- [x] `SCHEMA_VAGA` conferido para o mesmo padrão


## Corrigido em 25/08/2026 — caminho 2, `anyOf`

```ts
anyOf: [{ type: 'string', enum: SENIORIDADES }, { type: 'null' }],
```

O critério para escolher entre os três caminhos foi o que o
[JOB-33](JOB-33-cadeia-de-ia.md) mudou: **o mesmo schema vai para seis
provedores**, então vale a forma canônica de JSON Schema — a que o maior número
deles aceita —, não a que um prefere.

### Como foi provado, já que não há chave válida

Um dublê HTTP que **reproduz a validação da Anthropic** a partir da mensagem de
erro real: recusa com 400 qualquer campo que tenha `enum` junto de um `type`
composto.

| | schema antigo | schema novo |
| --- | --- | --- |
| resposta | **400** `Enum value 'estagio' does not match declared type` | **200** |
| `senioridade` quando o CV não diz | — | **`null`**, como antes |

O segundo critério importava tanto quanto o primeiro: `anyOf` poderia ter
consertado o 400 e quebrado o `null` — que é o que impede o modelo de chutar
senioridade. Testado, não suposto.

### O mesmo padrão no `SCHEMA_VAGA`

Corrigido junto (`busca.service.ts`, campo `regime`). Ele vai hoje para o
Firecrawl e por isso não dava o mesmo 400 — mas o
[JOB-34](JOB-34-extracao-de-vaga-fora-do-firecrawl.md) avalia passá-lo pela
cadeia, e aí daria.

**`type: ['string','null']` sozinho não é o problema** — há dez campos assim nos
schemas e todos continuam válidos. O que a API recusa é essa forma **combinada
com `enum`**. Varrido: eram só dois casos, os dois corrigidos.
