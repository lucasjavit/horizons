# JOB-37 · O catálogo aprende com o que a busca encontra

**Estado:** aberto (25/08/2026)
**Tamanho:** M

## A ideia

Do stakeholder, em 25/08: **quando a busca encontra uma vaga de uma empresa,
fonte ou slug que não está nos arquivos, gravar.**

O catálogo hoje é estático — 26.095 slugs em oito arquivos, montados por
importação e curadoria manual. Cada busca passa por dezenas de empresas e
**joga fora tudo o que aprendeu**. O motor de ATS ([JOB-20](JOB-20-motor-de-ats.md))
só consegue consultar quem já está na lista, então o catálogo é o teto da
busca: nenhuma vaga vem de empresa que ele desconhece.

Um catálogo que cresce sozinho é o tipo de vantagem que não se copia num fim de
semana — é acúmulo, e é exatamente o que o [JOB-18](JOB-18-niveis-de-busca.md)
identificou como a defesa real do produto ("catálogo + tempo + acúmulo", não
profundidade de leitura).

## O que foi medido antes de escrever este card

Contra as vagas que a busca já encontrou:

| | |
| --- | ---: |
| slugs no catálogo | **26.095** |
| empresas distintas nas vagas encontradas | 42 |
| **dessas, fora do catálogo** | **3** |

As três:

```
Duolingo      careers.duolingo.com/jobs
Udemy         app.careerpuck.com/job-board/udemy
Epic Games    epicgames.com/careers
```

**E o número pequeno é a descoberta, não a decepção.** Ele diz que a hipótese
está certa *e* que o ganho não vem de onde parecia:

- **39 de 42 já estavam no catálogo.** A curadoria funciona — a colheita não vai
  encher o catálogo de empresas novas por si só.
- **As 3 que faltavam não são ATS conhecido.** Duolingo e Epic Games têm quadro
  próprio no domínio da empresa; a Udemy usa `careerpuck`, um ATS que o produto
  não conhece. **Nenhuma das três seria alcançada por `slugs-greenhouse.json`.**

Ou seja: o valor não é "mais slugs de Greenhouse". É **descobrir ATS que ainda
não sabemos que existem** — o `careerpuck` é o exemplo. Um ATS novo não vale uma
empresa: vale todas as empresas que ele hospeda.

## Como funciona — o desenho do stakeholder (25/08)

> "O usuário vai fazer a busca e aí vão vir os dados da pesquisa: fontes,
> empresas e slug. E aí você itera entre eles, ou **salva num banco de dados
> para iterar de madrugada e verificar um por um**."

**São dois tempos, e separá-los é a decisão que faz isto funcionar.**

### Tempo 1 — a busca só ANOTA (barato, síncrono)

Toda vaga que entra já traz `url` e `company`. Dela saem host, caminho e slug,
sem nenhuma chamada de rede a mais. Se o par (host, slug) não está no catálogo,
vira linha numa fila de descobertas: quando, de qual busca veio, e um contador
de aparições.

**Anotar não pode custar nada.** A busca já leva ~58s; se a captura falhar ou
demorar, a vaga entra do mesmo jeito — o registro é efeito colateral, nunca
caminho crítico.

### Tempo 2 — de madrugada, VERIFICA uma por uma (caro, assíncrono)

Aqui está o motivo de o stakeholder ter separado os dois, e ele está certo:
**verificar é caro e não pode acontecer enquanto alguém espera.**

Cada descoberta é testada contra o ATS de verdade — o slug existe? devolve
vaga? quantas? A peça já existe: `busca-ats.service.ts:225` (`daEmpresa`)
consulta um slug e devolve as vagas dele; `greenhouse`, `ashby` e `lever` são os
três dialetos. Verificar uma descoberta é chamar isso e olhar o resultado.

O projeto já tem dois crons (`busca-de-vagas` a cada 50 min, `email-de-vagas` de
hora em hora), então o mecanismo é conhecido. Este é o terceiro, e o único que
roda em horário fixo — de madrugada, porque:

- **não compete com a busca do usuário** pelos mesmos limites de taxa dos ATS
- pode ser **lento de propósito** — uma consulta a cada N segundos não irrita
  ninguém, e é o que evita levar 429 do provedor
- se travar, ninguém está esperando

### Tempo 3 — promover é decisão humana

A verificação não grava em `backend/data/ats/`. Ela **classifica**: confirmada
(o slug existe e rende vagas), morta (404 ou zero vaga), ou desconhecida (host
que ainda não sabemos consultar). Alguém olha e decide.

Gravar automático deixaria dado curado e versionado à mercê de uma extração
ruim da IA. E o número que a verificação produz — *quantas vagas este slug
rendeu* — é justamente o que torna a decisão humana rápida.

### O que a verificação responde, e a anotação não

| Pergunta | Só anotando | Verificando |
| --- | --- | --- |
| Este slug existe? | não se sabe | sim/não |
| Rende quantas vagas? | não se sabe | número |
| O host é um ATS ou quadro próprio? | palpite pela URL | testado |
| Vale escrever adaptador para ele? | — | **quantas vagas já rendeu** |

**Agrupar por host é onde está o valor.** Três empresas em `app.careerpuck.com`
valem mais que trinta em `job-boards.greenhouse.io`: as primeiras revelam um ATS
inteiro por descobrir, as segundas só confirmam o que já se sabe.

## Onde isso encosta

- `backend/src/jobs/busca-ats.service.ts` — o motor que lê o catálogo
- `backend/src/jobs/busca.service.ts` — por onde toda vaga passa antes de virar
  `FoundJob`, e o ponto natural de captura
- `backend/data/ats/` — os oito arquivos, que continuam sendo a verdade
- [JOB-17](JOB-17-catalogo-de-ats.md) mediu o catálogo do look4job; este card é
  o inverso: em vez de importar de fora, colher de dentro

## O que decidir antes de implementar

- **A fila fica no banco** (decidido: o stakeholder pediu explicitamente, e a
  captura é em tempo de execução). **Mas a promoção precisa virar commit** — o
  catálogo é versionado em git, e uma descoberta que só existe no banco morre
  no próximo banco novo. Provavelmente um script que exporta as confirmadas
  para o `.json`, rodado à mão.
- **Guardar empresa que já está no catálogo?** Contar aparições de quem já se
  conhece dá outra coisa: quais empresas de fato publicam vaga, contra as 26 mil
  que estão lá e talvez nunca publiquem nada. Isso é um segundo card, e talvez
  mais valioso que este.
- **ATS desconhecido vira suporte novo?** Descobrir `careerpuck` não serve de
  nada sem alguém escrever o adaptador. A fila precisa dizer *quanto* cada host
  desconhecido já rendeu, para a decisão ser sobre número.

## Critérios de aceite

**Anotar:**
- [ ] Vaga de empresa fora do catálogo gera registro com host, slug e origem
- [ ] Aparição repetida incrementa contador, não cria linha nova
- [ ] A captura não atrasa a busca — se falhar, a vaga entra do mesmo jeito
- [ ] Nenhuma chamada de rede a mais no caminho da busca

**Verificar (o cron da madrugada):**
- [ ] Cada descoberta é consultada no ATS real e classificada: confirmada, morta
      ou host desconhecido
- [ ] Confirmada guarda **quantas vagas** o slug rendeu — é o número que decide
- [ ] Ritmo limitado: uma consulta a cada N segundos, sem levar 429
- [ ] Uma descoberta que falha não trava a fila — volta na próxima rodada, como
      já faz o `busca-agendada.service.ts` (marca em `finally`)
- [ ] Não roda junto com a busca do usuário
- [ ] Desligado por interruptor, como toda funcionalidade da casa

**Promover:**
- [ ] Há como listar as descobertas por host, ordenadas por vagas rendidas
- [ ] Nada é gravado nos arquivos de `backend/data/ats/` sem decisão humana

## Por que pode não valer

Registrado agora para não ser descoberto depois:

**Se todas as descobertas forem quadro próprio de empresa** (`careers.empresa.com`),
o catálogo não ganha nada — cada uma exigiria um adaptador próprio, e é
exatamente o que o produto decidiu não fazer. Duas das três medidas são desse
tipo.

O caso que paga é o terceiro: **um ATS de verdade, desconhecido, com muitas
empresas**. Se depois de um mês de colheita não aparecer nenhum outro
`careerpuck`, este card vira um contador bonito sem uso — e é melhor saber disso
por medição do que por opinião.
