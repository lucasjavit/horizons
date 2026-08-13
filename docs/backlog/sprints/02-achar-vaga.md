# Sprint 02 · Achar vaga

**De:** 13/08/2026 · **Até:** 27/08/2026
**Objetivo:** dar dono às contas e fazer a busca de vagas rodar sozinha.

## Compromisso

| Card | Título | Tam. | Estado |
| --- | --- | --- | --- |
| [PLT-02](../cards/PLT-02-login-com-google.md) | Login com Google | M | pronto para fazer |
| [PLT-03](../cards/PLT-03-migrar-contas-existentes.md) | Migrar contas do guard antigo | P | pronto para fazer |
| [JOB-01](../cards/JOB-01-provar-o-firecrawl.md) | Provar o Firecrawl | P | pronto para fazer |
| [JOB-02](../cards/JOB-02-perfil-de-busca.md) | Perfil de busca e agrupamento | M | backlog |
| [JOB-03](../cards/JOB-03-busca-em-segundo-plano.md) | A busca roda sozinha | M | backlog |

## A ordem importa, e não é a numérica

**JOB-01 vem antes de tudo do JOB**, e é um card que pode matar a feature.

O `tech-lead` executou o Firecrawl na reunião e mediu: o `search` devolve
Indeed e Glassdoor em vez de vagas, e a extração real veio com **47% das vagas
sem URL** e o salário preenchido com *"Mais de 100 candidatos"*.

Se sobrarem duas vagas boas por busca, a feature precisa ser repensada. Saber
isso antes de construir tela e persistência é a diferença entre um dia perdido
e uma semana.

**PLT-02 e PLT-03 andam juntos.** Trocar o guard sem migrar as contas deixa o
progresso das 75 aulas órfão.

## Fora desta sprint

- **JOB-04 e JOB-05** (tela e salvar) — dependem do JOB-03 ter vaga para mostrar
- **E-mail de aviso** — decidido: entra quando houver vaga sendo encontrada de
  verdade
- **Clientes salvos na invoice** — ninguém pediu, e o gerador funciona sem

## O que esta sprint carrega da anterior

A sprint 01 ensinou três coisas que valem aqui:

- **A separação entre quem faz e quem testa pagou.** O `tech-lead` deu um card
  como pronto testando com cliques sintéticos; o `qa` testou com cliques
  humanos e o bug voltou.
- **O QA achou mais bugs que o card original tinha** — incluindo um mais grave
  que o que estava sendo corrigido.
- **Três correções falharam por confiar no build em vez do navegador.**

Nesta sprint o risco equivalente é confiar no que a IA afirma. O card JOB-03
carrega as quatro defesas contra isso.
