/**
 * O estado de interação dos botões de ícone.
 *
 * **Hover e clique precisam de resposta visível.** Sem ela, um ícone cinza
 * parado não parece clicável — e no toque não há hover nenhum, então o
 * `active:` é o único retorno de que o gesto pegou.
 *
 * A cor sai de `color-mix` sobre o token, e não de um verde escrito à mão —
 * assim ela acompanha o tema sem uma segunda paleta para manter.
 *
 * **Mora num arquivo só de constante, e não na `BarraDeBusca`** (30/08). O
 * `BotaoGoogle` do cabeçalho precisava dela, e importar da barra arrastava
 * `SeletorDeLocal`, `SinoDeAvisos` e o popover para o bundle principal:
 * **433 KB → 460 KB**, medido, estourando o teto de 440 do `qa-rapido.py`.
 * Uma string não pode custar 27 KB.
 */
export const BOTAO_ICONE =
  'inline-flex shrink-0 items-center justify-center rounded-md transition-colors ' +
  'hover:bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] ' +
  'hover:text-[var(--brand)] ' +
  'active:bg-[color-mix(in_srgb,var(--brand)_26%,transparent)] ' +
  'focus-visible:text-[var(--brand)]'
