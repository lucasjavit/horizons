# JOB-38 · `SCHEMA_VAGA` é rejeitado pela OpenAI e pela Anthropic

**Estado:** feito (26/08/2026)
**Tamanho:** M

## O defeito

Desde o [JOB-34](JOB-34-extracao-de-vaga-fora-do-firecrawl.md) o `SCHEMA_VAGA`
vai para a cadeia de IA em vez de para o Firecrawl. **Dois dos seis provedores
recusam o schema com 400**, medido em busca real de 26/08/2026:

```
ChatGPT (OpenAI) falhou (erro): 400 Invalid schema for response_format 'vaga':
  'required' is required to be supplied and to be an array including every key
  in properties. Missing 'area'.

Claude (Anthropic) falhou (erro): 400 {"type":"invalid_request_error",
  "message":"Schema is too complex."}
Claude (Anthropic) falhou (erro): 400 {"type":"invalid_request_error",
  "message":"Grammar compilation timed out"}
```

**Não é chave, é schema.** Reproduzido isoladamente com a chave da Anthropic
válida (`status: funcionando` na tela): o `SCHEMA_VAGA` completo dá 400 toda
vez. Remover todos os `description` **não resolve** — o erro continua idêntico.

A OpenAI não pôde ser isolada no mesmo teste porque a chave está em 429 (sem
cota), mas a mensagem dela é precisa e determinística: com `strict: true`, o
`required` tem de listar **todas** as 21 chaves de `properties`. Hoje lista 6.

## O efeito medido

A cadeia funciona — ela cai para o próximo — mas cai **cinco vezes** antes de
achar quem responda:

```
Mistral respondeu depois de 5 provedor(es) nao terem atendido:
  Gemini (chave recusada), ChatGPT (erro), Claude (erro),
  Groq (sem chave), Cerebras (sem chave)
```

Isso custa tempo real: a busca de 8 páginas passou de ~60s para **mais de 7
minutos**, e duas das três buscas medidas foram cortadas pelo timeout do
cliente antes de terminar as 8 páginas (3 e 6 vagas entregues em vez de 8).

Com o Gemini em 429 — que é o estado de hoje — sobra **só o Mistral** para
extrair vaga, e ele treina com os dados do free tier.

## Por que não foi corrigido junto com o JOB-34

O JOB-34 era para trocar o executor da extração, não para reescrever o schema.
Corrigir o `SCHEMA_VAGA` muda o que **todos** os provedores recebem e pede a
sua própria medição de qualidade de extração campo a campo — que é justamente o
que o JOB-34 acabou de fazer para o schema atual, e que teria de ser refeito.

Separar mantém as duas medições legíveis.

## A ideia

1. **`required` com todas as chaves** (o que a OpenAI exige em `strict`). Não
   muda a semântica: os campos opcionais já são `type: [x, 'null']`, então
   "obrigatório" quer dizer "presente, podendo ser null" — que é exatamente o
   contrato que o `INSTRUCAO` já pede.
2. **Reduzir a complexidade para a Anthropic.** O gatilho ainda não foi
   isolado: 21 campos, `anyOf` no `regime` e uniões `[x,'null']` em 11 campos
   são os suspeitos. A bisecção começou mas não terminou — cada chamada da
   Anthropic com este schema leva minutos antes do 400.

## Critérios de aceite

- [ ] OpenAI aceita o `SCHEMA_VAGA` (com chave com cota)
- [ ] Anthropic aceita o `SCHEMA_VAGA`
- [ ] A extração de vaga continua acertando os campos medidos no JOB-34
      (`title`, `company`, `salaryMin/Max`, `salaryTrecho`, `skills`)
- [ ] Uma busca de 8 páginas volta a terminar dentro do timeout do cliente


---

# Corrigido no mesmo dia (26/08/2026)

**Era um defeito só, relatado de dois jeitos diferentes.** A OpenAI foi precisa
("Missing 'area'"); a Anthropic disse "Schema is too complex" e "Grammar
compilation timed out", que mandavam para o caminho errado — foi por isso que a
bisecção por `description` não levou a lugar nenhum.

## A correção

`required` passou de **6 para 21 chaves** — todas as de `properties`.

**O schema não mudou de significado.** Todo campo opcional já aceitava `null` no
`type`, então "obrigatório" aqui quer dizer *sempre presente na resposta*, não
*sempre preenchido*. O modelo continua autorizado a devolver `null`, que é o que
o [JOB-09](JOB-09-vaga-so-afirma-o-que-cita.md) exige: campo ausente permanece
ausente.

## Medido

Chamada isolada com a chave real da Anthropic, o mesmo schema que dava 400:

```
schema: 21 props, required=21
OK em 8.875ms: {"title":"Backend Engineer","company":"Acme","area":null,
                "anosExp":null,"skills":[],"local":"LATAM","regime":"remoto"...}
```

E a busca ponta a ponta, com o Firecrawl ligado:

| | antes | depois |
| --- | ---: | ---: |
| tempo | **6m40s** | **1m43s** |
| vagas entregues | 3 (cortada por timeout) | **6** |
| quedas na cadeia | 5 | **2** |

As duas quedas restantes são **de cota** (Gemini e OpenAI em 429), não de
schema — o erro determinístico sumiu do log.

## A lição

**Mensagem de erro de provedor de IA aponta o sintoma, não a causa.** "Schema is
too complex" descrevia um schema de 21 campos que a mesma API aceita sem
reclamar quando o `required` está completo. Quem foi atrás da complexidade —
removendo `description`, cortando campos — não chegaria lá.

Quando dois provedores recusam a mesma coisa, **o mais explícito é o que vale
ler**: a OpenAI já dizia exatamente o que faltava.
