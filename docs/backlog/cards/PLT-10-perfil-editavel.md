# PLT-10 · O perfil recebe os dados da pessoa, quando ela quiser

**Estado:** feito (31/08/2026)
**Tamanho:** M

## A decisão

Os dados que o [PLT-09](PLT-09-cadastro-em-dois-tempos.md) reservou para o
momento da contratação ganham **um segundo caminho: o perfil, opcional e a
qualquer hora**.

> "A pessoa vai poder colocar os seus dados se quiser, se for em perfil, ou
> quando quiser fazer a compra." — stakeholder, 30/08

São **os mesmos campos e a mesma tabela**, preenchidos por dois gestos
diferentes:

| Caminho | Quando | Obrigatório? |
| --- | --- | --- |
| **Perfil** | a hora que a pessoa quiser | não |
| **Compra** | ao contratar | sim, e a tela diz por quê |

**Isto é este card; a compra é card próprio** e vem depois — mas o desenho
aqui já precisa servir aos dois, senão o fluxo de pagamento reescreve tudo.

## O que a pessoa pode preencher

- **Nacionalidade** — onde mora. É o dado que mais muda o produto: decide quais
  vagas aceitam quem está ali.
- **Telefone** — com DDI.
- **Documento** — CPF, DNI, CUIT, conforme o país. **Cifrado**, com salt
  próprio, como o PLT-09 registra.

Nenhum é obrigatório neste card. **Um perfil vazio é um perfil válido.**

## Por que opcional é a escolha certa aqui

O produto já deixa **ler as trilhas sem login**. Um formulário obrigatório
depois do login inverteria isso, e não há nada em troca hoje: sem pagamento, o
documento não serve para nada — e guardar dado que não se usa é só risco.

**Opcional também revela o que interessa sem custo:** quem preenche
nacionalidade por vontade própria diz de onde vem seu público, e isso alimenta
a decisão de quais mercados priorizar — que era o que o IP tentaria responder,
e o PLT-09 descartou.

## O que precisa estar certo desde já, para a compra reaproveitar

**1. Os campos vivem no `User`, não numa tabela de checkout.** Se a compra
criasse os próprios, a pessoa preencheria duas vezes e os dois divergiriam.

**2. O documento é cifrado na gravação, e o valor NUNCA volta para a tela.**
Nem parcialmente. Ao reabrir o perfil, o campo mostra *"Saved"* ou os últimos
dígitos — o padrão da casa para tokens (PLT-01) —, e regravar substitui.

**3. A validação é por país.** CPF tem 11 dígitos e dígito verificador; DNI e
CUIT têm outras regras. Validar só "não vazio" aceita lixo que depois
inviabiliza a nota fiscal.

⚠️ **E o formato do documento muda com a nacionalidade** — então os dois campos
conversam: escolher o país decide qual máscara e qual validação valem.

**4. O que já foi preenchido no perfil não é pedido de novo na compra.** É a
razão de os dois caminhos compartilharem a tabela; a tela de pagamento pede só
o que falta.

## Onde isso vive

`frontend/src/pages/PerfilPage.tsx` existe e é **só leitura** hoje — foto, nome,
e-mail e papel, todos vindos do Google. A página diz isso explicitamente:

> Your name and photo come from your Google account.

Este card acrescenta uma segunda seção, **editável**, com o que é nosso. A
distinção precisa ficar visível: o que vem do Google não se edita aqui, e o que
é nosso sim.

## Critérios de aceite

- [x] Perfil vazio é válido — nada bloqueia quem não quer preencher
- [x] Nacionalidade, telefone e documento podem ser salvos e alterados
- [x] O documento é cifrado com salt próprio, e o valor não volta para a tela
- [x] A validação do documento respeita o país escolhido
- [x] Mudar de país revalida o documento em vez de aceitar o antigo em silêncio
- [x] A tela distingue o que vem do Google do que é editável
- [x] Erro por borda + `aria-invalid` + texto, nunca só cor
- [x] Salvar tem retorno visível, e falha de rede não perde o que foi digitado

## O que fica para o card da compra

- O gatilho: pedir os mesmos campos **antes de cobrar**, com a justificativa
  ("necessário para emitir a nota") na tela
- Tornar obrigatório ali, e só ali
- Não repetir o que já está preenchido

## Depende de

- [PLT-09](PLT-09-cadastro-em-dois-tempos.md) — a decisão de quais dados e por
  quê. Este card é o primeiro dos dois caminhos que aquele desenhou.


---

## Como ficou (31/08/2026)

### O escopo de países: 6 validados, 22 na lista, ninguém sem caminho

Validar documento de 190 países é escopo infinito, e **cada dígito verificador
errado recusa gente de verdade**. A decisão:

| Caminho | Países | Regra |
| --- | --- | --- |
| **Validação real** | BR, MX, AR, CO, CL, PE | dígito verificador (BR, AR, CL), data real (MX), comprimento (CO, PE) |
| **Genérico** | os outros 16 da lista, e `OTHER` | 4–32 alfanuméricos com separadores |

Os seis são os de JOB-19 (Brasil, México, Colômbia e Argentina são os maiores)
mais Chile e Peru, que têm regra pública e estável. **`OTHER` fecha a lista**:
quem está na Índia ou nas Filipinas escolhe o país (ou `Other`), e o campo
aceita o documento de lá pelo caminho genérico.

O genérico é **frouxo de propósito**. Recusar um documento válido de um país
que não modelamos é pior que aceitar um inválido: o documento não paga nada
hoje, e no dia em que pagar, a nota fiscal daquele país terá regra própria.

### O salt: a função foi generalizada, e não duplicada

`crypto.ts` agora recebe o salt como **parâmetro obrigatório**, e exporta
`SALT_TOKENS` e `SALT_DOCUMENTOS`. Duplicar o arquivo criaria duas cópias do
mesmo AES-GCM que divergem com o tempo, e um conserto de segurança teria de ser
aplicado duas vezes. Obrigatório sem *default* para que quem acrescentar um dado
cifrado novo **decida** a qual domínio ele pertence, em vez de cair no dos
tokens por omissão.

**Medido:** cifrar com `SALT_DOCUMENTOS` e tentar decifrar com `SALT_TOKENS`
lança `Unsupported state or unable to authenticate data`. Os 5 tokens de IA já
cadastrados continuaram legíveis depois da mudança, e gravar um novo fez o
*roundtrip* normalmente.

### Três bugs que só apareceram porque foram medidos

Escritos, os validadores *pareciam* certos. Rodados contra 46 casos, três não
eram:

1. **`digitos()` apagava as letras em vez de reprovar.** Um
   `replace(/\D/g, '')` cru transformava `"CPF 123.456.789-09"` em `12345678909`
   e `"AB12345678"` num DNI peruano de 8 dígitos. Consertado na raiz: qualquer
   caractere que não seja dígito ou separador invalida o valor inteiro.
2. **O RFC mexicano aceitava 31 de fevereiro.** O dia era conferido contra o
   teto 31, e não contra o mês. `VECJ880231XXX` passava.
3. **A cédula colombiana aceitava letras**, pela mesma via do item 1.

E um quarto, achado na verificação da tela: **o `placeholder` do Brasil era um
CPF válido de verdade** (`123.456.789-09`), o que fez a checagem de vazamento no
DOM acusar falso positivo. Trocado por `000.000.000-00` — um exemplo que passa
na validação parece um valor já preenchido.

### O que foi verificado, e como

**Validadores (46 casos, 46 passando)** — incluindo os que passam na fórmula e
não são documento: CPF `111.111.111-11`, CUIT com prefixo inválido, RFC em
29/02 de ano não bissexto, RUT com DV `K`.

**API (10 casos)** — perfil vazio salva 200; campo desconhecido rejeita com
`property hacker should not exist`; documento sem país recusa antes de validar.

**O documento não volta, provado em três camadas:**
- no banco: `documentEnc` é `L7NhOljK3qDL-638:8Mz0U2oD0-D5m8DO0JU3mg:...`, e
  `SELECT count(*) WHERE documentEnc LIKE '%12345678909%'` devolveu **0**
- na resposta da API: `{"country":"BR","documentHint":"8909",...}` — não há
  campo `document`
- no DOM: o CPF salvo não aparece em lugar nenhum; só `ends in 4725`

**Trocar de país revalida** — salvo um CPF válido para o Brasil, trocar para
Argentina apagou `documentEnc` e `documentHint` **no banco** (`<NULL>|<NULL>`),
e a tela passou a dizer *"You changed country, so your saved document no longer
applies"*. Mandar o mesmo CPF para a Argentina responde
`That is not a valid CUIT/CUIL for Argentina`.

**Falha de rede não perde o que foi digitado** — abortando `PUT /api/perfil` no
meio do salvamento, o alerta aparece e os dois campos preenchidos continuam
preenchidos; clicar Save de novo com a rede de volta salva.

**Navegador (27 checagens, todas passando)** — Tab alcança os três campos e o
botão; botão de 36px de altura; sem rolagem horizontal em 390px
(`scrollWidth=390`); temas claro e escuro; nenhum erro de console além dos dois
provocados de propósito pelo próprio roteiro.

`scripts/qa-rapido.py`: tudo certo.

### O que NÃO foi verificado

**Isolamento entre usuários pela tela.** Esta máquina roda com
`AUTH_DISABLED=true`, e todos resolvem para a mesma conta — não há dois usuários
para alternar na interface. Provado **pelo dado**: criando um segundo usuário
com `documentHint='9999'` direto no banco, `GET /perfil` continuou devolvendo só
o da conta corrente, e `9999` não apareceu na resposta. O serviço filtra por
`userId` em toda consulta, mas o caminho token→usuário→perfil com dois logins
reais só se prova com o login ligado.

**As regras de documento não foram conferidas contra documento real de
estrangeiro.** Os casos de teste vêm da especificação de cada dígito
verificador, com os DVs calculados — não de documentos emitidos. Para os seis
países validados isso basta (a fórmula é a regra); para os genéricos, não há o
que conferir.

### O que a compra vai reusar

Os campos vivem no `User` (migration `20260831120000_perfil_dados_pessoais`), e
`documentCountry` guarda contra qual país o documento foi validado. A tela de
pagamento lê `GET /perfil` e pede **só o que falta** — se `documentHint` vier
preenchido e `documentCountry === country`, o documento já está lá.

## O QA achou um, e era decisão de produto antes de ser bug (31/08)

**Escolher "Not set" apagava o país e deixava o documento cifrado no banco** —
sem gesto nenhum na tela capaz de removê-lo, porque o campo fica `disabled`
quando não há país. Quem preencheu o CPF e se arrependeu ficava sem saída.

```
country=NULL  ·  documentHint=4725  ·  documentEnc=59 chars
```

A causa era uma condição a mais:

```ts
} else if (atual.documentCountry && pais && atual.documentCountry !== pais)
```

O `pais &&` fazia o ramo ser falso quando o país novo era vazio — e como o
frontend só manda `document` quando o campo foi digitado, nenhum dos três ramos
rodava.

**"Not set" é gesto de limpar, e limpar tem de limpar.** A distinção que importa
é *"o campo veio no corpo"* (a pessoa mexeu nele), não *"o valor novo é
verdadeiro"*. Trocado por `corpo.country !== undefined`.

Medido depois, nos quatro caminhos:

| Gesto | Documento |
| --- | --- |
| trocar de país (BR→AR) | **apagado** |
| escolher "Not set" | **apagado** ← era o defeito |
| salvar só o telefone | preservado |
| mesmo país de novo | preservado |

**E o QA provou a regressão que mais me preocupava:** o `crypto.ts` foi
generalizado e ele cifra os tokens de API (PLT-01). Os **5 tokens de IA
continuam legíveis**, o `hint` bate com os quatro últimos do valor decifrado, e
gravar um token novo faz round-trip. Nos dois sentidos, leitura e escrita.

Também confirmou que o `SALT_DOCUMENTOS` separa de verdade: decifrar um
documento com `SALT_TOKENS` lança `Unsupported state or unable to authenticate
data`.

## O que ainda não foi verificado

- **Login real com dois usuários.** `AUTH_DISABLED=true` nesta máquina; o
  isolamento foi provado pelo dado (um segundo usuário com `documentHint` no
  banco não apareceu no `GET /perfil`), mas o caminho token→usuário→perfil com
  dois logins de verdade fica em aberto.
- **Documentos emitidos de verdade** dos 6 países validados. Os casos vêm da
  fórmula do dígito verificador, que é a regra — mas não de um documento real.
