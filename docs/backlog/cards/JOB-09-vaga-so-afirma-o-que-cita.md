# JOB-09 · A vaga só afirma o que consegue citar

**Estado:** feito (17/08/2026)
**Tamanho:** P

## Por quê

A auditoria de 17/08 abriu as páginas de origem das 6 vagas que a busca tinha
devolvido e conferiu campo a campo. Está em
[docs/design/JOB-09-auditoria-das-vagas.md](../../design/JOB-09-auditoria-das-vagas.md).

**As 6 tinham pelo menos um campo errado.** A causa raiz — todas as 8 URLs
eram página de listagem, não de vaga — virou o [JOB-10](JOB-10-consultas-dirigidas.md)
e foi corrigida na origem.

Este card trata o que **sobrevive à correção da consulta**, porque não é
problema de entrada e sim de código: o pipeline aceitava afirmação sem prova.

## O achado que justifica o card

Elastic na tela com:

```
elegivelBrasil: false
elegibilidadeTrecho: null
```

A tela dizia a uma pessoa que aquela empresa **não a contrataria morando no
Brasil**, sem nada por trás. A página nunca falou de contratação no Brasil.

É o pior tipo de erro que este produto pode cometer: não é uma vaga faltando na
lista — é uma vaga sendo descartada por quem procura, por causa de uma
afirmação que o sistema inventou.

Agravante medido na busca2: a Robert Half voltou com
`elegibilidadeTrecho: "nao mencionado"`, e o código **aceitou aquilo como
citação**. A ausência de prova, redigida, passou por prova.

## O que foi feito

Em `backend/src/jobs/busca.service.ts`:

- `elegibilidade(j)` decide os dois campos **juntos**. Sem citação válida, o
  par inteiro é `null` — inclusive a afirmação positiva, porque "aceita
  brasileiro" sem base faz alguém se candidatar à toa, que é o mesmo erro
  espelhado.
- `NAO_E_CITACAO` barra as frases que o modelo escreve quando a página não diz
  nada: `nao mencionado`, `not specified`, `n/a`, `unknown` e variantes.

É a mesma disciplina que `salaryTrecho` já seguia desde o JOB-08 (número sem
trecho vira `null`). A elegibilidade tinha ficado de fora.

## Critérios de aceite

- [x] Afirmação de elegibilidade sem trecho vira `null`, nunca `false`
- [x] `"nao mencionado"` e equivalentes não contam como citação
- [x] Busca real: nenhuma vaga com `elegivelBrasil` preenchido e trecho vazio
- [x] Quem tem restrição real continua mostrando, com o texto da página

## Medido depois (busca real, 17/08)

8 vagas, **zero afirmações sem citação**. As que afirmam, citam:

| Empresa | elegivelBrasil | Trecho da página |
| --- | --- | --- |
| Real | `false` | "Candidates must be based in the United States…" |
| Pinterest | `false` | "US based applicants only" |
| Outras 6 | `null` | página não fala do assunto |

Os dois `false` são restrições reais, corretamente reportadas — e agora
confiáveis, porque o trecho aparece sob o chip na tela.

## O que este card NÃO resolve

Está tudo no [JOB-08](JOB-08-prompt-de-busca.md), sem dono ainda:

- **Os sete níveis de elegibilidade.** Hoje "worldwide" e "contrata na LATAM"
  viram o mesmo `true`. O booleano é grosseiro demais para a pergunta.
- **Dedup** — a mesma vaga em dois ATS apareceria duas vezes.
- **`postedAt`** volta `null` em todas: página de ATS não imprime data. Não é
  regressão; é o campo dizendo a verdade. O filtro `posted_within_days`
  continua sem base para funcionar.
