/**
 * A cápsula "do currículo", ao lado do rótulo de um campo preenchido pela IA.
 *
 * É um dos três sinais redundantes que o desenho pede (selo + borda esquerda +
 * linha de ajuda), e o único que sobrevive no leitor de tela — por isso o `id`
 * entra no `aria-describedby` do campo, e não é só enfeite visual.
 *
 * Texto literal, não ícone: um robozinho exigiria aprender uma convenção, e
 * cor sozinha é proibida no projeto. `--accent-ink` e não `--accent`: o
 * dourado puro mede ~2,2:1 sobre fundo claro e reprova em AA.
 */
export function SeloOrigem({ id }: { id: string }) {
  return (
    <span
      id={id}
      className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: 'var(--border)', color: 'var(--accent-ink)' }}
    >
      do currículo
    </span>
  )
}
