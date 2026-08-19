# JOB-19 · O produto tem dois lados

**Estado:** decidido, não implementado (18/08/2026)
**Tamanho:** G — vira vários cards

## A virada de escopo

Até 18/08 o produto era "vaga internacional para **dev brasileiro**". O
stakeholder ampliou:

> "Não é só brasileiros que são meus alvos, são os países emergentes que têm mão
> de obra barata, pois depois disso tudo eu vou fazer o inverso, a empresa vai
> poder postar sua vaga ou contratar alguém do meu catálogo de usuários
> cadastrados."

São **duas** mudanças, e a segunda é maior que a primeira.

## 1. O alvo é país emergente, não Brasil

Medido no catálogo completo (1.953 empresas):

| País | Empresas |
| --- | ---: |
| **Índia** | **324** |
| México | 137 |
| **Brasil** | 118 |
| Polônia | 108 |
| Indonésia | 66 |
| Filipinas | 62 |
| Colômbia | 59 |
| Malásia | 58 |
| Romênia | 45 |
| África do Sul | 44 |

**501 empresas contratam em ao menos um país emergente** — contra 118 se o
alvo fosse só o Brasil. O mercado é 4× maior.

**Consequência imediata, já aplicada:** o filtro de países de 18/08 (que
reduzia o catálogo a 866 e removia a Índia) foi **desfeito**. O
`empresas.yaml` voltou às 1.953. O `scripts/filtrar-empresas.py` continua no
repositório, marcado como fora de uso.

**Consequência ainda não aplicada:** `elegivelBrasil` precisa virar
`paisesElegiveis[]`. Hoje o campo pergunta "aceita quem mora no Brasil?" —
precisa perguntar "quais países esta vaga aceita?". Ver
[JOB-08](JOB-08-prompt-de-busca.md), que já pedia os sete níveis de
elegibilidade por outro motivo.

## 2. O lado B: a empresa é cliente

Hoje o produto serve o candidato. A fase 2 serve a empresa:

| | Lado A — candidato | Lado B — empresa |
| --- | --- | --- |
| Dor | não sabe quem contrata do país dele | não sabe onde achar talento, nem se pode contratar |
| Paga por | achar vaga + ser avisado | acesso ao catálogo de candidatos |
| Ticket | R$ 19–29/mês | R$ 500–2.000/vaga |
| Estado | motores rodando | **não existe** |

**O lado A constrói o ativo que o lado B compra.** Sem massa de candidatos
cadastrados, não há o que vender. Isso define a ordem: A primeiro, sempre.

## 3. O que isso faz com a retenção

O problema: **o produto funciona quando o usuário vai embora.** Ele acha a
vaga, é contratado, cancela.

A ideia descartada foi reduzir a porção — mandar menos vagas por menos
dinheiro. Ela falha por dois motivos: transforma o melhor momento da relação
(a pessoa conseguiu emprego) em entrega pior, e **o sistema não sabe que ela
foi contratada** — ela não avisa.

### A inversão: quem foi contratado recebe outra coisa

Não menos vaga — **outro produto**. Ele parou de precisar de vaga e passou a
precisar de:

- emitir invoice todo mês
- saber se o câmbio compensa receber agora
- saber quanto o mercado paga para o cargo dele hoje ("a faixa da sua função
  subiu 8% em 6 meses")
- continuar de olho no mercado sem procurar ativamente — **uma vaga por mês,
  das boas**, é outra coisa que trinta

Mesmo preço, ou até menor, mas por **valor diferente, não por porção menor**.
A invoice deixa de ser isca e vira o produto de quem já chegou.

### A versão mínima: o botão "consegui a vaga 🎉"

Sem plano novo, sem cobrança nova. Um botão no e-mail. Quem clica:

- passa a receber **uma vaga por mês** em vez de toda semana
- vê a **invoice subir ao topo** do produto
- entra no catálogo do lado B como profissional **empregado** — que é
  justamente o perfil que empresa quer roubar

E o Horizons ganha a métrica que importa mais que qualquer outra:
**quantas pessoas ele empregou.** É o número que vende o produto para o
próximo usuário e para o lado B.

**Sobre baixar o preço:** não baixar de início. Quem vai cancelar cancela, e
desconto na saída raramente segura. Primeiro descobrir se o plano de invoice
se sustenta sozinho.

## 4. O diferencial que ninguém tem

**Vaga em empresa estrangeira, não em empresa local.** Medido: das 866
empresas do filtro antigo, **206 contratam na LATAM e também em país de moeda
forte** (paga em dólar/euro); só 17 são exclusivamente LATAM e 4
exclusivamente Brasil.

> "Outra coisa que quero fazer é uma busca por LATAM, mas não seja para
> trabalhar para empresas brasileiras, nunca vi isso no mercado."

Ele não viu porque quem constrói job board é americano, e para eles LATAM é
região de custo — ninguém segmenta "empresa estrangeira que contrata aqui"
contra "empresa local". Para o usuário, essa é **a** distinção: uma paga em
dólar, a outra em real.

A regra é implementável com o dado atual, e generaliza para qualquer
emergente: contrata no país da pessoa **e** em país de moeda forte.

## Critérios de aceite

- [x] `empresas.yaml` volta às 1.953 empresas, com Índia incluída
- [ ] `elegivelBrasil` vira `paisesElegiveis[]`
- [ ] O filtro "empresa estrangeira" existe na tela e é testável
- [ ] O botão "consegui a vaga" muda a cadência de e-mail
- [ ] Existe métrica de quantas pessoas foram contratadas

## O que fica fora por enquanto

O lado B inteiro. Ele depende de massa de candidatos que ainda não existe, e
construir marketplace sem os dois lados é a forma clássica de não ter nenhum.

## O que ainda não foi medido, e decide o tamanho

**Quantas das 27.725 vagas do catálogo aceitam candidato de país emergente?**
É grátis de medir, usa o que já está no repositório, e é a única pergunta que
pode dizer "não construa isso". 50 vagas = público pequeno; 500 = negócio.
