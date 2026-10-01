/**
 * Cores que não cabem num token CSS.
 *
 * A regra da casa é que cor vem de `var(--token)` (CLAUDE.md). Esta é a
 * exceção, e ela tem motivo: `WARN_INK` precisa do MESMO valor em dois tons
 * — um para fundo claro, outro para o escuro — e `light-dark()` resolve isso
 * no navegador sem uma segunda declaração de tema para manter.
 *
 * **Mora num arquivo só de constante, e não no renderizador de blocos**
 * (01/10, PLT-13). Até aqui `WARN_INK` era exportado de
 * `components/blocks/BlockRenderer.tsx`, que era parte das trilhas — 26
 * arquivos de Invoice, Jobs, Perfil e Configurações importavam uma cor de
 * dentro da feature de estudo. Com a remoção das trilhas (PLT-13) aquele
 * arquivo saiu, e manter a cor lá teria derrubado tudo o que fica.
 *
 * É o mesmo gesto do `BOTAO_ICONE` em `botao-icone.ts`, pelo mesmo motivo:
 * importar uma string não deve arrastar uma feature inteira para o bundle.
 */

/* Alerta: âmbar-avermelhado, escolhido para não competir com o dourado da
   marca nem se confundir com ele. */
/* O tom claro é #A34A17 e não #B4531A: sobre o fundo do bloco, aquele media
   4,42:1 e reprova em WCAG AA. Este mede 5,22:1. O tom escuro já passa. */
const WARN = '#A34A17'
const WARN_DARK = '#E8894A'

/**
 * Cor de alerta — texto de erro, borda de campo inválido, selo de aviso.
 *
 * É o que o CLAUDE.md manda usar para erro: o dourado (`--accent`) dá ~2,2:1
 * sobre fundo claro e reprova em AA.
 */
export const WARN_INK = `light-dark(${WARN}, ${WARN_DARK})`
