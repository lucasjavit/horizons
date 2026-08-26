import { useRef, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { Hint } from '../Hint'
import { api, errorMessage } from '../../lib/api'
import type { CvLido } from '../../types/api'

interface CaixaUploadCVProps {
  /**
   * O recurso está ligado no servidor (Configurações → Recursos).
   *
   * `undefined` enquanto a tela ainda não sabe: nesse intervalo a caixa não
   * aparece, em vez de piscar "indisponível" e virar upload meio segundo
   * depois.
   */
  ativa: boolean | undefined
  /** O perfil lido, para a tela preencher os filtros — editáveis. */
  onLeu: (lido: CvLido) => void
  /**
   * "Replace file" foi clicado: a origem do currículo anterior deixa de valer.
   *
   * Sem isto a contagem soma os dois currículos e a frase nomeia só o último
   * (QA, 25/08). Quem troca de arquivo acredita ter substituído o perfil, e
   * substituiu nada.
   */
  onSubstituir?: () => void
  /**
   * Quantos filtros o currículo marcou, para a linha de sucesso dizer um
   * número em vez de "pronto".
   *
   * Vem de fora porque quem sabe é o pai: esta caixa entrega o `CvLido` e o
   * `ListaVagas` decide o que dele vira seleção (`aplicarCv` mescla com o que
   * a pessoa já tinha marcado). Contar aqui, a partir do `CvLido`, daria um
   * número diferente do que os dropdowns mostram — e um número errado é pior
   * que nenhum, porque a pessoa o usa para decidir se confere.
   */
  filtrosMarcados: number
}

type Estado = 'ocioso' | 'enviando' | 'lido'

/**
 * A caixa de upload do currículo, acima da barra de filtros.
 *
 * Fica atrás de um interruptor que o admin liga em Configurações, e que só
 * liga quando há chave de IA cadastrada. Sem o recurso ligado a caixa não
 * aparece — oferecer um upload que o servidor recusa seria pior que não
 * oferecer. O servidor confere o mesmo interruptor: esconder a caixa esconde
 * o botão, não o endpoint.
 *
 * **O aviso de que o arquivo vai para o provedor de IA é permanente na tela**,
 * acima do botão, sem depender de hover nem de clique. É critério de aceite do
 * JOB-02: um aviso que só aparece no tooltip chega tarde, porque a pessoa pode
 * escolher o arquivo sem nunca abrir o tooltip. O que foi para dentro do `?`
 * é o *detalhe* — o que é guardado, os formatos, o limite —, nunca o fato.
 *
 * O aviso perdeu o peso de erro em 25/08 (redesenho, direção C). Antes era uma
 * caixa com `border-l-4` e `--surface-sunken`, que pesava mais que o próprio
 * botão de ação, apesar de ser conteúdo informativo e não falha. O contraste
 * já estava aprovado (pior caso 4,91:1) — o problema era peso, não cor.
 *
 * Duas regras do desenho que valem mais que o código bonito:
 *
 * - **recusa nunca preenche campo** — um CV lido errado que produz busca ruim,
 *   sem a pessoa ver o porquê, é o pior desfecho possível;
 * - **erro de upload nunca apaga o que foi digitado** — daí o `onLeu` só ser
 *   chamado no caminho de sucesso, e daí o erro dizer isso por escrito
 *   ("Nothing was changed in your filters"). A garantia existia no código e
 *   não aparecia na tela.
 *
 * O texto é em inglês como o resto da aba Jobs.
 */
export function CaixaUploadCV({
  ativa,
  onLeu,
  filtrosMarcados,
  onSubstituir,
}: CaixaUploadCVProps) {
  const [estado, setEstado] = useState<Estado>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Enquanto nao se sabe, nada. Ligada = upload; desligada = nem a caixa.
  if (ativa !== true) return null

  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setErro(null)
    setNome(arquivo.name)
    setEstado('enviando')
    try {
      const lido = await api.lerCurriculo(arquivo)
      setEstado('lido')
      onLeu(lido)
    } catch (e) {
      // Volta para ocioso, e NAO chama onLeu: nada preenchido a partir de uma
      // leitura que falhou. O que a pessoa ja tinha marcado continua onde
      // estava — este componente nunca escreve nos filtros por conta propria.
      //
      // `errorMessage` devolve a mensagem DO SERVIDOR, que ja vem pronta e diz
      // o que fazer ("este arquivo nao parece um curriculo"), coisa que um
      // "erro ao enviar" generico nao diz.
      setEstado('ocioso')
      setErro(errorMessage(e))
      // Limpa o input para o mesmo arquivo poder ser escolhido de novo: sem
      // isto, escolher o mesmo PDF depois de um erro nao dispara onChange.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  /**
   * O `<input type="file">` de verdade, escondido.
   *
   * Escondido, e nao substituido: o `<label htmlFor>` continua apontando para
   * ele, entao o leitor de tela continua anunciando um campo de arquivo com
   * nome, e o `aria-describedby` continua ligando aviso e formatos ao campo.
   * O que sai e so a *aparencia* nativa, que trazia dois defeitos: o rotulo
   * "Escolher arquivo" vinha no idioma do SO (portugues numa aba inglesa) e o
   * alvo de toque media 20px, abaixo dos 24px que o projeto exige.
   *
   * **`tabIndex={-1}` nao e detalhe.** Sem ele o Tab para duas vezes para um
   * controle so — uma no input invisivel, que nao mostra foco nenhum, e outra
   * no botao. Medido em 25/08: a ordem saia INPUT vazio -> "Upload résumé",
   * e a primeira parada parecia um foco perdido no nada. Quem opera e o
   * botao; o input fica so como campo real por tras dele.
   */
  const inputEscondido = (
    <input
      ref={inputRef}
      id="cv-arquivo"
      type="file"
      accept=".pdf,.docx"
      tabIndex={-1}
      disabled={estado === 'enviando'}
      onChange={(e) => void enviar(e.target.files?.[0])}
      aria-describedby="cv-privacidade cv-detalhe"
      aria-invalid={erro ? true : undefined}
      className="sr-only"
    />
  )

  /**
   * O estado de sucesso: uma linha, e o aviso sai.
   *
   * A faixa inteira colapsa depois da leitura porque o passo ja foi usado —
   * continuar ocupando o topo com o convite faria o atalho parecer permanente.
   * O aviso de privacidade sai junto: a decisao ja foi tomada, e repetir o
   * aviso depois do envio nao protege ninguem.
   *
   * **"Replace file" volta ao estado ocioso, com o aviso de volta**, em vez de
   * abrir o seletor direto. Custa um clique a mais a quem troca de arquivo, e
   * paga: o segundo upload tambem e um upload, e a promessa do JOB-02 e que o
   * aviso venha ANTES de escolher o arquivo — nao apenas antes do primeiro.
   */
  if (estado === 'lido') {
    // Leu o arquivo e nao marcou nada: o pedido funcionou, o resultado nao
    // serviu. Sao coisas diferentes e a tela nao pode dizer a mesma.
    const nada = filtrosMarcados === 0
    return (
      <section
        aria-labelledby="cv-titulo"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3.5"
        style={{
          borderColor: nada ? 'var(--border)' : 'var(--brand)',
          background: 'var(--surface-raised)',
        }}
      >
        <h2 id="cv-titulo" className="sr-only">
          Résumé read
        </h2>
        {inputEscondido}
        {/* **Zero filtro nao e sucesso.** Medido pelo QA em 25/08: um CV cujo
            stack nao casa com o catalogo (so COBOL, por exemplo) — ou um em
            que a pessoa desmarcou tudo — mostrava "✓ we ticked 0 filters ...
            Uncheck anything we got wrong": tique verde e instrucao para
            desmarcar o que nao existe, e a busca saindo com filtro vazio sem
            ninguem perceber. */}
        <span aria-hidden style={{ color: nada ? 'var(--text-muted)' : 'var(--brand)' }}>
          {nada ? '·' : '✓'}
        </span>
        {/* role="status" e nao "alert": anuncia sem interromper. */}
        <p role="status" className="min-w-[12rem] flex-1 text-sm leading-relaxed">
          {nada ? (
            <>
              Read <strong className="font-semibold">{nome}</strong> — but nothing
              in it matched our filters. Pick them by hand below.
            </>
          ) : (
            <>
          {/*
            **A mensagem diz ONDE os filtros ficaram** (26/08).

            Antes dizia "Uncheck anything we got wrong" e mostrava um selo
            "CV" — os dois pertenciam aos dropdowns, que saíram. O QA mediu o
            resultado: a caixa instruía uma ação que não existia mais, e os
            valores viajavam invisíveis em toda busca. Agora eles vão para o
            modal, e a frase aponta para lá.
          */}
          Read <strong className="font-semibold">{nome}</strong> — we set{' '}
          <strong className="font-semibold">
            {filtrosMarcados} {filtrosMarcados === 1 ? 'filter' : 'filters'}
          </strong>
          . Review them under <strong className="font-semibold">All filters</strong>.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            // Volta para ocioso, com o aviso. Nao abre o seletor: ver o
            // comentario do bloco acima.
            //
            // **E esquece o curriculo anterior.** Medido pelo QA em 25/08:
            // subir um segundo CV de outra pessoa dizia "we ticked 8 filters"
            // nomeando so o arquivo novo — os 4 valores do primeiro
            // continuavam marcados e iam para a busca. "Replace file" promete
            // substituir; acumular em silencio faz o botao mentir sobre o que
            // faz, e a busca sai com o stack de dois curriculos misturados.
            onSubstituir?.()
            setEstado('ocioso')
            setNome(null)
            if (inputRef.current) inputRef.current.value = ''
          }}
          className="min-h-6 shrink-0 rounded text-sm underline underline-offset-2"
          style={{ color: 'var(--text-muted)' }}
        >
          Replace file
        </button>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="cv-titulo"
      className="flex flex-col gap-2.5 rounded-xl border p-3.5"
      style={{
        // Borda de erro na propria faixa: erro sinalizado por borda + texto +
        // aria-invalid, nunca so por cor.
        borderColor: erro ? WARN_INK : 'var(--border)',
        background: 'var(--surface-raised)',
      }}
    >
      <h2 id="cv-titulo" className="sr-only">
        Start from your résumé
      </h2>

      {/* A faixa de uma linha. No celular vira coluna e o botao ocupa a
          largura toda — e a diferenca entre caber e nao caber na dobra. */}
      <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor="cv-arquivo" className="sr-only">
          Résumé file
        </label>
        {inputEscondido}
        <button
          type="button"
          disabled={estado === 'enviando'}
          // Dispara o input escondido. O clique no botao visivel e o clique no
          // campo — o `<label htmlFor>` sozinho nao bastaria, porque o proprio
          // label visivel foi para sr-only.
          onClick={() => inputRef.current?.click()}
          // O botao repete o aria-describedby do input porque agora e ELE que
          // recebe o foco (o input saiu da ordem de Tab). Sem isto o aviso de
          // privacidade nao seria anunciado a quem chega pelo teclado — que e
          // exatamente o "antes do upload" do JOB-02 para quem nao ve a tela.
          aria-describedby="cv-privacidade cv-detalhe"
          aria-invalid={erro ? true : undefined}
          className="min-h-9 w-full shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <span aria-hidden>⬆ </span>
          Upload résumé
        </button>

        {estado === 'enviando' ? (
          // Um status so, com role="status": o leitor de tela anuncia sem
          // interromper, e a pessoa vidente ve o mesmo texto. A chamada de IA
          // leva segundos — sem esta linha a tela fica parada e parece travada.
          <p role="status" className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Reading {nome}…
          </p>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <strong className="font-semibold" style={{ color: 'var(--text)' }}>
              Start from your résumé
            </strong>{' '}
            {/* "the filters below" apontava para os dropdowns, que saíram em
                26/08. Agora os valores vão para "All filters", onde a pessoa
                de fato consegue vê-los e desmarcá-los. */}
            — optional. We read it and set your filters for you — review them
            under "All filters".
          </p>
        )}
      </div>

      {/* **O fato fica na tela; o detalhe vai para o `?`.**

          Esta linha nao pode virar tooltip: e criterio de aceite do JOB-02 que
          a pessoa saiba que o arquivo vai para o provedor de IA ANTES de
          escolher o arquivo, sem depender de hover nem de clique. O que o `?`
          carrega e o resto — o que e guardado, formatos e limite.

          Nao tem role="alert": alert interrompe o leitor de tela, e isto e
          contexto, nao urgencia. O id e apontado pelo input com
          aria-describedby, entao quem chega pelo teclado ouve o aviso ao focar
          o campo — que e o "antes do upload" de quem nao enxerga a tela. */}
      {estado !== 'enviando' && (
        <p
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          <span id="cv-privacidade">
            <span aria-hidden style={{ color: WARN_INK }}>
              ⚠{' '}
            </span>
            Your file is sent to the AI provider to be read.
          </span>
          <Hint title="Your résumé and your data" label="What happens to my résumé file?">
            {
              'We only keep stack, seniority and years — the file and its text are never stored. PDF or DOCX, up to 5 MB. A résumé scanned as an image cannot be read.'
            }
          </Hint>
          {/* O mesmo texto do tooltip, para o leitor de tela, ligado ao input
              por aria-describedby. O tooltip so existe enquanto aberto, entao
              sem esta copia o detalhe nao alcancaria quem nao o abre. */}
          <span id="cv-detalhe" className="sr-only">
            We only keep stack, seniority and years — the file and its text are
            never stored. PDF or DOCX, up to 5 MB. A résumé scanned as an image
            cannot be read.
          </span>
        </p>
      )}

      {erro && (
        // Borda (na section) + texto + aria-invalid (no input), nunca so cor.
        // "Nothing was changed in your filters" e a garantia que o codigo ja
        // dava e a tela nao dizia: o catch nao chama onLeu.
        <p role="alert" className="text-sm leading-relaxed" style={{ color: WARN_INK }}>
          <span aria-hidden>⚠ </span>
          {erro} Nothing was changed in your filters.
        </p>
      )}
    </section>
  )
}
