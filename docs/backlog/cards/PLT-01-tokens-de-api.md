# PLT-01 · Tela de configurações com tokens de API

**Estado:** feito (13/08/2026)
**Tamanho:** M
**Pedido do stakeholder (13/08/2026):** guardar os tokens do Claude e do
ChatGPT usados pela aplicação, com link para gerar a chave.
**Decisão do stakeholder:** guardar no backend, cifrado. E, sobre o vínculo
com usuário: *"não precisa por enquanto, depois vamos vincular a usuário"*.

## O que faz

- Aba **Config** com um cartão por provedor (Anthropic e OpenAI)
- Link direto para onde a chave é gerada, abrindo em nova aba
- Campo mascarado (`type="password"`), que limpa depois de salvar
- Mostra só os **quatro últimos** caracteres da chave guardada
- Substituir e remover, com confirmação

## Como é guardado

`AES-256-GCM` no Postgres. GCM e não CBC porque além de cifrar ele
**autentica**: um valor adulterado no banco falha ao decifrar em vez de
devolver lixo silenciosamente.

A chave vem de `ENCRYPTION_KEY`. Sem ela o módulo lança erro de propósito —
guardar token em texto claro por descuido de configuração seria pior que não
ter a funcionalidade.

**O valor nunca volta da API.** O DTO de resposta tem só `provider`, `hint` e
`updatedAt`. Verificado: a resposta de `GET /settings/tokens` não contém o
token, e no banco só existe o texto cifrado.

## Risco conhecido e aceito

O `CurrentUserGuard` ainda é o stub que aceita qualquer `x-user-email` e
**nunca rejeita**. Enquanto for assim:

- a cifragem protege contra vazamento de um dump do banco
- **não protege** contra alguém mandar o header com o e-mail de outra pessoa
  e ler ou apagar os tokens dela

Isso foi levantado antes de construir e o stakeholder decidiu seguir, com o
vínculo a usuário para depois. Está escrito no comentário do controller,
para quem abrir o arquivo daqui a um mês.

**Enquanto o app não for publicado, o risco é contido** — ele roda na rede
local. Antes de ir para a internet, o login precisa existir.

## Critério de aceite

- [x] Um cartão por provedor, com link para gerar a chave
- [x] Link abre em nova aba com `rel="noopener"`
- [x] Campo mascarado e limpo após salvar
- [x] Só os 4 últimos caracteres aparecem
- [x] O token completo não volta da API
- [x] No banco está cifrado
- [x] Substituir e remover funcionam
- [x] Persiste depois do F5

## Prova

```
banco:  ANTHROPIC | 9999 | 3CzfBISfv9KRM1W9:BciWgUdrrjpgx9EFI6OsPw:m2Iq...
busca por texto claro no secret: 0 linhas
resposta da API: contém "9999", não contém o token
```

## O que fica em aberto

Para que servem os tokens ainda não foi decidido — a tela hoje só guarda.
Quando houver uso, provavelmente entra "testar a chave" (uma chamada barata
ao provedor) e registro de quando foi usada pela última vez.
