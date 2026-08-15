import { useState } from 'react'
import { Recolhivel } from '../Recolhivel'
import type { Vaga } from '../../types/api'
import {
  NAO_INFORMADO,
  formatarElegibilidade,
  formatarFonte,
  formatarIdade,
  formatarRegime,
  formatarSalario,
} from './vaga-formato'

/**
 * Uma vaga na lista.
 *
 * Cartão horizontal enxuto, como a referência do stakeholder: título em
 * destaque com o selo de idade ao lado, a linha `empresa · local · via fonte ·
 * escopo`, e as skills em fichas embaixo.
 *
 * **Não existe nota nem percentual de compatibilidade.** Foi decisão do
 * stakeholder, e é firme — a referência tinha um número na lateral (79, 75) e
 * ele dispensou. Sem nota também não há ordenação por nota: a lista vem por
 * data, do backend.
 *
 * As duas regras do JOB-04 que moram aqui dentro:
 *
 * 1. **Campo ausente permanece ausente.** `salaryMin: null` vira "não
 *    informado", em itálico e apagado — nunca um número. A tela precisa
 *    aguentar o vazio com naturalidade, senão a pressão vira preencher, e o
 *    desenho passa a causar a alucinação que o pipeline deveria evitar.
 * 2. **Extraído e inferido não têm a mesma tipografia.** O valor que a IA leu
 *    aparece em peso médio; o trecho do anúncio de onde ele saiu fica atrás de
 *    um botão que revela o texto original. Isso é verificável, não é
 *    confiança — e é a diferença entre um fato e uma alucinação bem
 *    formatada.
 */
export function CartaoVaga({ vaga }: { vaga: Vaga }) {
  const salario = formatarSalario(vaga)
  const elegibilidade = formatarElegibilidade(vaga.elegivelBrasil)
  const idade = formatarIdade(vaga.postedAt)
  const fonte = formatarFonte(vaga.fonte)
  const regime = formatarRegime(vaga.regime)

  // `<li>` porque a lista é uma `<ul>` de verdade: o leitor de tela anuncia
  // "lista de 12 itens" e a navegação por item funciona.
  return (
    <li
      className="rounded-xl border p-4 sm:p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold leading-snug">
          {/* O link inteiro no título: é o alvo que a pessoa quer clicar, e
              `rel=noreferrer` porque a vaga é de terceiro. */}
          {/* `inline-block` + `py-0.5` para o alvo chegar aos 24px da WCAG
              2.5.8: como `inline`, a âncora herdava os 19px da linha de texto
              e ficava abaixo do mínimo. */}
          <a
            href={vaga.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-0.5 underline-offset-2 hover:underline"
            style={{ color: 'var(--text)' }}
          >
            {vaga.title}
          </a>
        </h3>

        {idade && (
          // O selo é redundante com a data, e de propósito: "há 14d" responde
          // "ainda está aberta?" sem a pessoa converter data na cabeça.
          <span
            className="shrink-0 rounded-full border px-2 py-0.5 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {idade}
          </span>
        )}
      </div>

      {/* A linha de identificação. `·` é decorativo: o leitor de tela não deve
          anunciar "ponto" entre cada pedaço. */}
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--text)' }}>{vaga.company}</span>
        {vaga.local && (
          <>
            <Separador />
            {vaga.local}
          </>
        )}
        {fonte && (
          <>
            <Separador />
            via {fonte}
          </>
        )}
        {regime && (
          <>
            <Separador />
            {regime}
          </>
        )}
      </p>

      {/* Salário e elegibilidade: as duas perguntas caras do card, e as duas
          que a IA pode ter errado. Por isso são as que carregam o trecho. */}
      <div className="mt-3 flex flex-col gap-2">
        <Afirmacao
          rotulo="Salário"
          valor={salario}
          trecho={vaga.salaryTrecho}
          idTrecho={`salario-${vaga.id}`}
        />
        <Afirmacao
          rotulo="Contratação do Brasil"
          valor={elegibilidade}
          trecho={vaga.elegibilidadeTrecho}
          idTrecho={`eleg-${vaga.id}`}
        />
      </div>

      {vaga.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {vaga.skills.map((skill) => (
            <li
              key={skill}
              className="rounded-full border px-2.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {skill}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** O `·` entre os pedaços da linha de identificação. Só enfeite, some do leitor. */
function Separador() {
  return <span aria-hidden> · </span>
}

/**
 * Um dado que a IA extraiu do anúncio, com a origem conferível ao lado.
 *
 * O botão "ver trecho" só existe quando **há** trecho: um botão que abre um
 * painel vazio ensina a não clicar mais. E quando o valor está ausente, o
 * trecho continua disponível se veio — às vezes o anúncio fala de salário sem
 * um número que dê para extrair, e esse texto é justamente o que a pessoa
 * quer ler.
 */
function Afirmacao({
  rotulo,
  valor,
  trecho,
  idTrecho,
}: {
  rotulo: string
  valor: string | null
  trecho: string | null
  idTrecho: string
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span style={{ color: 'var(--text-muted)' }}>{rotulo}:</span>

        {valor ? (
          // Extraído: peso médio, cor de texto normal.
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            {valor}
          </span>
        ) : (
          // Ausente: itálico e apagado. Tipografia diferente do extraído, que é
          // o ponto — ausência não pode parecer um dado.
          <span className="italic" style={{ color: 'var(--text-muted)' }}>
            {NAO_INFORMADO}
          </span>
        )}

        {trecho && (
          <button
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            aria-controls={idTrecho}
            // min-h-6 = 24px, o mínimo de alvo da WCAG 2.5.8.
            className="flex min-h-6 items-center rounded text-xs underline underline-offset-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {aberto ? 'ocultar trecho' : 'ver trecho'}
          </button>
        )}
      </div>

      {trecho && (
        <Recolhivel aberto={aberto} id={idTrecho}>
          {/* O texto do anúncio, marcado como citação porque é isso que ele é.
              Fundo rebaixado e borda à esquerda separam a palavra do anúncio da
              palavra da interface. */}
          <blockquote
            className="mt-2 border-l-2 py-1 pl-3 text-xs leading-relaxed"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-sunken)',
              color: 'var(--text-muted)',
            }}
          >
            “{trecho}”
          </blockquote>
        </Recolhivel>
      )}
    </div>
  )
}
