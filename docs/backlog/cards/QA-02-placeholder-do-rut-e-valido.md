# QA-02 · O placeholder do RUT chileno e um RUT valido

**Estado:** aberto (01/09/2026)
**Tamanho:** P — troca de uma string
**Achado por:** a suite do QA-01, em `backend/src/perfil/documentos.spec.ts`

## O que se esperava

O campo `exemplo` de `Pais` existe para virar `placeholder` na tela, e o
comentario dele e explicito:

> ⚠️ Deliberadamente nao e um documento valido: um placeholder que passa na
> validacao parece um valor ja preenchido. Na verificacao de 31/08 o exemplo
> do Brasil era um CPF valido de verdade e foi confundido com um vazamento do
> documento salvo.

Ou seja: **nenhum exemplo pode passar na propria validacao do pais**.

## O que acontece

`validarDocumento('CL', '00.000.000-0')` devolve `null` — **aceito**.

O exemplo do Chile e um RUT valido pela especificacao do digito verificador,
e nao por acaso da implementacao: com o corpo `00000000`, a soma ponderada da
0, `11 - (0 % 11)` da 11, e o resto 11 mapeia para o DV `'0'` — que e
exatamente o digito do placeholder. Conferido por implementacao de referencia
independente (Python), escrita a partir da especificacao publica.

E o **mesmo defeito** que foi corrigido no Brasil em 31/08, sobrevivendo em
outro pais: quem abre a tela do perfil com o pais Chile ve um campo cujo
conteudo de exemplo passaria na validacao, e a leitura natural e "ja tem um
documento salvo aqui".

## Como reproduzir

```
cd backend && npx jest src/perfil/documentos
```

O caso `o catalogo de paises › o exemplo de CL nao e um documento valido`
falha, com `Expected: false / Received: true`. Os outros tres paises com
digito verificador (BR, AR, MX) passam — o defeito e so do Chile.

Direto, sem jest:

```
validarDocumento('CL', '00.000.000-0')  // null, deveria ser mensagem de erro
```

## O teste

Ja esta no repositorio, e **falha de proposito** — marcado com
`it.failing` e o link para este card, conforme a regra do QA-01: o teste entra
antes da correcao, para que o defeito nao passe despercebido nem seja
corrigido em silencio.

Quando o exemplo for trocado, trocar `it.failing` por `it.each` de volta e o
teste passa a proteger os quatro paises.

## A correcao provavel

Trocar o `exemplo` do Chile por um valor com DV **errado**, mantendo o formato
que ensina a mascara. `00.000.000-1` serve: mesmo formato, e o DV 1 nao bate
com o corpo 00000000 (o correto e 0).

Vale conferir na mesma leva se algum outro exemplo com verificador nasce
valido quando um pais novo entrar na lista — o teste ja cobre os quatro
atuais.

## Criterios de aceite

- [ ] `validarDocumento('CL', <novo exemplo>)` devolve mensagem de erro
- [ ] O novo exemplo continua ensinando o formato (pontos e traco no lugar)
- [ ] O teste volta a `it.each` e passa para BR, AR, CL e MX
- [ ] A tela do perfil com Chile escolhido mostra o novo placeholder
