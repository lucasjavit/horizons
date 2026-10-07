# JOB-57 · Dá para atualizar a chave de IA que já está cadastrada

**Estado:** feito (06/10/2026)
**Tamanho:** P
**Pedido pelo Lucas (06/10/2026):** "quero poder fazer o update das keys das
AI" — a tela só mostrava campo para Groq e Cerebras.

## Por quê

Em `/config/ia`, o campo de chave só aparecia para provedor **sem chave** ou
com **chave recusada**. É de propósito (campo aberto sobre chave boa convida a
mexer no que está certo), mas deixava um buraco: o `Remove` mora dentro do
mesmo formulário. Chave funcionando, **sem cota** ou com erro não tinha campo
nem `Remove` — nenhum caminho pela tela.

Medido em 06/10: com OpenAI, Gemini e Anthropic sem crédito e Mistral com o
plano errado, os únicos campos na tela eram os de Groq e Cerebras.

## Decisão

**CRUD completo da chave, em toda linha de provedor, nas duas cadeias:**

| | Como |
| --- | --- |
| Criar | campo `Key`, aberto, em quem não tem chave |
| Ler | `Key ends in XXXX`, estado e motivo da última verificação |
| Atualizar | `Update key` abre `Replace key` + `Save and test`; `Cancel` descarta |
| Excluir | `Remove key`, com confirmação (`Confirm removal` / `Keep key`) |

- O campo de chave boa continua **fechado por padrão**; chave recusada nasce
  com ele aberto.
- **Nas duas cadeias.** A primeira versão (mesmo dia) punha o botão numa
  cadeia só, para não haver dois campos da mesma chave. Na tela isso parecia
  "só alguns provedores têm update" — foi o que o dono viu. Dois campos não
  divergem no que importa: o rascunho é local, e salvar recarrega a página.
- **Remover pede confirmação**, o que não pedia antes: a chave apagada não
  volta pela tela, e o botão agora fica à vista, ao lado do de atualizar.

## Critérios de aceite

- [x] Toda linha com chave tem `Update key` e `Remove key`, nas duas cadeias
- [x] Sem chave: campo de cadastrar; chave recusada: campo já aberto + remover
- [x] Salvar troca a chave, testa e fecha o campo
- [x] `Cancel` não salva e não guarda o rascunho
- [x] Remover exige confirmação; um clique só não apaga
- [x] Dá para remover uma chave que funciona
- [x] Botões com nome acessível por provedor, `aria-expanded`
- [x] Teste automatizado (`ConfigIaPage.spec.tsx`)
