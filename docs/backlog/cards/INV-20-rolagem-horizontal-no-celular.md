# INV-20 · `/invoice` ganha rolagem horizontal no celular com campo longo

**Estado:** bug aberto
**Tamanho:** P
**Achado medindo o INV-18 (05/10/2026)**, ao conferir a prévia a 390px. Não é
da prévia: o resultado é o mesmo com e sem a correção dela.

## Por quê

A 390px a página inteira passa da largura da tela, e o formulário fica cortado
à direita — a pessoa precisa arrastar de lado para ver o fim dos campos.

## Como reproduzir

Chromium, viewport 390×900, `/invoice`, rascunho em
`horizons.invoice.draft.v1`:

| rascunho | `documentElement.scrollWidth` |
| --- | --- |
| vazio | 390 (certo) |
| endereços de ~170 caracteres, campos de pagamento curtos | 447 |
| o mesmo, mais `Invoice #` de 43 caracteres e um link de 182 sem espaço | **704** |

## Causa

**Não confirmada.** O que se viu: com o rascunho longo, o `<span
class="ml-auto truncate text-xs">` que resume o `Invoice #` no cabeçalho de uma
seção recolhível mede 260→614px, e todos os campos do formulário vão a 671px.
`truncate` só corta se o pai puder encolher; a suspeita é um item de flex/grid
sem `min-w-0` em `frontend/src/pages/InvoicePage.tsx`. Falta isolar qual.

## Critérios de aceite

- [ ] A 390px, `scrollWidth` da página é 390 com qualquer conteúdo nos campos
- [ ] O resumo da seção recolhida corta com reticências em vez de empurrar

## Teste

O jsdom não faz layout, então isto não se prova no `npm test` de hoje. A medida
acima foi feita com Playwright; a correção precisa decidir onde esse tipo de
checagem mora.
