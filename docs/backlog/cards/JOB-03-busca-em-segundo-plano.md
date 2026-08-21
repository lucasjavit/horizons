# JOB-03 · A busca roda sozinha a cada 50 minutos

**Estado:** feito (21/08/2026)
**Tamanho:** M
**Decisão do stakeholder (13/08/2026):** a busca roda a cada 50 min; as vagas
ficam **15 dias** no sistema.

## Por quê

É o motor da feature, e é o que resolve o problema que quase a matou.

A primeira versão era busca sob demanda. Medido: **~58 s no melhor caso**, e
isso não cabe num request HTTP nem na paciência de ninguém. Com a busca em
segundo plano, **58 s deixa de ser problema** — ninguém está olhando.

E dá para descartar o lixo antes de mostrar qualquer coisa, o que a busca ao
vivo não permitia.

## O que faz

A cada 50 minutos:

1. lê os perfis ativos, **agrupados** pela assinatura dos filtros
2. para cada grupo: Firecrawl busca → IA lê cada anúncio → filtra
3. grava as vagas novas com `expiresAt = agora + 15 dias`
4. apaga as vencidas

Sem tela. A pessoa vê o resultado quando entra, e o card do e-mail (fora de
escopo por ora) avisará depois.

## Os 15 dias

É o tempo em que um processo ainda está de pé. Depois disso a vaga
provavelmente fechou, e mantê-la na lista faz a pessoa clicar num link morto —
o que corrói a confiança na ferramenta inteira.

Vaga **salva** sai dessa regra e fica para sempre (JOB-05).

## Descarte antes de gravar

Medido no teste real do JOB-01:

- **vaga sem URL não entra** — eram 47% na extração real
- página institucional sem cargo identificável não entra
- salário implausível vira "não informado", nunca um número inventado

## O que impede a IA de inventar

O risco mais caro não é a busca falhar — é **funcionar e mentir**. Um card
dizendo "Aceita brasileiro · USD 8k–11k" tem a mesma aparência se for extraído
ou alucinado, e a pessoa recusa outra vaga por causa disso.

- **Campo ausente permanece ausente.** O prompt autoriza `null`.
- **Trecho de origem** para salário e elegibilidade, guardado no `snapshot`.
- **Validação por faixa** — foi assim que "Mais de 100 candidatos" virou salário.

Contra **prompt injection** (uma página pode conter texto branco mandando a IA
inflar o salário):

- conteúdo raspado entra delimitado e rotulado como não-confiável
- **CV e conteúdo raspado não vão na mesma chamada** — duas chamadas removem a
  classe inteira de "a página exfiltra o CV"

## Critério de aceite

- [ ] O job roda a cada 50 min sem ação de ninguém
- [ ] Perfis do mesmo grupo compartilham uma rodada só
- [ ] Vaga com `expiresAt` no passado some da lista
- [ ] Vaga sem URL não é gravada
- [ ] Salário fora de faixa vira "não informado"
- [ ] O `snapshot` guarda o trecho de origem das afirmações sensíveis
- [ ] Falha do Firecrawl não derruba a rodada inteira nem o app

## Depende de

- JOB-01 (saber se sobra vaga aproveitável)
- JOB-02 (o perfil e o agrupamento)


---

# Como a rodada funciona (13/08/2026)

O stakeholder forneceu o prompt do agente de busca (ver
[PLT-04](PLT-04-crud-de-prompts.md)) e decidiu a estratégia de validação:
**raspar listagem, abrir só as boas.**

## Duas fases, e o porquê

O prompt manda abrir cada vaga com Firecrawl para validar. Medido no JOB-01,
isso custa **5 créditos e ~36 s por página** — para 30 vagas, 150 créditos e
~18 minutos, a cada 50 minutos.

A listagem, por outro lado, rende **20 vagas por 5 créditos**.

Então a rodada é:

```
1  search                     2 cr    → listagens (nunca vagas)
2  raspar 3 listagens        15 cr    → ~60 vagas com titulo, empresa, URL
3  a IA ranqueia as 60         —      → sem custo de Firecrawl
4  abrir as ~10 melhores      50 cr   → elegibilidade e salario com evidencia
                            ─────
                            ~67 cr, ~8 min
```

Contra 150 créditos e 18 min abrindo todas. **A fase 4 é onde a elegibilidade
aparece** — "aceita brasileiro" quase nunca está na listagem, e é o dado que
justifica a feature.

## Regras que saíram do JOB-01

1. **URL de signup não é link de candidatura.** Medido: o Himalayas devolve
   `himalayas.app/signup/talent?redirect=…`. Descartar `/signup`, `/login`,
   `/register` — ou buscar o link real, ou apontar para a página do anúncio.
2. **O prompt precisa proibir contagem de candidatos como salário**,
   explicitamente. Foi o que resolveu — a alucinação era do prompt, não do
   modelo.
3. **Pedir evidência junto do valor**, para salário e elegibilidade.
4. **Raspar listagem, não vaga individual**, na primeira fase.

## `unverified` em vez de descartar

O prompt do stakeholder traz algo melhor que a minha regra binária: vaga que
não dá para verificar recebe `verification_status: "unverified"` e **continua
aparecendo, marcada**. Descartar em silêncio esconde da pessoa que existe algo
ali; marcar deixa ela decidir.


---

## Os campos que a extração precisa preencher (15/08/2026)

A tela de vagas ganhou o formato que o stakeholder pediu (linhas densas, chips,
bandeirinha), e isso **adicionou campos que a extração tem de trazer**. Sem
isto escrito aqui, a busca seria construída preenchendo metade da linha.

| Campo | O que é | Quando falta |
| --- | --- | --- |
| `area` | Família do cargo, como o anúncio escreveu ("Back-end Engineer") | sem chip de área |
| `anosExp` | Anos de experiência pedidos | sem "Exp: N anos" |
| `benefits` | Benefícios citados | sem chips de benefício |
| `degree` | Formação exigida | sem chip de formação |
| `logoUrl` | Logo da empresa | a tela cai nas **iniciais** |
| `paisIso` | ISO-3166 alpha-2 (`us`, `br`) | sem bandeirinha |

**A regra vale para todos: campo ausente permanece ausente.** O prompt autoriza
`null` explicitamente, e a tela não mostra nada no lugar. Se a linha ficar feia
com campo vazio, a pressão vira preencher — e o desenho passa a causar a
alucinação, que é exatamente o que as quatro defesas deste card evitam.

`area` sai do anúncio, **não é deduzida do título**. Deduzir é inventar com
outro nome.

`paisIso` é o mais arriscado da lista: é a IA normalizando "Remote (US)",
"United States", "USA" e "Estados Unidos" para `us`. Vale validar contra uma
lista fechada de ISO — código fora da lista vira `null`, não vira bandeira
errada.


---

## Feito em 21/08/2026

Roda a cada 50 min, **desligada por padrão**. O interruptor é
*"Buscar vagas automaticamente"* em Configurações.

### Verificado de ponta a ponta

Perfil de teste criado no banco, rodada disparada à mão (sem esperar 50 min):

```
1 perfis em 1 grupos; buscando 1
ATS devolveu 1 vagas
grupo teste|backend|remoto: 1 vagas, 1 novas
```

- **Gravou com `expiresAt` em 15 dias** — conferido no banco: 05/09
- **Dedup funciona**: segunda rodada gravou **0 novas**, sem duplicar
- O perfil e a vaga de teste foram removidos depois

### Decisões

**Default desligado**, ao contrário do motor de ATS. Ele não gasta nada e
liga sozinho; esta gasta **sem ninguém pedir**, e o que gasta sozinho só liga
por decisão explícita — ligar sem querer produz conta no fim do mês que
ninguém sabe de onde veio.

**Depende de haver motor.** Sem ATS, Firecrawl ou chave de IA, o interruptor
fica bloqueado: a rodada gastaria tempo para não achar nada.

**Uma rodada por vez** (`this.rodando`). Uma busca lenta não pode acumular
com a próxima.

**Teto de 10 grupos por rodada.** Cada grupo leva ~1 minuto; sem teto, 50
grupos levariam quase a hora inteira e a rodada seguinte começaria em cima
da anterior.

**Limpa antes de buscar.** Se a rodada falhar no meio, ao menos o lixo saiu.

**`skipDuplicates` em vez de upsert.** A mesma vaga na rodada seguinte não
sobrescreve a anterior: o `foundAt` original é o que diz "isto é novo desde
sua última visita" ([JOB-26](JOB-26-historico-do-usuario.md)), e regravar
apagaria essa informação.

### Um aviso do card que não se aplica mais

O KANBAN listava `timeout: 10_000` em `api.ts` como bloqueador. **Conferido:
não afeta.** A busca é SSE por `fetch`, e o axios não a alcança — o aviso era
de quando o desenho previa chamada síncrona.

### O que o card previa e mudou

Ele dizia "Firecrawl busca → IA lê cada anúncio". Hoje o motor padrão é o
**ATS** ([JOB-20](JOB-20-motor-de-ats.md)), que custa R$ 0 — e o job usa o
`BuscaService`, que escolhe o motor sozinho conforme os interruptores.
