# JOB-21 · Quantas vagas do catálogo aceitam brasileiro

**Medido em 19/08/2026, contra as APIs reais.**

Era a pergunta que eu vinha dizendo ser "a única que pode dizer não construa
isso". A resposta chegou, e ela redefine o papel do catálogo.

## O número

```
25 empresas do catálogo que DECLARAM contratar no Brasil
1.961 vagas abertas
   36 com Brasil/LATAM no campo de local
    1 de engenharia
```

**Uma vaga de engenharia em 1.961.**

## O que as 36 são

| Empresa | Vaga | Local |
| --- | --- | --- |
| Turing | Community Manager | São Paulo, Brazil |
| Turing | Customer Support Manager | Brazil |
| Adyen | Project Operations Manager | LATAM |
| Xsolla | Junior / Integration Manager | Sao Paulo, Brazil |
| PlayStation | Senior Commercial Manager | Brazil, Sao Paulo |

O padrão é inequívoco: **essas empresas contratam no Brasil para funções
locais** — vendas, suporte, operações, marketing. A exceção foi a Epic Games,
com 14 vagas de engenharia em Porto Alegre — que são **presenciais**, não
remotas para o exterior.

## Por que `hiring_countries` enganou

O campo mede **onde a empresa tem gente**, e não **onde ela contrata para
trabalho remoto**. Adyen tem escritório em São Paulo, então "Brazil" aparece —
mas suas 222 vagas de engenharia são para Amsterdam.

Isso já tinha aparecido em 18/08 (771 vagas, 4 com local BR/LATAM) e eu
registrei como ressalva. Agora está medido com precisão: **não é ressalva, é a
regra.**

## O que isso NÃO significa

**As vagas existem.** O motor de IA achou 15 em 18/08, todas com elegibilidade
citada: Zapier, Hopper, RevenueCat, Resend, Remote, Swile, LatamCent, PadSplit.

Elas simplesmente **não estão neste catálogo**. Quem contrata brasileiro para
engenharia remota é outro perfil de empresa:

- remote-first de nascença (Remote, Zapier, Resend)
- staffing/outsourcing focado em LATAM (Turing, LatamCent, Truelogic)
- startup pequena sem escritório em lugar nenhum

O catálogo do look4job é de **empresa grande com operação global** — que é
exatamente quem tem escritório no Brasil e contrata local.

## A consequência para o produto

O ATS **não substitui** a busca por IA; ele resolve um problema diferente.

| Motor | Serve para |
| --- | --- |
| **ATS** | volume, salário estruturado, custo zero — vaga em qualquer lugar |
| **IA** | achar quem aceita candidato de país emergente |

Manter os dois não é redundância: são perguntas diferentes. E o filtro do
[JOB-23](../backlog/cards/JOB-23-filtro-moeda-forte.md) precisa mudar de
critério — `contrata_em` não prediz elegibilidade de vaga remota.

## O que fazer com o catálogo

Duas hipóteses, nenhuma testada:

1. **Filtrar por perfil de empresa**, não por país declarado: empresa sem
   escritório físico, ou com "remote" no nome/descrição, teria taxa melhor.
2. **Usar os 27 mil slugs brutos** em vez das 1.953 curadas. A curadoria
   otimizou para "empresa conhecida", que é o oposto do que interessa aqui.

## O que continua verdade

O JOB-20 não fica inválido: **46 vagas por R$ 0 em 36s** continua melhor que
7 por 42 créditos. E a elegibilidade por campo resolve **95,6%** sem IA — a
medição desta sessão, acima dos 86,4% estimados.

O que muda é a expectativa: o ATS é o motor de **volume**, não o de
**elegibilidade**.
