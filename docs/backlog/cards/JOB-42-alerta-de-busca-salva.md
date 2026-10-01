# JOB-42 · A busca salva dispara alerta

**Estado:** aberto — **adiado por decisao do stakeholder (01/10/2026)**: "enviar o email vai ficar mais para frente"
**Tamanho:** M

## Por quê

O [JOB-41](JOB-41-modal-de-filtros-avancados.md) entregou as buscas salvas: dá
para montar um filtro no modal, nomeá-lo e guardá-lo. O modelo `SavedSearch`
já tem `porEmail`, `porTelegram` e `avisadoEm`, e a tela liga e desliga os
canais.

**O que não acontece é o alerta.** Os dois canais existem e funcionam — o
e-mail semanal do [JOB-24](JOB-24-email-semanal.md) e o Telegram do
[JOB-32](JOB-32-telegram-como-canal.md) —, mas cada um manda o resultado de
**um filtro único**, o mesmo para todo mundo. A busca salva é guardada e nunca
consultada.

Isso é meia feature: o canal é guardado e nunca consultado.

> ⚠️ **Corrigido em 01/10:** a frase original deste card dizia *"a pessoa marca
> 'avisar por e-mail', a tela aceita, e nada chega — pior que não ter o
> interruptor, porque ele promete"*. **Medido hoje: o interruptor não existe
> na tela.** Ver "O que foi medido em 01/10" no fim do card. O card e a nota
> dele no quadro afirmavam um defeito de interface que não está lá.

## O que fazer

1. O cron do e-mail semanal passa a iterar as `SavedSearch` com `porEmail`
2. Idem para o Telegram, com `porTelegram`
3. Cada busca roda com **os filtros dela**, e não com o filtro global
4. `avisadoEm` evita reenviar o que já foi — e é o campo que já existe para isso
5. Vaga nova desde o último aviso, e não a lista inteira: é a regra que o
   JOB-24 já aplica

## O que decidir antes

- **Uma mensagem por busca, ou uma juntando todas?** Cinco buscas salvas
  viram cinco e-mails por semana, ou um com cinco seções. A segunda respeita
  mais a caixa de entrada; a primeira deixa desinscrever de uma sem perder as
  outras.
- **O teto de 20 buscas por pessoa** (`TETO_POR_PESSOA`) foi escolhido pensando
  em alerta, não em armazenamento. Com o alerta ligado, vale medir se 20 é
  demais.
- **Busca salva de quem ficou inativo.** O e-mail semanal já tem
  desinscrição; a busca salva precisa herdar isso ou o cron manda para quem
  saiu.

## Critérios de aceite

- [ ] Uma busca salva com `porEmail` gera e-mail com as vagas **daquele** filtro
- [ ] Idem para o Telegram
- [ ] `avisadoEm` impede reenvio da mesma vaga
- [ ] Não manda mensagem vazia — a regra do JOB-24 continua valendo
- [ ] Desinscrever para de mandar, e está registrado no card qual escolha foi
      feita sobre agrupar ou separar as mensagens

## Relacionados

- [JOB-41](JOB-41-modal-de-filtros-avancados.md) — o card que criou as buscas salvas
- [JOB-24](JOB-24-email-semanal.md) e [JOB-32](JOB-32-telegram-como-canal.md) — os canais


---

## O que foi medido em 01/10/2026

Conferido antes de adiar, porque o card afirmava um defeito **na tela** e isso
mudaria a urgencia: interface que promete o que nao cumpre e defeito, feature
que falta e backlog.

| peca | existe? |
| --- | --- |
| modelo `SavedSearch` com `porEmail`/`porTelegram`/`avisadoEm` | sim |
| rota `PATCH /jobs/saved-searches/:id/canais` | sim, funcionando |
| `definirCanaisDaBusca()` em `frontend/src/lib/api.ts` | sim |
| **componente que chame `definirCanaisDaBusca`** | **nenhum** (`grep` em todo `src`) |
| toggle de canal no `ModalFiltros` | nao ha |

**Nao ha interruptor mentindo.** O `Email me new jobs` visivel na tela
(`AssinaturaEmail.tsx`) e o JOB-24, que **funciona** — manda o filtro global.
Outra feature.

E o sino de avisos ja trata a ausencia com honestidade. O comentario dele:

> *"Hoje ele nao tem o que mostrar, e diz isso. (...) um popover que diz 'No
> notifications yet.' e diferente de um botao inerte. O inerte e promessa
> vazia — a pessoa clica e nada acontece, e ela nao sabe se quebrou ou se
> esta vazio. Este responde, e a resposta e a verdade."*

**Conclusao: o JOB-42 e feature, nao defeito.** Adiar nao deixa nada quebrado
no ar, e nao exige aviso de transicao na interface.

### O que isso implica para quando o card voltar

O backend esta pronto e o front tem o cliente HTTP. **O que falta e o toggle
na tela e o cron** — e nesta ordem importa: ligar o toggle ANTES do cron
criaria exatamente o defeito que este card descrevia por engano.

As tres decisoes da secao "O que decidir antes" continuam abertas, e a
primeira delas (uma mensagem por busca, ou uma juntando todas) e a que decide
o desenho do toggle.
