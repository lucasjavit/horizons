import type { ReactNode } from 'react'
// A constante mora em `components/botao-icone.ts` desde 30/08 — ver a nota la
// sobre os 27 KB. Reexportada para quem ja importava daqui.
import { BOTAO_ICONE } from '../botao-icone'
export { BOTAO_ICONE }
import { Link } from 'react-router-dom'
import { usePopover } from '../../lib/usePopover'
import { HintWrap } from '../Hint'
import { SeletorDeLocal } from './SeletorDeLocal'
import { SinoDeAvisos } from './SinoDeAvisos'

/**
 * O console de busca do topo da tela de vagas.
 *
 * **Duas faixas dentro de um quadro só** (27/08, JOB-40). Em cima, o campo de
 * texto e as ações que o EXECUTAM: `Location`, `All filters` e um `Search`
 * sólido de marca. Embaixo, em `--surface-sunken`, todo filtro ativo como chip
 * removível — a `faixa`, que a lista injeta.
 *
 * O que a estrutura resolve, e por que ela não é cosmética:
 *
 * - **A hierarquia estava invertida.** Medido: `All filters`, o controle mais
 *   usado, tinha 38px de largura; `Location`, secundário, tinha 125px. E a
 *   lupa — a ação de buscar — era o alvo mais fraco da barra (32×32, cinza,
 *   encostada na borda). Agora os três controles têm o mesmo corpo e o
 *   `Search` é o objeto mais pesado da faixa.
 * - **Em 390px a ordem visual estava invertida.** O `order-last` punha o campo
 *   de texto na terceira linha: via-se seis ícones antes de onde digitar
 *   (input em y=172, os botões em y=92 — medido). Agora o campo vem primeiro e
 *   Location/Filters/Search dividem a segunda linha.
 * - **O resultado dos filtros deixa de ser um número.** Quem subia o currículo
 *   via `3` numa bolinha e precisava abrir o modal para saber o que aconteceu.
 *   Com os chips lê `Remote · LATAM · Go` e apaga o que não quer num clique.
 *
 * Isso também responde ao pedido de não parecer o freehire pelo caminho certo:
 * a estrutura é outra, não a cor.
 *
 * **O alternador de tema saiu daqui em 26/08** e foi para o cabeçalho do site:
 * ele só existia para quem chegava a esta tela, e o tema vale para o app
 * inteiro.
 *
 * **O campo de texto substitui o dropdown "Job title"**, e a diferença não é
 * cosmética: o dropdown oferecia uma lista fixa escrita à mão, e o campo aceita
 * qualquer coisa — "Java software engineer LATAM" não existia na lista, e é
 * exatamente o que alguém digita.
 */


/**
 * Os controles de escopo da faixa de cima: `Location` e `All filters`.
 *
 * Mesmo corpo para os dois — 38px de altura, borda, o mesmo padding. Era aqui
 * que a hierarquia se invertia: 38px contra 125px para o controle menos usado.
 * Iguais, a diferença de peso passa a vir do `Search`, que é o que de fato
 * manda.
 *
 * `min-h-9` (36px) garante o alvo de toque mesmo se a fonte mudar.
 */
export const BOTAO_ESCOPO =
  'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap ' +
  'rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
  'hover:border-[var(--brand)] hover:text-[var(--brand)]'

export function BarraDeBusca({
  texto,
  onTexto,
  formatos,
  regioes,
  onLocal,
  quantosFiltros,
  onAbrirFiltros,
  onBuscar,
  faixa,
}: {
  texto: string
  onTexto: (t: string) => void
  formatos: string[]
  regioes: string[]
  onLocal: (formatos: string[], regioes: string[]) => void
  /** Quantos filtros do modal estão ativos — o badge do botão. */
  quantosFiltros: number
  onAbrirFiltros: () => void
  /**
   * Dispara a busca.
   *
   * **Recebe o texto por parâmetro, e não o lê do estado.** O `×` limpa e
   * busca no mesmo clique, e `setState` só agenda: chamar `onBuscar()` na
   * linha seguinte ao `onTexto('')` fazia a busca sair com o texto ANTIGO
   * (QA, 26/08) — campo vazio e lista filtrada, um estado que a tela afirma
   * não existir.
   */
  onBuscar: (texto: string) => void
  /**
   * A faixa de chips dos filtros ativos — o `PainelDeFiltros`, injetado.
   *
   * Vem de fora pelo mesmo motivo que `acoes`: os chips são construídos a
   * partir da seleção do modal, que é estado da `ListaVagas`. A barra só
   * reserva o lugar dentro do quadro.
   */
  faixa?: ReactNode
}) {
  return (
    <div
      // O quadro do console: uma borda só, e as duas faixas dentro dela.
      //
      // **Sem `overflow-hidden`.** Ele existia para o fundo afundado da faixa
      // de baixo respeitar o canto arredondado — e recortava JUNTO o popover
      // do `Location`, que é filho deste quadro: o painel de 314px aparecia
      // com 40px, só o cabeçalho (medido em 27/08, relatado pelo stakeholder).
      //
      // Quem arredonda agora é a própria faixa, nos cantos de baixo, o que
      // resolve o vazamento sem recortar nada.
      className="rounded-xl border"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      {/*
        A faixa de cima. Só embrulha no celular (`sm:flex-nowrap`), e ali o
        `form` toma a linha inteira — ver a nota do `basis-full` abaixo.
      */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 sm:flex-nowrap">
        {/*
          **`basis-full` no celular: o campo ocupa uma linha inteira, e é a
          PRIMEIRA.**

          Media **0px de largura** a 390px e 414px (QA, 26/08) — `flex-1` num
          container que embrulha deixava os ícones consumirem a linha e o input
          encolher até sumir.

          O `order-last` que resolvia aquilo criou outro problema: punha o
          campo na terceira linha, atrás de seis ícones (medido em y=172 contra
          y=92 dos botões). Sem ele, e com as ações de navegação movidas para
          fora da barra, o campo é o primeiro elemento em qualquer largura —
          que é a ordem em que se usa a tela.

          É um `form` para que Enter busque — sem isso, quem digita e aperta
          Enter não vê nada acontecer, e o teclado é como se pesquisa.
        */}
        <form
          className="flex w-full min-w-0 basis-full items-center gap-2 px-2 sm:w-auto sm:flex-1 sm:basis-auto"
          onSubmit={(e) => {
            e.preventDefault()
            onBuscar(texto)
          }}
        >
          {/*
            A lupa voltou a ser enfeite — e desta vez é de propósito.

            Ela era `type="submit"` porque, sem a barra de filtros (26/08),
            nada mais disparava a busca com o mouse. Agora existe um botão
            `Search` de verdade à direita, com rótulo e corpo; manter dois
            submits na mesma faixa daria dois alvos para a mesma ação e um
            deles seria de 32×32 e cinza — o alvo mais fraco da barra, que é o
            que se está corrigindo. Sem `aria-label`, ela some do leitor de
            tela em vez de anunciar um botão que não é.
          */}
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center"
            // Ganha a cor da marca quando há filtro e nada digitado: é o
            // estado de quem acabou de subir o currículo. O `Search` à direita
            // acende junto — ver a nota lá.
            style={{
              color:
                texto.length === 0 && quantosFiltros > 0
                  ? 'var(--brand)'
                  : 'var(--text-muted)',
            }}
          >
            <SearchIcon />
          </span>

          <label htmlFor="busca-de-vagas" className="sr-only">
            Search jobs and companies
          </label>
          <input
            id="busca-de-vagas"
            type="search"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            placeholder="Search jobs and companies…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
          {texto.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onTexto('')
                // Limpar já busca de novo: o `×` promete voltar ao estado sem
                // texto, e deixar a lista antiga na tela contradiz isso. A
                // string vazia vai explícita — ver a nota em `onBuscar`.
                onBuscar('')
              }}
              aria-label="Clear search"
              className={`h-7 w-7 text-base leading-none ${BOTAO_ICONE}`}
              style={{ color: 'var(--text-muted)' }}
            >
              <span aria-hidden>×</span>
            </button>
          )}
        </form>

        {/*
          **As três ações que executam a busca, juntas à direita.**

          `Location` e `All filters` restringem; `Search` roda. No celular o
          grupo toma a segunda linha inteira e os três dividem em partes iguais
          (`flex-1`), o que dá alvos largos sem empilhar em três linhas.
        */}
        <div
          // **Os tres controles ficam na largura natural, e nao em tercos.**
          //
          // `[&>span]:flex-1` mira o `<span>` do `HintWrap`, que e o filho
          // flex de verdade (`w-full` no botao de dentro nao faz nada, porque
          // quem divide a linha e o wrapper). Mas o `flex-1` NAO os iguala: o
          // rotulo e `whitespace-nowrap` e o `min-width` do wrapper e `auto`,
          // entao cada botao tem um piso de min-content — medido, 127/112/80
          // a 320px, 360px, 390px e 414px, sem estouro em nenhuma.
          //
          // Fica assim de proposito. Forcar tercos exigiria `min-w-0`, e a
          // 320px isso cortaria "All filters" no meio. Rotulo legivel ganha de
          // coluna alinhada.
          className="flex w-full min-w-0 basis-full items-center gap-1.5 px-2 pb-0.5 [&>span]:flex-1 sm:w-auto sm:basis-auto sm:px-0 sm:pb-0 sm:[&>span]:flex-none"
        >
          <SeletorDeLocal formatos={formatos} regioes={regioes} onMudar={onLocal} />

          <HintWrap
            title="All filters"
            texto="Role, skills, salary, language, company size and more — with how many jobs match each one."
          >
            <button
              type="button"
              onClick={onAbrirFiltros}
              aria-label={
                quantosFiltros > 0
                  ? `All filters, ${quantosFiltros} active`
                  : 'All filters'
              }
              className={`w-full ${BOTAO_ESCOPO}`}
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <FiltersIcon />
              <span>All filters</span>
              {/*
                **O contador só no celular.** No desktop os chips estão
                visíveis logo abaixo: o número repetiria, em forma pior, o que
                a faixa já mostra por extenso. No celular os chips rolam de
                lado e podem estar fora de vista, então o número volta a ser a
                única evidência de quantos há.

                O `aria-label` do botão carrega a contagem nas DUAS larguras —
                quem usa leitor de tela não "vê" a faixa de chips ao lado.
              */}
              {quantosFiltros > 0 && (
                <span
                  aria-hidden
                  className="rounded-full px-1.5 text-xs tabular-nums sm:hidden"
                  style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
                >
                  {quantosFiltros}
                </span>
              )}
            </button>
          </HintWrap>

          <HintWrap
            title="Search"
            texto="Runs the search with everything you set — the text here, the location and the filters."
          >
            <button
              type="button"
              onClick={() => onBuscar(texto)}
              className={`w-full font-semibold ${BOTAO_ESCOPO}`}
              // Sólido de marca: é a ação que executa, e o objeto mais pesado
              // da faixa. Antes era uma lupa cinza de 32px encostada na
              // borda — o alvo mais fraco de todos.
              //
              // `filter` no hover em vez de trocar as cores: o token já é a
              // cor certa, e clarear preserva o contraste com `--brand-text`.
              style={{
                background: 'var(--brand)',
                borderColor: 'var(--brand)',
                color: 'var(--brand-text)',
              }}
            >
              Search
            </button>
          </HintWrap>
        </div>
      </div>

      {/*
        A faixa de baixo: os chips.

        Fica DENTRO do quadro, com um filete separando as duas — é o que faz
        as duas lerem como um objeto só, e não como a barra mais uma caixa
        empilhada embaixo dela.
      */}
      {faixa && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {faixa}
        </div>
      )}
    </div>
  )
}

/**
 * As ações que não executam a busca: limpar tudo, CV, salvas, sino, menu.
 *
 * **Fora do quadro do console, numa linha acima** (27/08). Dentro dele, seis
 * ícones cinzas disputavam a faixa com os controles que mudam o resultado, e
 * no celular empurravam o campo de texto para a terceira linha. Navegação e
 * busca são coisas diferentes; a barra guarda só a segunda.
 */
export function AcoesDaBarra({
  temAlgumFiltro,
  onLimparTudo,
  acoes,
}: {
  temAlgumFiltro: boolean
  onLimparTudo: () => void
  acoes?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {/* Só aparece quando há o que limpar — um botão que não faz nada ocupa
          o lugar do que faz. */}
      {temAlgumFiltro && (
        <HintWrap
          title="Clear search"
          texto="Removes the text, the location and every filter — back to the full catalogue."
        >
          <button
            type="button"
            onClick={onLimparTudo}
            aria-label="Clear search and filters"
            className={`h-9 w-9 ${BOTAO_ICONE}`}
            style={{ color: 'var(--text-muted)' }}
          >
            <ClearIcon />
          </button>
        </HintWrap>
      )}

      {acoes}
      <SinoDeAvisos />
      <MenuDaConta />
    </div>
  )
}

/**
 * O menu hambúrguer: Profile, Saved jobs, Settings.
 *
 * As três rotas já existem — o menu só as junta num lugar.
 */
function MenuDaConta() {
  const { aberto, setAberto, alternar, caixa, gatilho } = usePopover()

  // **`Profile` aponta para `/vagas`, e não para uma rota própria.**
  //
  // Não existe página de perfil: o perfil de busca é a caixa de currículo mais
  // os filtros, e eles vivem na própria tela de vagas (JOB-02). Criar
  // `/vagas/perfil` só para o menu ter três itens daria um link para uma tela
  // vazia.
  const itens = [
    { para: '/vagas', rotulo: 'Profile' },
    { para: '/salvas', rotulo: 'Saved jobs' },
    { para: '/config', rotulo: 'Settings' },
  ]

  return (
    <div ref={caixa} className="relative">
      <HintWrap
        title="Menu"
        align="left"
        texto="Your profile, saved jobs and settings."
        suprimido={aberto}
      >
        <button
          ref={gatilho}
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          aria-haspopup="menu"
          aria-label="Menu"
          className={`h-9 w-9 ${BOTAO_ICONE}`}
          style={{ color: 'var(--text-muted)' }}
        >
          <MenuIcon />
        </button>
      </HintWrap>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border py-1 shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          {itens.map((i) => (
            <Link
              key={i.para}
              to={i.para}
              role="menuitem"
              onClick={() => setAberto(false)}
              className="block px-4 py-2.5 text-sm hover:underline"
              style={{ color: 'var(--text)' }}
            >
              {i.rotulo}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// Os ícones são SVG e não emoji: **esta máquina não tem fonte de emoji**, e o
// glifo vira quadrado vazio (medido no JOB-04, que tirou 🔍 e ✕ dos botões).

function SearchIcon() {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function FiltersIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

/**
 * `×` dentro de um círculo: limpar tudo.
 *
 * Era uma vassoura, que ficou visualmente pesada ao lado de traços finos —
 * três formas diferentes num ícone de 18px. O `×` circulado repete o mesmo
 * gesto do `×` do campo, um nível acima.
 */
function ClearIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  )
}
