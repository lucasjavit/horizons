# JOB-53 · A colheita muda para o rastreador

**Estado:** backlog (01/10/2026) — depende do [JOB-51](JOB-51-rastreador-rastreio-e-fila-de-envio.md)
**Tamanho:** M
**Pai:** [JOB-49](JOB-49-rastreador-de-vagas-arquitetura.md)

## Por quê

Hoje quem aprende empresa nova é o Horizons: a captura do JOB-37 anota as URLs
de toda busca (`anotar()` no `finally` de `busca.service.ts`), e o cron das 3h
verifica os slugs. Funcionou — 1.297 linhas, 457 confirmadas (JOB-40).

Mas esse aprendizado depende de **alguém buscar**. Quando a busca passar a ler
da cópia local ([JOB-52](JOB-52-busca-le-da-copia-local.md)), o freehire deixa
de ser consultado no caminho normal, e a fila para de encher.

E o catálogo passa a ser do rastreador. Se a colheita ficar no Horizons, o
dado nasce de um lado e é usado do outro, e seria preciso um canal de volta —
o que a arquitetura decidiu não ter.

## O que fazer

1. **A colheita vira um comando do rastreador**, por agenda: consulta a API
   do freehire por conta própria (não espera busca de usuário), extrai (ATS,
   slug) da URL e testa o slug na API do ATS.
2. **O que responde entra em `boards`** e passa a ser rastreado na passada
   seguinte.
3. **`descobertas.ts` e `verificacao-de-ats.service.ts` mudam de casa**, com
   os testes que o JOB-40 escreveu.
4. **A captura sai de `busca.service.ts`** quando a do rastreador estiver
   provada. Não antes.

## O que carregar junto

- **O [JOB-48](JOB-48-host-multiempresa-colapsa-numa-linha.md) vem antes ou
  junto.** O extrator devolve `slug: ''` para host multiempresa
  (smartrecruiters: 1 linha, 18.560 aparições). Mudar o código de casa sem
  corrigir leva o defeito junto.
- **`desconhecida` cobre dois casos** (705 host ilegível + 56 slug que deu
  404). Ao migrar, separar.
- **As regras do freehire continuam valendo**: `User-Agent` do projeto,
  checar `meta.ignored_params` a cada chamada, respeitar
  `X-RateLimit-Remaining` (JOB-39).
- **A promoção para `empresas.json` é humana** (JOB-37). Com o catálogo no
  banco do rastreador, decidir se o arquivo curado continua existindo ou vira
  só a carga inicial.

## Critérios de aceite

- [ ] Uma rodada da colheita, sem nenhuma busca de usuário, acrescenta boards
- [ ] Board novo aparece com vagas na passada de rastreio seguinte
- [ ] **Medido:** boards novos por rodada, e vagas que eles trouxeram
- [ ] Slug que não responde não entra
- [ ] freehire fora do ar: a colheita falha sem derrubar o rastreio
- [ ] A captura antiga foi removida do Horizons, e a busca não mudou
- [ ] Os testes do extrator migraram e passam

## O teste que decide se valeu

O mesmo do JOB-40: desligar o freehire e ver se o rendimento se sustenta. A
diferença é que agora a colheita não depende de tráfego.
