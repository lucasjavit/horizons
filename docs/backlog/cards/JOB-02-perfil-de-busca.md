# JOB-02 · Perfil de busca e agrupamento

**Estado:** backlog
**Tamanho:** M

## Por quê

Sem perfil não há o que buscar. É o que a pessoa cadastra uma vez, e o que o
job de 50 minutos lê para saber o que procurar.

## O que faz

A pessoa sobe o CV e/ou preenche filtros. **O currículo é um filtro a mais, o
mais poderoso deles** — não um caminho separado. Depois do upload, os campos
aparecem **preenchidos com o que a IA leu, e editáveis**.

Isso resolve os três caminhos que o stakeholder pediu, de uma vez:

- **só CV** → sobe, salva, ignora os campos preenchidos
- **CV + filtros** → sobe, corrige o que veio errado, adiciona salário mínimo
- **só filtros** → ignora a caixa de upload

E, mais importante: deixa a pessoa **ver o que o sistema entendeu do CV dela**.
Um CV lido errado que produz busca ruim, sem ela ver o porquê, é o pior desfecho.

## Do CV, só o perfil extraído

Guarda `{ stack, senioridade, anos }`. **Nunca o arquivo, nunca o texto bruto.**

Some o CPF, o endereço e o telefone — e isso importa porque o guard só passou a
ter dono agora. Token se revoga; CPF não.

O arquivo é processado em memória e descartado. A tela avisa, antes do upload,
que o conteúdo é enviado ao provedor de IA.

## Agrupamento

O campo `grupo` é a assinatura dos filtros normalizados
(`senioridade|stack ordenada|regiao`). Perfis com a mesma assinatura leem as
mesmas vagas — **uma rodada serve a todos**.

Foi decisão do stakeholder, e é o que impede N perfis virarem N buscas a cada
50 minutos.

## Critério de aceite

- [ ] Subir CV preenche os campos, editáveis, antes de salvar
- [ ] Dá para cadastrar só com filtros, sem CV
- [ ] Depois de salvar, nenhum arquivo no servidor
- [ ] O que fica guardado é stack/senioridade/anos, não o texto do CV
- [ ] Dois perfis com filtros iguais recebem o mesmo `grupo`
- [ ] A tela avisa que o CV vai para o provedor de IA, antes do upload

## Casos de borda

- PDF que é imagem escaneada: **recusa com mensagem**, nunca inventa perfil
- PDF protegido por senha, DOCX corrompido: erro explicado
- Arquivo acima de 5 MB: recusado no backend, não só no front
- Arquivo que não é CV: a IA classifica, e a pessoa vê o que ela entendeu

## Depende de

- PLT-02 (perfil precisa de dono)


---

# O perfil alimenta o prompt (13/08/2026)

O prompt de busca (ver [PLT-04](PLT-04-crud-de-prompts.md)) tem dois espaços
que este card preenche:

```
Resume:
{{RESUME}}

Filters:
{{FILTERS}}
```

E ele já trata os três casos que o stakeholder pediu, por conta própria:

- **Case A — só CV**: identifica perfil, famílias de cargo, senioridade
- **Case B — CV + filtros**: o CV qualifica, os filtros restringem, e **filtro
  explícito vence o CV** ("resume information is used for qualification, not to
  override explicit filters")
- **Case C — só filtros**: não inventa qualificação nenhuma

Isso confirma o desenho deste card: os campos vêm preenchidos pelo CV e
**editáveis** — quando a pessoa corrige um campo, ela está exercendo o Case B.

## O formato dos filtros

O prompt espera JSON com `job_titles`, `keywords`, `exclude_keywords`,
`locations`, `remote`, `employment_types`, `seniority`, `salary_min`,
`salary_max`, `currency`, `posted_within_days`, `companies`, `industries`,
`technologies`, `visa_required`, `timezone` — todos opcionais.

O `JobProfile.filtros` guarda exatamente esse formato, e a assinatura do
`grupo` sai dos campos que mais restringem a busca: senioridade, tecnologias
ordenadas e região.

## O que NÃO vai para o prompt

`{{RESUME}}` recebe o **perfil extraído**, não o texto do CV. Some o CPF, o
endereço e o telefone antes de qualquer coisa sair daqui — o CV inteiro dentro
do prompt viajaria para o provedor de IA com dado pessoal junto.
