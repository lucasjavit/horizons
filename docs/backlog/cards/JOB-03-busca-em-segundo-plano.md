# JOB-03 · A busca roda sozinha a cada 50 minutos

**Estado:** backlog
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
