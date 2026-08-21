# JOB-31 · Company origin — empresa do seu país contratando para fora

**Estado:** feito (21/08/2026)
**Tamanho:** M

## Por quê

Pedido do stakeholder: *"quero se tiver vagas de empresas do meu país, que
seja para atuar para outro país em moeda forte — por exemplo uma Stefanini
que está oferecendo vagas para USA"*.

Verificado antes de implementar: **não funcionava e o dado não existia.** O
catálogo tinha `contrataEm` (onde a empresa contrata) e nenhum campo de sede;
a vaga traz `company`, `local` e `fonte` — e `fonte` é o ATS, não o país.

## O que foi feito

`empresas-sede.yaml` — 50 empresas marcadas à mão, por **país de origem** e
não como "lista de brasileiras": 32 BR, 10 IN, 4 MX, 3 AR, 1 CO. A Globant é
argentina, e a mesma pergunta vale para quem mora lá.

O filtro exige duas condições: a empresa é do país escolhido, **e** a vaga não
é para o próprio país dela.

```
CI&T        Senior Python+Java Developer    Colombia — remoto
VTEX        Senior Solution Architect       Barcelona / Nova York
Objective   Senior Software Engineer        Sydney
Neon        Forward Deployed Engineer       Asia | South Korea
```

## O que promete, e o que não promete

**Promete cliente estrangeiro. Não promete moeda forte.** Outsourcing
brasileiro frequentemente contrata CLT ou PJ **no Brasil, em real**, para
alocar em cliente americano — o trabalho vai para fora, o pagamento não.

Decisão do stakeholder em 21/08: *"pode ser o cliente estrangeiro, acho que o
usuário vai saber na hora de ler a descrição"*. É a escolha honesta —
prometer moeda seria prometer o que o dado não sustenta.

## Quatro bugs no caminho, todos achados medindo

1. **Substring bidirecional.** `alvo.includes(v) || v.includes(alvo)` fazia
   `"zup innovation".includes("ion")` marcar a Ion (irlandesa) como
   brasileira, e `"Loft Orbital"` (americana) casar com `loft`. Agora o nome
   precisa **começar** com a variante e o sufixo precisa ser neutro.

2. **`"Hybrid, SP"` não era Brasil**, então vaga da Fanatee em São Paulo
   passava como "para fora".

3. **O filtro só existia num motor.** O ATS não achava nada, a busca caía
   para a IA — que não recebia a restrição — e voltavam Ever, CLEAR e
   Rentana. Um filtro que só vale num motor mente quando o outro assume.

4. **41 das 50 empresas não estavam no catálogo**, incluindo a Stefanini do
   exemplo. Achei os slugs nos arquivos brutos: **17 boards vivos, 1.085
   vagas invisíveis** — CI&T 172, Stone 421, Gympass 106.

E um quinto que só apareceu depois: empresa nova entra no fim do arquivo e o
motor consulta as 200 primeiras — a CI&T caiu na posição 512. Agora o filtro
de sede **escolhe** as empresas em vez de só peneirar as vagas.

## Critérios de aceite

- [x] Dropdown Company origin com 5 países
- [x] Empresa estrangeira não aparece
- [x] Vaga para o próprio país da empresa não aparece
- [x] O filtro vale nos dois motores (ATS e IA)
- [x] `qa-rapido.py` passa

## Limitação conhecida

Das 50 mapeadas, **17 têm board vivo**. A Stefanini é uma das 33 sem — o
board não respondeu; pode ter trocado de ATS. Empresa ausente da lista não é
excluída de nada, só não responde a este filtro.
