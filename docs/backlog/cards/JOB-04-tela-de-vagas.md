# JOB-04 · A tela das vagas encontradas

**Estado:** backlog
**Tamanho:** M

## Por quê

O valor da feature não é "buscar vagas" — é **não ler as 40 que não serviam**.
A tela é onde isso se prova ou se perde.

## O cartão

Responde as quatro perguntas que decidem o clique, **sem a pessoa abrir a vaga**:

1. **Quanto paga** — em USD/EUR, faixa anual
2. **Posso ser contratado daqui** — "contrata PJ no Brasil" / "só CLT local,
   exige visto". **É a pergunta que mata 70% das vagas e quase nenhum site
   responde na listagem** — é o dado mais valioso da tela
3. **O fuso me quebra** — "4h de overlap (PST)" é diferente de "6h em CET"
4. **Ainda está aberta** — publicada há 2 dias ou há 9

E diz **o que falta** no perfil. Um match que só elogia é propaganda; dizer
"pedem Rust, você não tem" é o que faz confiar no resto.

O **domínio de origem** aparece — busca por IA erra, e mostrar a fonte deixa a
pessoa calibrar a confiança sozinha.

## Extraído versus inferido

"USD 140k (do anúncio)" e "provavelmente aceita PJ" **não podem ter a mesma
tipografia**. Se aparecem iguais, viram a mesma coisa aos olhos — e é assim que
uma alucinação passa por fato.

O trecho de origem do salário e da elegibilidade fica disponível sob demanda.
Isso é verificável, não é confiança.

## Compatibilidade em rótulo, não em percentual

**Forte / Boa / Parcial**, não "92%". Um número percentual de IA sugere uma
precisão que o pipeline não tem.

## O que reusar da invoice

- `Recolhivel` — o painel recolhe no celular quando a lista carrega
- `States.tsx` — Loading / Error / Empty
- o padrão de `Field.tsx`, copiado para `components/vagas/` (não promovido a
  global ainda)
- o par **painel à esquerda / resultado à direita**, com `sticky top-[57px]`

**Não** reusar o acordeão numerado: na invoice há 15 campos em sequência, aqui
há 4 ou 5 opcionais e sem ordem. Numerar sugere uma sequência que não existe.

## Idioma

**Em português.** O usuário é o dev brasileiro; a invoice é que mira o público
global.

## O estado vazio

É a primeira tela de todo mundo, e a única chance de explicar que a busca roda
sozinha. Precisa dizer **explicitamente** que a pessoa será avisada quando
houver vagas — foi decisão do stakeholder que ninguém espera olhando.

## Critério de aceite

- [ ] Lista as vagas não vencidas do grupo da pessoa
- [ ] O cartão responde as quatro perguntas
- [ ] Vaga sem salário mostra "não informado", nunca um número
- [ ] Extraído e inferido são visualmente distintos
- [ ] O trecho de origem do salário fica acessível
- [ ] Estado vazio explica que a busca roda sozinha
- [ ] Acessibilidade: label em todo campo, alvo ≥24px, erro por borda +
      `aria-invalid` + texto
- [ ] Os dois temas

## Depende de

- JOB-03 (ter vaga para mostrar)
