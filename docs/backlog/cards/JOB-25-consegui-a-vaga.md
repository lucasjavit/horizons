# JOB-25 · O botão "consegui a vaga 🎉"

**Estado:** feito (24/08/2026)
**Tamanho:** P

## O problema

**O produto funciona quando o usuário vai embora.** Ele acha a vaga, é
contratado, cancela. É estrutural em qualquer produto de emprego.

A primeira ideia foi reduzir a porção — mandar menos vagas por menos dinheiro.
Ela falha por dois motivos:

1. Transforma o **melhor momento da relação** (a pessoa conseguiu emprego) em
   entrega pior. Produto pior por menos dinheiro ainda é produto pior.
2. **O sistema não sabe que ela foi contratada.** Ela não avisa. Inferir do
   comportamento não funciona: quem parou de abrir e-mail pode ter conseguido
   emprego ou ter desistido, e os dois sinais são idênticos.

## A inversão

Quem foi contratado não recebe **menos** — recebe **outra coisa**. Ele parou de
precisar de vaga e passou a precisar de:

- emitir invoice todo mês
- saber se o câmbio compensa receber agora
- saber quanto o mercado paga para o cargo dele hoje
- continuar de olho no mercado sem procurar — **uma vaga por mês, das boas**

Mesmo preço, ou até menor, mas por **valor diferente, não por porção menor**.
A invoice deixa de ser isca e vira o produto de quem já chegou.

## A versão mínima

Um botão no e-mail. Quem clica:

- passa a receber **uma vaga por mês** em vez de toda semana
- vê a **invoice subir ao topo** do produto
- (fase 2) entra no catálogo do lado B como profissional **empregado** — que é
  justamente quem empresa quer

E o Horizons ganha a métrica que vale mais que todas: **quantas pessoas ele
empregou.** É o que vende o produto para o próximo usuário.

## Critérios de aceite

- [x] O botão está em todo e-mail, e funciona sem login
- [x] Quem clica muda de cadência, e a tela diz isso claramente
- [x] Dá para desfazer — voltar a procurar é um clique
- [x] A métrica de contratados é visível para o admin

## Decidido

**Não baixar o preço de início.** Quem vai cancelar cancela, e desconto na saída
raramente segura. Primeiro descobrir se o plano de invoice se sustenta sozinho.


## Como ficou (24/08/2026)

Mesmo mecanismo de token do JOB-24: `POST /api/email/contratado?t=…`, sem login.
O botão está no rodapé de todo e-mail **e** no rodapé da aba Jobs — quem percebe
que foi contratado costuma estar olhando vagas, não relendo e-mail antigo.

**Não é downgrade, e o código diz isso.** Quem clica continua com `ativo = true`
e passa a `cadencia = 'mensal'`; a tela fala do que a pessoa **passa a receber**
("one hand-picked job a month, so you can keep an eye on the market without
looking for it"), nunca do que perdeu.

`contratadoEm` é **coluna própria**, e não deduzida de `cadencia == 'mensal'`:

- é a métrica que o produto existe para produzir — quantas pessoas ele empregou;
- **o desfazer não a apaga.** Voltar a procurar devolve a cadência semanal e
  mantém `contratadoEm`: a pessoa voltou ao mercado, não deixou de ter sido
  contratada um dia. Sem essa separação, a métrica sumiria justamente de quem
  usou o produto até o fim.

### O que foi medido

| Verificação | Resultado |
| --- | --- |
| Marcar contratado sem login (`AUTH_DISABLED=false`) | 201, `cadencia: mensal`, `contratadoEm` preenchido, `ativo` continua `true` |
| Métrica do admin | `contratados: 1`, `emCadenciaMensal: 1` |
| Desfazer em um clique | volta a `semanal`, **`contratadoEm` preservado** |
| Clicar duas vezes | `contratadoEm` mantém a **primeira** data |
| `GET /api/email/metricas` sem sessão | 401 (é `@AdminOnly()`) |

### Ressalvas

- A **fase 2** (entrar no catálogo do lado B como profissional empregado) não foi
  feita — o card já a marcava como fase 2.
- A **invoice não sobe ao topo** para quem foi contratado. O card pede isso, e
  ficou de fora: mexer na ordem das abas afeta todo mundo e merece decisão de
  produto própria. A cadência e a métrica, que são o núcleo, estão prontas.
- A página `/email/contratado` **não foi aberta num navegador**: o Chromium deste
  ambiente não faz requisição de rede nenhuma (nem para `127.0.0.1`), então a
  verificação da tela foi por compilação de tipos, presença das strings no bundle
  de produção e teste das rotas por `curl`.
