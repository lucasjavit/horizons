/**
 * Um recurso que depende de credencial de terceiro.
 *
 * Fica **desabilitado sem a dependência**, e diz por quê. Um toggle que liga
 * sem a chave não liga nada — só empurra a falha para o momento do uso.
 *
 * Compartilhado entre as sub-páginas de Configurações (Job sources, Features,
 * Notifications): era interno ao `SettingsPage` de 864 linhas, e a divisão em
 * quatro páginas exigiu que ele saísse.
 */
export function Interruptor({
  id,
  titulo,
  ligado,
  temDependencia,
  salvando,
  onAlternar,
  ajudaLigada,
  ajudaDesligada,
  ajudaSemChave,
}: {
  id: string
  titulo: string
  ligado: boolean
  temDependencia: boolean
  salvando: boolean
  onAlternar: () => void
  ajudaLigada: string
  /**
   * O que acontece com o recurso DESLIGADO, quando isso não é só "nada
   * acontece". O interruptor do Firecrawl desligado não para a busca — passa
   * para a IA —, e sem dizer isso a pessoa desliga achando que desligou a
   * busca inteira. Opcional: recurso cujo desligado é só ausência não precisa.
   */
  ajudaDesligada?: string
  ajudaSemChave: string
}) {
  return (
    // `htmlFor` explicito, e nao so o `<label>` envolvente. O nome acessivel
    // sai certo dos dois jeitos, mas a convencao da casa e "todo campo com
    // `<label htmlFor>`" — e uma tela de acessibilidade que segue a regra em
    // 40 lugares e a dispensa em 1 e uma regra que nao vale (QA, 25/08).
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={ligado}
        disabled={!temDependencia || salvando}
        onChange={onAlternar}
        aria-describedby={`${id}-ajuda`}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)] disabled:opacity-50"
      />
      <span>
        <span className="block text-sm font-medium">{titulo}</span>
        <span
          id={`${id}-ajuda`}
          className="mt-0.5 block text-sm leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {!temDependencia
            ? ajudaSemChave
            : ligado
              ? ajudaLigada
              : (ajudaDesligada ?? ajudaLigada)}
        </span>
      </span>
    </label>
  )
}
