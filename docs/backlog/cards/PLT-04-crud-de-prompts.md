# PLT-04 · Config vira área de admin, com CRUD de prompts

**Estado:** backlog
**Tamanho:** M
**Decisão do stakeholder (13/08/2026):** "o config vai ser do admin, onde vão
ter os parâmetros, então vai ficar no config onde vai ter um CRUD de prompts
para buscar vagas."

## Por quê

O prompt de busca é o que decide a qualidade da feature inteira. O JOB-01
provou isso com número: **a mesma página, com prompt explícito, saiu de 47% de
vagas sem URL para 0%, e de "Mais de 100 candidatos" no campo salário para
`null` correto.**

Calibrar prompt é trabalho contínuo — e fazer isso por deploy é lento demais
para algo que muda de acordo com o que os sites de vaga devolvem.

## O que faz

A aba **Config** deixa de ser só tokens de API e vira **área de administração**:

- listar, criar, editar, apagar prompts de busca
- marcar qual está ativo
- restaurar o padrão que vem no código
- os tokens de API (PLT-01) continuam lá

## O prompt é global, e é isso que salva o agrupamento

O texto do prompt é **um só, editado pelo admin**. O que varia entre pessoas
entra por espaços que a aplicação preenche:

```
Resume:
{{RESUME}}

Filters:
{{FILTERS}}
```

Se cada usuário escrevesse o próprio prompt, dois perfis nunca seriam iguais e
**o agrupamento do JOB-02 morreria** — N perfis virariam N buscas a cada 50
minutos.

## O prompt base

O stakeholder forneceu um prompt de agente de busca já pronto, com:

- prioridade `Accuracy > Relevance > Freshness > Quantity`
- três casos de entrada: só CV, CV + filtros, só filtros
- expansão de títulos ("Senior Java" → Backend, Staff, Distributed Systems…)
- classificação de elegibilidade remota em sete níveis, com regra explícita de
  **não assumir que "remote" significa worldwide**
- `verification_status: "unverified"` em vez de descartar o não-verificável
- 17 regras críticas, incluindo "never invent salary / URL / remote eligibility"
- saída em JSON estruturado

Ele já cobre três dos quatro achados do JOB-01. Vai versionado no código como
padrão, e o CRUD permite ajustá-lo sem deploy.

## Duas regras a acrescentar, medidas no JOB-01

1. **URL de signup não é link de candidatura.** O Himalayas devolve
   `himalayas.app/signup/talent?redirect=…` como página de aplicação. É
   cadastro no agregador, não a vaga. Descartar `/signup`, `/login`,
   `/register`.
2. **Pedir a evidência junto do valor.** Para salário e elegibilidade, guardar
   o trecho literal da página. Foi o que tornou a afirmação verificável no
   teste real.

## Critério de aceite

- [ ] Config exige `role = ADMIN`
- [ ] Listar, criar, editar, apagar prompt
- [ ] Um prompt ativo por vez
- [ ] Restaurar o padrão do código
- [ ] Editar não quebra a busca em andamento
- [ ] Prompt sem `{{RESUME}}` nem `{{FILTERS}}` avisa antes de salvar
- [ ] Quem não é admin não vê a aba nem acessa a rota

## Depende de

- **PLT-02** — sem `role` no usuário não há admin. O guard do arguição já traz
  o `@AdminOnly`, então o custo aqui é pequeno **depois** que o login existir.

## Observação

Hoje a Config guarda os tokens de API sem dono real, e o risco está escrito no
controller. Este card e o PLT-02 juntos resolvem isso: a área passa a exigir
admin de verdade.
