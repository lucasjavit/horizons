/**
 * O chip de três estados do modal de filtros (JOB-41).
 *
 * Cicla `off → incluir → excluir → off`, que é o modelo da referência: além de
 * escolher o que quer, dá para **descartar** o que não quer — uma fonte em que
 * não se confia, um stack do qual já se cansou, uma empresa onde já se
 * candidatou.
 *
 * **O estado NUNCA é sinalizado só por cor.** São três estados num controle
 * pequeno, e a regra da casa já proíbe cor sozinha carregando informação. Aqui
 * a diferença é tripla e redundante:
 *
 * 1. um glifo (`+` incluído, `−` excluído, nada quando off);
 * 2. a espessura e o estilo da borda (sólida grossa / tracejada);
 * 3. o `aria-label`, que diz o estado por extenso e o que o clique fará.
 *
 * `aria-pressed` **não serve** aqui: ele é binário, e um leitor de tela diria
 * "pressionado" tanto para incluído quanto para excluído — que são opostos.
 * Por isso o estado vai no rótulo, em texto.
 */

export type EstadoChip = 'off' | 'incluir' | 'excluir'

/** O próximo estado do ciclo. Exportado porque o painel também precisa dele. */
export function proximoEstado(atual: EstadoChip): EstadoChip {
  if (atual === 'off') return 'incluir'
  if (atual === 'incluir') return 'excluir'
  return 'off'
}

export function ChipFiltro({
  rotulo,
  total,
  estado,
  onAlternar,
}: {
  /** O texto legível. Já traduzido do valor canônico da API. */
  rotulo: string
  /**
   * Quantas vagas este valor tem, com os outros filtros aplicados.
   *
   * `null` em dois casos: não há contagem (o motor está fora), ou o valor foi
   * reinjetado pela tela por estar selecionado e ausente da faceta — o chip
   * excluído, que sai do resultado por definição. O chip continua utilizável;
   * só não informa o número.
   */
  total: number | null
  estado: EstadoChip
  onAlternar: (proximo: EstadoChip) => void
}) {
  // **Zero desabilita, e o chip CONTINUA VISÍVEL.**
  //
  // Sumir com ele esconderia a informação mais útil que a contagem dá: que
  // aquele valor existe e não tem vaga agora. É a mesma ideia de "filtro que
  // não filtra é pior que filtro ausente", resolvida antes do clique — a
  // referência faz assim (`Network Engineering 0`, `Hardware 0`).
  //
  // Um chip já marcado nunca desabilita, senão a pessoa não conseguiria
  // desmarcar o filtro que zerou a própria lista.
  //
  // **Hoje isto quase não dispara**, e é honesto dizer: a API omite os valores
  // sem resultado em vez de devolvê-los com zero, e o teto de 40 opções por
  // faceta ordena por volume (QA, 26/08). O código fica porque a fonte pode
  // passar a devolver zeros, e porque um valor reinjetado pela tela pode
  // chegar assim.
  const vazio = total === 0 && estado === 'off'

  const descricao =
    estado === 'incluir'
      ? `${rotulo}, included. Activate to exclude.`
      : estado === 'excluir'
        ? `${rotulo}, excluded. Activate to clear.`
        : `${rotulo}. Activate to include.`

  return (
    <button
      type="button"
      disabled={vazio}
      onClick={() => onAlternar(proximoEstado(estado))}
      aria-label={total === null ? descricao : `${descricao} ${total} jobs.`}
      // min-h de 32px: acima dos 24px mínimos de alvo de toque.
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        // Borda tracejada no excluído: a forma diz o estado antes da cor.
        borderWidth: estado === 'off' ? 1 : 2,
        borderStyle: estado === 'excluir' ? 'dashed' : 'solid',
        borderColor:
          estado === 'incluir'
            ? 'var(--brand)'
            : estado === 'excluir'
              ? 'var(--accent-ink)'
              : 'var(--border)',
        background: estado === 'incluir' ? 'var(--brand)' : 'var(--surface)',
        color: estado === 'incluir' ? 'var(--brand-text)' : 'var(--text)',
      }}
    >
      {estado !== 'off' && (
        <span aria-hidden className="font-bold leading-none">
          {estado === 'incluir' ? '+' : '−'}
        </span>
      )}
      <span>{rotulo}</span>
      {total !== null && (
        <span
          aria-hidden
          className="tabular-nums text-xs"
          style={{
            color: estado === 'incluir' ? 'var(--brand-text)' : 'var(--text-muted)',
          }}
        >
          {formatarTotal(total)}
        </span>
      )}
    </button>
  )
}

/**
 * `16780` vira `16.8k`.
 *
 * O número exato não ajuda a decidir e empurra o rótulo para fora do chip:
 * o que importa é a ordem de grandeza, e que 16.8k é muito mais que 42.
 */
function formatarTotal(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const mil = n / 1000
    return `${mil < 10 ? mil.toFixed(1) : Math.round(mil)}k`
  }
  return `${(n / 1_000_000).toFixed(1)}M`
}
