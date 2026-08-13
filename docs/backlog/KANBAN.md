# Kanban — Horizons

Um arquivo por card em [cards/](cards/). Este arquivo é o quadro: mover um
card é mover a linha de coluna, e atualizar o campo **Estado** dentro do
arquivo dele.

Prefixos: `INV` invoice · `LRN` trilhas · `PLT` plataforma (login, infra,
umbrella).

---

**Sprint atual:** [02 · Achar vaga](sprints/02-achar-vaga.md) (13/08 – 27/08)
— dar dono às contas e fazer a busca de vagas rodar sozinha.

A decisão do login **saiu**: Google Sign-In, portado do arguição. É o que
destrava o resto.

## Backlog

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos, histórico e duplicar do mês passado | G | **bloqueado no login** · comportamento já definido |

## Pronto para fazer

_(vazio)_

## Esperando decisão

_(vazio)_

## Fazendo

_(vazio)_

## Feito

| Card | Título | Quando |
| --- | --- | --- |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos e histórico — **substituído** pelo PLT-02 e INV-14 | 13/08/2026 |
| [PLT-01](cards/PLT-01-tokens-de-api.md) | Tela de configurações com tokens de API, cifrados | 13/08/2026 |
| [INV-16](cards/INV-16-logo-da-empresa.md) | Logo da empresa, com opção preto e branco | 13/08/2026 |
| [INV-15](cards/INV-15-campo-numerico-so-aceita-numero.md) | Campo numérico aceitava letra (`1eee`) | 13/08/2026 |
| [INV-14](cards/INV-14-historico-local.md) | Histórico de invoices no navegador | 13/08/2026 |
| [INV-13](cards/INV-13-campos-de-pagamento.md) | Pagamento em campos renomeáveis, não em texto livre | 13/08/2026 |
| [INV-12](cards/INV-12-reordenar-blocos-e-bandeiras.md) | Blocos reordenados, Payment/Notes separados, bandeiras | 13/08/2026 |
| [INV-11](cards/INV-11-virgula-decimal-multiplica-por-100.md) | **Vírgula decimal multiplicava por 100** — a moeda desempata | 13/08/2026 |
| [INV-09](cards/INV-09-redesenho-da-tela.md) | Redesenho: prévia ao vivo, acordeão, buraco resolvido | 12/08/2026 |
| [INV-05](cards/INV-05-retry-impossivel-apos-falha.md) | Retry após falha de rede — resolvido com `<script>` clássico | 13/08/2026 |
| [INV-06](cards/INV-06-foco-perdido-no-teclado.md) | Foco volta ao botão ao baixar por teclado | 12/08/2026 |
| [INV-08](cards/INV-08-empresa-em-modal.md) | Cadastro de empresa em modal + select | 12/08/2026 |
| [INV-01](cards/INV-01-total-negativo.md) | Rejeita quantidade e valor negativos | 12/08/2026 |
| [INV-02](cards/INV-02-numero-grande-vira-zero.md) | Teto de 1.000.000 por campo, com aviso | 12/08/2026 |
| [INV-03](cards/INV-03-clique-repetido-gera-varios-pdfs.md) | Clique repetido gera vários PDFs | 12/08/2026 |
| [INV-04](cards/INV-04-pdf-com-dados-antigos.md) | PDF com dados antigos ao editar durante a geração | 12/08/2026 |
| [INV-07](cards/INV-07-status-preso-em-baixado.md) | Status preso em "Invoice downloaded." | 12/08/2026 |
| — | Gerador de invoice, camada 1 (formulário, PDF, rascunho local) | 12/08/2026 |
| — | Trilhas, progresso e 75 aulas autorais de System Design | 11/08/2026 |

---

## O que trava o resto

**Nada, por ora.** A decisão do login saiu em 13/08/2026: Google Sign-In,
portado do arguição, no card [PLT-02](cards/PLT-02-login-com-google.md).

O risco que continua até ele ser feito: o `CurrentUserGuard` ainda é o stub que
lê `x-user-email` e nunca rejeita. Os tokens de API do PLT-01 estão guardados
**sem dono real** — cifrados contra vazamento do banco, não contra alguém
mandar o header com o e-mail de outra pessoa.

## Decisões já tomadas

Para não serem rediscutidas sem motivo novo:

- **Cobrança fica para depois.** Sem informação para precificar; primeiro usar
  e medir.
- **A invoice é anônima por padrão.** Exigir cadastro para gerar um PDF perde
  a corrida contra um formulário que gera na hora.
- **A invoice é em inglês, as trilhas em português.** A invoice é porta de
  entrada global; as trilhas são para o dev brasileiro.
- **O PDF é gerado no navegador.** Custo zero de servidor, funciona anônimo.
- **O login é com Google, não com senha** (13/08/2026). O arguição não tem
  senha para portar, e o Google já entrega e-mail verificado — que a busca de
  vagas precisa para avisar.
- **A busca de vagas roda em segundo plano**, a cada 50 min, e ninguém espera
  olhando a tela. Medido: uma busca ao vivo leva ~58s no melhor caso.
- **Vaga encontrada fica 15 dias**; vaga salva fica para sempre.
- **Do CV, guarda-se só o perfil extraído** — nunca o arquivo. Some o CPF, o
  endereço e o telefone.
- **Não reusar o look4job**, apesar de ele ter 1.953 empresas catalogadas e
  estar em produção. Abordagem deliberadamente diferente.

---

## Quadro dentro do app (temporário)

Existe uma aba **Quadro** no app, em `/quadro`, visível em qualquer build —
inclusive no Docker (`localhost:5173`), que é onde o app roda de verdade.

**Ela precisa sair antes de publicar.** O backlog tem bugs conhecidos e
decisões internas; não é conteúdo para quem chega de fora. Enquanto o app não
está no ar, deixá-la visível não custa nada e serve para acompanhar o trabalho.

Os dados vêm de `frontend/public/quadro.json`, gerado junto com o HTML:

```
python3 scripts/kanban-html.py    # gera o index.html E o quadro.json
```

**Para remover quando não fizer mais sentido** — é só apagar, nada mais
depende disso:

1. `frontend/src/pages/QuadroPage.tsx`
2. `frontend/public/quadro.json`
3. As três marcas `QUADRO (temporario)` em `frontend/src/App.tsx`
   (o import, a entrada da aba e a rota)
4. O bloco `SAIDA_JSON` em `scripts/kanban-html.py`, se quiser parar de gerar
