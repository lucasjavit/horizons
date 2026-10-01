# JOB-48 · Host multiempresa colapsa todas as empresas numa linha

**Estado:** a fazer — **achado medindo o JOB-40 (01/10/2026)**
**Tamanho:** P

## O defeito

`descobertas.ts:extrair()` so sabe tirar o slug do caminho quando o host esta
em `HOSTS_DE_ATS` (greenhouse, lever, ashby). Para qualquer outro host com
**varias empresas no mesmo dominio**, ele devolve `slug: ''` — e a chave da
fila e `(host, slug)`.

Resultado: todas as empresas daquele host viram **uma linha**, com o contador
somando as aparicoes de todas elas.

### Medido em 01/10, na tabela de producao

```
host                      linhas  aparicoes
jobs.smartrecruiters.com       1     18.560
mycareersfuture.gov.sg         1     15.153
europa.eu                      1      5.089
jobs.dayforcehcm.com           1      4.334
recruiting.paylocity.com       1      1.627
es.whatjobs.com                1      1.543
```

A linha do smartrecruiters tem `empresa: "Lifted (an Upwork Company)"` e
18.560 aparicoes — o nome e o da primeira vaga que chegou, e as outras
~18.559 sao de empresas diferentes empilhadas na mesma linha.

E o slug **estava na URL**:

```
jobs.smartrecruiters.com/LiftedanUpworkCompany/3743990014599426-backend-engineer-…
                         ^^^^^^^^^^^^^^^^^^^^^ jogado fora
```

## Por que isso importa mais do que parece

**O numero corrompido e justamente o que decide o trabalho.** O desenho do
JOB-37 diz, com estas palavras, que *"agrupar por host e onde esta o valor"* e
que a decisao de escrever um adaptador sai de **quanto aquele host ja rendeu**.

Com o colapso, o host multiempresa sempre parece o maior achado da fila —
porque ele soma todas as suas empresas — e o host de empresa unica sempre
parece pequeno. A lista ordenada por aparicoes esta mentindo em favor de quem
tem mais inquilinos, nao de quem tem mais vaga.

E `aparicoes` tambem e o que distingue "achado" de "acaso" no criterio de
aceite do JOB-37. Hoje, para esses hosts, ele nao distingue nada.

## O que fazer

`extrair()` precisa de uma segunda lista: **hosts multiempresa que nao sabemos
consultar, mas cujo slug esta no caminho**. Ela nao da `ats` (continua `null`,
porque nao sabemos ler a API), mas da `slug` — e com slug, cada empresa vira
sua propria linha.

Candidatos, com o que a medicao de 01/10 mostrou:

| Host | Forma da URL | Empresas hoje |
| --- | --- | ---: |
| `jobs.smartrecruiters.com` | `/<slug>/<id>-<titulo>` | 1 linha, 18.560 aparicoes |
| `jobs.dayforcehcm.com` | `/<...>/<slug>/...` | 1 linha, 4.334 |
| `recruiting.paylocity.com` | `/recruiting/jobs/.../<slug>` | 1 linha, 1.627 |
| `*.whatjobs.com` | agregador, nao ATS | 37 linhas, 8.540 |

**`whatjobs.com` e `mycareersfuture.gov.sg` sao caso diferente e provavelmente
nao devem entrar na fila** — sao agregador e portal de governo, nao ATS de
empresa. Uma lista de hosts a **descartar** na captura pode valer mais que uma
de hosts a destrinchar: eles nunca vao virar adaptador, e hoje ocupam as duas
primeiras posicoes da lista que alguem le para decidir.

## Criterios de aceite

- [ ] URL de host multiempresa conhecido gera uma linha **por empresa**, nao uma
      por host
- [ ] O `ats` continua `null` nesses casos — saber o slug nao e saber ler a API
- [ ] Agregador (whatjobs, portal de governo) nao entra na fila, ou entra
      marcado de um jeito que a lista de decisao nao o mostre como achado
- [ ] As linhas colapsadas que ja existem no banco sao recontadas ou
      descartadas — deixa-las convive com o dado novo e a lista continua
      mentindo
- [ ] Medido: a lista por host, depois da correcao, tem no topo um host que de
      fato vale adaptador

## O que NAO e este card

Escrever adaptador para smartrecruiters, workday ou gupy. Este card so conserta
**a medicao que decide** se vale escrever algum. Ver a secao "As 761
desconhecida" do [JOB-40](JOB-40-catalogo-aprende-com-o-freehire.md) para os
numeros por familia de ATS.
