# JOB-52 · A busca lê da cópia local

**Estado:** backlog (01/10/2026) — depende do [JOB-50](JOB-50-ingestao-de-vagas-rastreadas.md) e do [JOB-51](JOB-51-rastreador-rastreio-e-fila-de-envio.md)
**Tamanho:** M
**Pai:** [JOB-49](JOB-49-rastreador-de-vagas-arquitetura.md)

## Por quê

Com a tabela cheia, a busca pode parar de sair de casa. É aqui que os dois
buracos do pai fecham: o tempo (128s do ATS ao vivo) e o anônimo com 0 vaga
sem o freehire.

## O que fazer

1. **Um motor novo, o primeiro da cascata**: consulta a tabela de vagas
   rastreadas. Filtros e facetas iguais aos que a tela já oferece.
2. **Interruptor próprio** em `/config/vagas`, como todo motor. Desligado, a
   cascata atual vale inteira.
3. **O anônimo usa este motor.** Consultar o próprio banco não tem o custo
   que fez o JOB-47 barrar o ATS para quem não entrou.
4. **A busca agendada** (`busca-agendada.service.ts`) passa a ler só daqui
   (decisão do stakeholder, 01/10).
5. **A cascata fica**: cópia local → freehire (reserva) → ATS ao vivo → IA.

## O motor de ATS ao vivo fica, com interruptor

**Decisão do stakeholder (01/10):** *"Não vamos desligar, vamos ter um botão
no settings para habilitar e desabilitar quando necessário."*

A primeira versão deste card previa medir a cobertura e então **remover** o
motor ao vivo. Isso caiu. Ele continua no código como reserva, ligado ou
desligado por quem administra.

**O botão já existe**: é a flag `jobs.ats`, com interruptor em `/config/vagas`
(`definirAts` em `recursos.service.ts`). Não há nada a construir para a
decisão valer; o que este card precisa garantir é que o interruptor continue
funcionando depois que o motor novo entrar na frente.

O que muda com o motor ao vivo ligado: ele só é alcançado quando a cópia local
e o freehire não acharem nada, então o custo de 128s deixa de estar no caminho
normal.

## A medição, que continua valendo

Não decide mais remoção nenhuma, mas é o que diz se a cópia local **cobre** o
que os outros cobrem — e, portanto, quando faz sentido deixar o ATS ao vivo
desligado.

Mesmas consultas, um motor de cada vez, como o JOB-39 fez:

| Consulta | cópia local | freehire | ATS ao vivo |
| --- | ---: | ---: | ---: |
| `backend engineer`, LATAM | | | |
| `data engineer`, LATAM | | | |
| `react developer`, LATAM | | | |
| busca ampla, sem filtro | | | |

E o tempo de cada um.

O que já se sabe e vai pesar: o JOB-40 mediu que o **LATAM não melhorou** com
as empresas colhidas (95 → 96), porque a colheita não sabe em que países a
empresa contrata. Se a cópia local repetir isso, o gargalo é a elegibilidade,
não o rastreador.

## Critérios de aceite

- [ ] Busca com a cópia local ligada responde sem nenhuma chamada externa
- [ ] **Com o freehire desligado, a busca anônima devolve vaga** (hoje: 0)
- [ ] Motor desligado: a cascata antiga funciona como antes
- [ ] Tabela vazia: cai para o próximo motor, não devolve "nenhuma vaga"
- [ ] A busca agendada lê da cópia local
- [ ] A tabela de medição acima preenchida, com data
- [ ] O interruptor do ATS ao vivo (`jobs.ats`) continua ligando e desligando
      o motor, com a cópia local na frente
- [ ] Teste automatizado da cascata com o motor ligado e desligado
- [ ] Conferido no navegador, nos dois temas
