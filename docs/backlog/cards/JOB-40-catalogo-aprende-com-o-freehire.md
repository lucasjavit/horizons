# JOB-40 · O catálogo aprende com o freehire

**Estado:** aberto (26/08/2026)
**Tamanho:** M

## Por quê

O [JOB-39](JOB-39-freehire-como-motor-de-busca.md) ligou o freehire e ele virou
o primeiro motor da busca. Resolveu o problema de hoje e **criou um de amanhã**:
a melhor fonte de vagas do produto agora é o servidor de outra pessoa, de graça,
sem contrato.

O card do JOB-38 registra o risco e o interruptor. O que ele **não** resolve é
o que fica se o freehire fechar: nada. Volta tudo ao catálogo de 526 empresas.

## A oportunidade que a medição mostrou

Na amostra de 26/08, nas 100 primeiras vagas de `countries=br`: **63 empresas
distintas, e 60 fora do nosso `empresas.json`.** Só `ciandt`, `clara` e
`quintoandar` coincidiam.

E as fontes por trás são ATS que já sabemos ler — lever, greenhouse, workable,
ashby, comeet, smartrecruiters, personio — mais os brasileiros que não temos:
**gupy, inhire, solides**.

Ou seja: o freehire não é só um motor de busca. É um **descobridor de
empresas**, e a descoberta é a parte que pode virar nossa para sempre.

## O que fazer

Toda vaga que o freehire devolve carrega `company_slug` e a `url` do ATS real.
Dá para extrair dali o par (ATS, slug) e conferir contra o catálogo:

1. Da `url` da vaga, extrair o ATS e o slug (`jobs.lever.co/**acme**/…`)
2. Descartar o que já está no `empresas.json`
3. Verificar que o slug responde na API pública daquele ATS
4. Entrar no catálogo, com a origem anotada

Os passos 3 e 4 **já existem**: é o `VerificacaoDeAtsService` do
[JOB-37](JOB-37-catalogo-aprende-sozinho.md). O que muda é de onde vem a fila.

## Por que isso é diferente do JOB-37

O JOB-37 tentou o mesmo alimentando a fila com o que a **própria busca** já
achava — e a medição registrada lá mostrou que a hipótese era falsa: a busca
quase não trazia host desconhecido, porque só consultava empresas conhecidas. A
fila nascia vazia por construção.

**O freehire quebra esse círculo.** Ele não está preso ao nosso catálogo, então
o que ele traz é majoritariamente novo — 60 em 63 na amostra, contra o que o
JOB-37 media.

O mecanismo do JOB-37 está pronto e funcionando. Faltava a fonte.

## Critérios de aceite

- [ ] Uma busca pelo freehire alimenta a fila de descobertas com os slugs novos
- [ ] Medido: quantas empresas novas entram no catálogo depois de N buscas
- [ ] Medido: **quantas vagas o motor de ATS passa a achar** por causa delas —
      é a métrica que importa, não o tamanho do catálogo
- [ ] Os ATS brasileiros (gupy, inhire, solides) são lidos, ou fica escrito aqui
      por que não valeu
- [ ] Desligar o freehire não quebra a colheita do que já foi aprendido

## O teste que decide se valeu

Desligar o freehire depois de N semanas e comparar o rendimento do motor de ATS
com o de antes. Se não subir, o catálogo cresceu sem servir para nada — e isso
precisa ser dito no card, como o JOB-37 disse.
