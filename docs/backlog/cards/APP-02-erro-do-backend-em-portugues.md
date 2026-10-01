# APP-02 · Erro do backend em português na interface inglesa

**Estado:** feito (01/10/2026)
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

- [x] Nenhuma frase mistura os dois idiomas na mesma linha
- [x] Os quatro casos medidos acima aparecem em inglês
- [x] O log e a resposta da API continuam servindo a quem depura
- [x] A decisão de onde mora a tradução fica escrita aqui

## Onde mora a tradução, e por quê (01/10/2026)

**Mora no frontend, em `frontend/src/lib/erros-do-servidor.ts`, consumido pelo
`errorMessage()` de `lib/api.ts`.** É a terceira opção deste card — a barata —,
e a medição que a escolheu:

- `errorMessage()` é o **único** ponto do frontend que lê `message` do
  servidor. Conferido por grep: nenhum componente lê `response.data.message`
  direto, e 17 arquivos chamam `errorMessage`. Um ponto só para traduzir.
- O backend tem **24+ mensagens de exceção** em português. Nenhuma mudou.

Por que não as outras duas:

- **Traduzir no backend** contradiz o CLAUDE.md, que manda erro em português
  sem acento — e essa regra existe para o log e para quem depura. Atenderia a
  tela cegando o log. Verificado que o log continua servindo: `POST
  /jobs/profile/cv` com um `.txt` responde hoje
  `{"message":"Formato nao suportado. Envie o curriculo em PDF ou DOCX."}`,
  igual a antes da mudança.
- **Código de erro no backend** é o desenho certo a longo prazo, e continua
  sendo: quando houver razão para mexer no contrato, o mapa daqui vira a
  tabela de códigos sem retrabalho. Hoje ele obrigaria toda rota a mudar de
  uma vez por um problema de P.

**O fallback repassa o português, não apaga.** Mensagem fora do mapa sai como
veio. Uma frase em português numa interface inglesa é ruim; trocá-la por
"Something went wrong" é pior, porque apaga a única informação que quem depura
(e quem abre o ticket) tem. O mapa pode ficar incompleto sem virar perda de
informação — ele degrada para o estado de hoje, nunca para pior.

**O mapa não envelhece em silêncio.** `erros-do-servidor.spec.ts` lê
`backend/src/` do disco e falha se uma mensagem mapeada sumir de lá — os dois
lados moram no mesmo repositório, então o acoplamento existe só no teste, e
nada do módulo conhece o backend em tempo de execução (o bundle não mudou:
`npm run build` limpo, sem `node:fs`). **Limitação registrada:** ele não pega
mensagem NOVA que o backend crie e ninguém mapeie — essa cai no fallback, em
português. É degradação conhecida, não surpresa.

## Um defeito achado no caminho

O código antigo fazia `message.join(', ')` sem filtro. Com `message: []` — que
o Nest pode devolver — isso dava string vazia, e a caixa de erro aparecia
**vermelha e muda**. Agora array sem item útil cai nos genéricos
(`Error 400`), e item vazio ou não-string não deixa vírgula solta nem imprime
"null". Tem teste.

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


## Verificado (01/10/2026)

Frontend **270 → 346 testes** (9 arquivos), backend **383** intacto, `tsc`
limpo, `npm run build` limpo, `scripts/qa-rapido.py` tudo certo.
**13 mutações, 13 mataram teste** (duas só depois de o teste ser corrigido —
ver abaixo).

No navegador, com `AUTH_DISABLED=false` e a aplicação de pé:

- `/config/deploy` **sem sessão**, nos dois temas: as três linhas que o card
  cita viraram "Something went wrong / **Sign in to continue.** / Try again".
  Era o caso do guard, o mais visível de todos.
- Caixa de CV com um `.txt`: "⚠ **Unsupported format. Upload your resume as a
  PDF or DOCX.** Nothing was changed in your filters." — a linha exata da
  tabela deste card, agora inteira em inglês.

**Duas mutações ensinaram antes de matar.** Inverter a ordem dos dois padrões
de `Aula "…"`, e tirar a âncora `$` do mais curto, **não quebraram nada** —
são duas proteções independentes, e cada uma segura sozinha. O teste afirmava
a ordem, que é implementação; passou a afirmar o resultado (a trilha não some
da mensagem), e quebra quando as duas caem. A outra: o teste que lê o backend
assertava a contagem de arquivos no corpo do `describe`, então o caminho
quebrado saía como "no tests" em vez de falha nomeada — virou teste de
verdade (`leu o backend inteiro, e nao uma pasta so`).