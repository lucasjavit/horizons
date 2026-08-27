# APP-02 · Erro do backend em português na interface inglesa

**Estado:** aberto (25/08/2026)
**Tamanho:** P

## Por quê

A regra de idioma mudou em 25/08: **a interface é toda em inglês, só o conteúdo
das trilhas é português**. A tradução cobriu ~150 strings do frontend, mas o
texto de erro que o usuário lê nem sempre nasce lá — parte vem do backend, e o
CLAUDE.md manda `NotFoundException` com mensagem em português sem acento.

Medido pelo QA em 25/08, contra o backend real:

| Onde | O que aparece |
| --- | --- |
| Caixa de CV, arquivo `.txt` | "**Formato nao suportado. Envie o curriculo em PDF ou DOCX.** Nothing was changed in your filters." |
| Caixa de CV, PDF sem texto | "**Nao consegui ler texto neste arquivo…**" |
| Caixa de CV, acima de 5 MB | idem |
| `/email/sair?t=invalido` | "**Link invalido ou expirado**" |

A frase troca de idioma no meio. E sem acento ("curriculo", "nao") não parece
outro idioma — parece texto quebrado.

## Gravidade, na avaliação do QA

Médio, e **maior na caixa de CV que no `/email/sair`**: ali é uma página
terminal que se vê uma vez; aqui é o passo principal de uma feature recém
redesenhada, e são os erros mais comuns (formato errado, PDF escaneado).

## O que trava

Não é escrever a tradução — é **decidir onde ela mora**, e as duas opções têm
custo:

1. **Traduzir a mensagem no backend.** Contradiz o CLAUDE.md, que manda erro em
   português sem acento — e essa regra existe para o log e para quem depura,
   não para a tela.
2. **Código de erro no backend, texto no frontend.** É o desenho certo a longo
   prazo, mas muda o contrato de toda rota que hoje devolve `message` e obriga
   o front a conhecer cada caso.

Uma terceira, mais barata: **manter o português no backend e traduzir só onde a
mensagem é exibida ao usuário**, com um mapa no front para os casos conhecidos e
fallback genérico. Cobre o que dói sem mexer no contrato.

## Critérios de aceite

- [ ] Nenhuma frase mistura os dois idiomas na mesma linha
- [ ] Os quatro casos medidos acima aparecem em inglês
- [ ] O log e a resposta da API continuam servindo a quem depura
- [ ] A decisão de onde mora a tradução fica escrita aqui

## De onde veio

QA da leva de 25/08 (redesenho da caixa de CV + tradução da interface). Ele
levantou o `/email/sair` a partir do que já se sabia, e **descobriu que a mesma
coisa acontece na caixa de CV** — que é o caso que importa.


## Ficou MUITO mais visível com o login ligado (27/08)

Até 27/08 a aplicação rodava com `AUTH_DISABLED=true`, e nenhuma tela via a
mensagem do guard. Com o login religado para o teste de produção, o
`AuthGuard` passou a responder **"Entre para continuar."** em toda tela
protegida sem sessão — e o `errorMessage` repassa o texto do servidor.

Medido em `/config/deploy` sem sessão:

```
Something went wrong
Entre para continuar.        ← português, numa interface em inglês
Try again
```

Três frases, a do meio em outro idioma. **Isto deixa de ser canto escuro:** é o
que qualquer pessoa vê ao abrir uma tela de admin com a sessão expirada, que é
o caso comum depois dos 30 dias do token.

`backend/src/auth/auth.guard.ts:63` é a origem. Sobe a prioridade do card.
