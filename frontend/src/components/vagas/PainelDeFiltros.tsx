import { CATEGORIAS, rotularValor } from './modal-filtro'
import type { SelecaoModal } from './ModalFiltros'

/**
 * A faixa de filtros ATIVOS, dentro do quadro da barra de busca.
 *
 * **O que ele resolve é a invisibilidade.** Os filtros viviam dentro do modal:
 * para saber o que estava ligado era preciso abri-lo, e o badge só dizia
 * "7" — sete o quê. Aqui cada valor tem nome e um `×` próprio.
 *
 * É o mesmo dado do modal, visto de outro jeito: o modal é para **escolher**
 * (com as contagens, a busca por seção, os três estados), e a faixa é para
 * **revisar e tirar**. Por isso ela não repete as listas — mostra só o que
 * está marcado.
 *
 * **De gaveta a visão padrão (27/08, JOB-40).** Era um `<aside>` que só
 * aparecia ao passar o mouse numa etiqueta de chevron pendurada sob a barra —
 * um botão de 160×24 sem rótulo, medido. Quem subia o currículo via um `3`
 * numa bolinha e precisava caçar o painel para descobrir o que tinha
 * acontecido. Agora a faixa é sempre visível, assentada em `--surface-sunken`
 * dentro do mesmo quadro da barra: o resultado dos filtros deixa de ser algo
 * em que se acredita e passa a ser algo que se lê.
 *
 * Junto com a gaveta caíram o cabeçalho "Filters", o `×` de fechar e os botões
 * largos `All filters` / `Save filter` — todos duplicavam controles que a
 * faixa de cima já tem, e repetidos numa tira sempre presente virariam ruído.
 */

/** Um valor ativo, já com o rótulo pronto e o caminho para removê-lo. */
interface ValorAtivo {
  chave: string
  rotulo: string
  /** Excluído (o terceiro estado do chip) — mostrado riscado, como na referência. */
  excluido: boolean
  remover: () => void
}

export function PainelDeFiltros({
  texto,
  selecao,
  onTexto,
  onSelecao,
  onLimparTudo,
}: {
  /** O texto da barra de busca — vira o primeiro chip. */
  texto: string
  selecao: SelecaoModal
  onTexto: (t: string) => void
  onSelecao: (s: SelecaoModal) => void
  onLimparTudo: () => void
}) {
  const valores = montarValores(texto, selecao, onTexto, onSelecao)

  return (
    <div
      id="painel-de-filtros"
      aria-label="Active filters"
      role="group"
      // **Rola de lado, nunca empilha em coluna** (390px é caso testado).
      //
      // `flex-nowrap` + `overflow-x-auto`: com oito filtros marcados num
      // celular, empilhar viraria uma coluna de oito linhas que empurra a
      // lista de vagas para baixo da dobra. Rolando, a faixa continua sendo
      // uma faixa. No desktop cabe tudo e a rolagem nunca aparece.
      // `rounded-b-xl`: o quadro da barra deixou de recortar (para nao
      // cortar o popover do Location), entao e a faixa que respeita os
      // cantos de baixo — senao o fundo afundado vaza por baixo da borda.
      className="flex items-center gap-2 overflow-x-auto rounded-b-xl px-3 py-2.5"
      style={{ background: 'var(--surface-sunken)' }}
    >
      {valores.length === 0 ? (
        // **O vazio ensina em vez de ficar em branco.** Uma tira vazia sob o
        // campo parece defeito de layout; a frase diz o que o estado
        // significa (catálogo inteiro) e qual é o próximo passo.
        <p
          className="flex min-h-7 items-center gap-2 whitespace-nowrap text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <IconeInfo />
          No filters yet — searching the whole catalogue. Upload your CV to fill
          these in.
        </p>
      ) : (
        <>
          <span
            className="shrink-0 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            Filters
          </span>
          <ul className="flex shrink-0 items-center gap-1.5">
            {valores.map((v) => (
              <li key={v.chave}>
                <button
                  type="button"
                  onClick={v.remover}
                  aria-label={
                    v.excluido ? `Remove excluded ${v.rotulo}` : `Remove ${v.rotulo}`
                  }
                  className="inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-sm transition-colors hover:brightness-105"
                  style={{
                    // O excluído sai riscado e com a cor de aviso, como na
                    // referência — e o risco não é o único sinal: o
                    // `aria-label` diz "excluded" por extenso.
                    //
                    // Todos os chips têm o MESMO tratamento fora isso: não há
                    // marcação de origem (o que veio do CV) porque o
                    // `origemCv` não existe mais — ver o card JOB-41.
                    background: 'var(--surface-raised)',
                    borderWidth: 1,
                    borderStyle: v.excluido ? 'dashed' : 'solid',
                    borderColor: v.excluido ? 'var(--accent-ink)' : 'var(--brand)',
                    color: v.excluido ? 'var(--accent-ink)' : 'var(--brand)',
                    textDecoration: v.excluido ? 'line-through' : 'none',
                  }}
                >
                  {v.rotulo}
                  <span aria-hidden style={{ textDecoration: 'none' }}>
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/*
            `Clear all` à direita da faixa.

            `ml-auto` no desktop empurra para a borda; quando a faixa rola (no
            celular com muitos chips) ele vira o último item da rolagem, que é
            onde se chega depois de ler todos — e continua alcançável pelo Tab
            sem rolar nada.
          */}
          <button
            type="button"
            onClick={onLimparTudo}
            // `min-h-6` (24px) é o mínimo da WCAG 2.5.8. Sem ele o botão
            // media 20px — o único do painel a reprovar (QA, 26/08).
            className="ml-auto inline-flex min-h-6 shrink-0 items-center rounded px-2 text-sm underline underline-offset-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Clear all
          </button>
        </>
      )}
    </div>
  )
}

function IconeInfo() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

/**
 * Monta a lista plana de chips a partir da seleção.
 *
 * **Plana, e não agrupada por eixo** (27/08): a faixa tem uma linha só, e
 * títulos de grupo intercalados ("ROLE", "SKILLS") gastariam nela o espaço dos
 * próprios chips. O rótulo de cada valor já é autoexplicativo — "Go",
 * "Senior", "Remote" —, e quem quer o eixo abre o modal.
 *
 * A ordem sai de `CATEGORIAS`, a mesma do modal: quem marcou algo em "Role"
 * encontra os valores de Role na mesma posição relativa. Um mapa próprio aqui
 * divergiria dela na primeira mudança.
 */
function montarValores(
  texto: string,
  selecao: SelecaoModal,
  onTexto: (t: string) => void,
  onSelecao: (s: SelecaoModal) => void,
): ValorAtivo[] {
  const valores: ValorAtivo[] = []

  // O texto primeiro: é o que a pessoa digitou, e o que ela mais reconhece.
  if (texto.trim().length > 0) {
    valores.push({
      chave: 'texto',
      rotulo: texto.trim(),
      excluido: false,
      remover: () => onTexto(''),
    })
  }

  const semValor = (campo: string, valor: string): SelecaoModal => {
    const lista = (selecao[campo] ?? []).filter((v) => v !== valor)
    const novo = { ...selecao }
    if (lista.length > 0) novo[campo] = lista
    else delete novo[campo]
    return novo
  }

  for (const categoria of CATEGORIAS) {
    for (const secao of categoria.secoes) {
      const incluidos = selecao[secao.campo] ?? []
      const excluidos = secao.campoExcluir ? (selecao[secao.campoExcluir] ?? []) : []

      for (const v of incluidos) {
        valores.push({
          chave: `${secao.campo}:${v}`,
          rotulo: rotularValor(secao.faceta, v),
          excluido: false,
          remover: () => onSelecao(semValor(secao.campo, v)),
        })
      }
      for (const v of excluidos) {
        valores.push({
          chave: `${secao.campoExcluir}:${v}`,
          rotulo: rotularValor(secao.faceta, v),
          excluido: true,
          remover: () => onSelecao(semValor(secao.campoExcluir as string, v)),
        })
      }
    }
  }

  return valores
}
