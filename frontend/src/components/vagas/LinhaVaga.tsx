import { useState } from 'react'
import type { Vaga } from '../../types/api'
import {
  bandeiraDe,
  formatarExperiencia,
  formatarFaixaSalarial,
  formatarIdadeRelativa,
  iniciaisDe,
} from './vaga-formato'

/**
 * Uma vaga como **linha densa**, no formato do RemoteYeah.
 *
 * Não é cartão: sem borda, sem fundo, separada da próxima só pela divisória.
 * A diferença não é estética — o cartão põe uma moldura em volta de cada item e
 * faz vinte vagas parecerem vinte objetos; a linha faz parecer uma lista, que é
 * o que se varre com o olho.
 *
 * **Campo ausente não aparece.** Nenhum "not stated", nenhum traço, nenhum
 * "a combinar": um rótulo de ausente ocupa o mesmo espaço do dado presente e
 * ensina o olho a parar no lugar errado. A linha simplesmente encolhe.
 */
export function LinhaVaga({ vaga }: { vaga: Vaga }) {
  const idade = formatarIdadeRelativa(vaga.postedAt)
  const experiencia = formatarExperiencia(vaga.anosExp)
  const salario = formatarFaixaSalarial(vaga)
  const bandeira = bandeiraDe(vaga.paisIso)

  return (
    <li className="border-b py-4" style={{ borderColor: 'var(--border)' }}>
      {idade && (
        <p className="mb-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {idade}
        </p>
      )}

      <div className="flex gap-3">
        <Logo vaga={vaga} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {/* O link cobre só o título, não a linha inteira: a faixa de chips
                tem texto que a pessoa vai querer selecionar, e um <a> em volta
                de tudo transforma qualquer arrasto em navegação. */}
            <h3 className="text-base font-semibold leading-snug">
              <a
                href={vaga.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: 'var(--text)' }}
              >
                {vaga.title}
              </a>
            </h3>
            {experiencia && (
              <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                {experiencia}
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {vaga.company}
          </p>

          {/* A faixa única de chips, na ordem da captura: área, salário,
              tecnologias, benefícios e o país por último. */}
          <ul className="mt-2 flex flex-wrap items-center gap-1.5">
            {vaga.area && <Chip>{vaga.area}</Chip>}

            {salario && (
              // O único chip colorido. Verde da marca, que é o que a pessoa
              // procura primeiro na linha — e o resto fica neutro para que
              // este seja de fato o que salta.
              //
              // Com trecho de origem, vira botão: clicar mostra o TEXTO EXATO
              // do anúncio de onde o número saiu. É a mitigação que o JOB-01
              // exigiu — "USD 150k" tem a mesma aparência se for extraído ou
              // alucinado, e a única diferença que a pessoa pode conferir é
              // poder ler a frase original.
              <Chip
                destaque
                trecho={vaga.salaryTrecho}
                rotuloTrecho="Where this salary came from"
              >
                {salario}
              </Chip>
            )}

            {vaga.skills.map((s) => (
              <Chip key={`s-${s}`}>{s}</Chip>
            ))}

            {vaga.benefits.map((b) => (
              <Chip key={`b-${b}`}>{b}</Chip>
            ))}

            {vaga.degree && <Chip>{vaga.degree}</Chip>}

            {/* A bandeirinha **nunca vem sozinha** — o nome do país (ou o ISO)
                anda junto. Não é redundância: emoji de bandeira depende de uma
                fonte que nem todo sistema tem (medido: nenhuma fonte emoji
                nesta máquina Linux, e a bandeira vira dois quadrados). Com o
                texto ao lado, a falta da fonte custa um enfeite; sem ele,
                custaria a informação. */}
            {(bandeira || vaga.local) && (
              <Chip
                trecho={vaga.elegibilidadeTrecho}
                rotuloTrecho="Where this eligibility came from"
              >
                {bandeira && <span aria-hidden>{bandeira} </span>}
                {vaga.local ?? vaga.paisIso?.toUpperCase()}
              </Chip>
            )}

            {/* **De onde a vaga aceita candidato** — a pergunta que este
                produto existe para responder, e que os boards escondem no
                meio da descrição.

                Só aparece quando há resposta. `paisesElegiveis: null` é o
                caso comum e honesto: o anúncio não disse, e escrever
                "não aceita" seria inventar (JOB-09). */}
            {vaga.elegivelGlobal && (
              <Chip
                trecho={vaga.elegibilidadeTrecho}
                rotuloTrecho="Where this eligibility came from"
              >
                🌍 Hires anywhere
              </Chip>
            )}
            {!vaga.elegivelGlobal && vaga.paisesElegiveis?.length ? (
              <Chip
                trecho={vaga.elegibilidadeTrecho}
                rotuloTrecho="Where this eligibility came from"
              >
                Hires from {vaga.paisesElegiveis.slice(0, 3).join(', ')}
                {vaga.paisesElegiveis.length > 3 &&
                  ` +${vaga.paisesElegiveis.length - 3}`}
              </Chip>
            ) : null}
          </ul>
        </div>
      </div>
    </li>
  )
}

/**
 * A logo redonda, com as iniciais como queda.
 *
 * O `onError` importa: `logoUrl` aponta para o site da empresa, que sai do ar,
 * troca de caminho e bloqueia hotlink. Sem ele a linha ficaria com o ícone de
 * imagem quebrada — pior que as iniciais, que pelo menos identificam.
 */
function Logo({ vaga }: { vaga: Vaga }) {
  const [quebrou, setQuebrou] = useState(false)

  const base = 'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full'

  if (vaga.logoUrl && !quebrou) {
    return (
      <img
        src={vaga.logoUrl}
        // A empresa já está escrita ao lado, em texto. Repetir o nome aqui
        // faria o leitor de tela anunciar a mesma empresa duas vezes seguidas.
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setQuebrou(true)}
        className={`${base} border object-cover`}
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={`${base} text-xs font-semibold`}
      style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}
    >
      {iniciaisDe(vaga.company)}
    </span>
  )
}

/** Um chip da faixa. `destaque` é só o salário. */
function Chip({
  children,
  destaque = false,
  trecho = null,
  rotuloTrecho,
}: {
  children: React.ReactNode
  destaque?: boolean
  /** O texto exato do anúncio de onde este dado saiu. */
  trecho?: string | null
  rotuloTrecho?: string
}) {
  const [aberto, setAberto] = useState(false)
  const estilo = destaque
    ? { borderColor: 'var(--brand)', color: 'var(--brand)', fontWeight: 600 }
    : { borderColor: 'var(--border)', color: 'var(--text-muted)' }

  // Sem trecho, o chip é só um rótulo: não vira botão que não faz nada.
  if (!trecho) {
    return (
      <li className="rounded-md border px-2 py-0.5 text-xs" style={estilo}>
        {children}
      </li>
    )
  }

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        // O `title` e o rótulo acessível dizem que há algo a ver: um chip que
        // é botão sem parecer botão é um clique que ninguém descobre.
        title={rotuloTrecho}
        aria-label={`${rotuloTrecho}. ${aberto ? 'Hide' : 'Show'} the original text.`}
        className="flex min-h-6 items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
        style={estilo}
      >
        {children}
        <span aria-hidden style={{ opacity: 0.6 }}>
          {aberto ? '▴' : '▾'}
        </span>
      </button>

      {aberto && (
        // Citação literal, em fonte mono e entre aspas: precisa PARECER
        // transcrição, não texto que a aplicação escreveu.
        <div
          role="note"
          className="absolute left-0 top-full z-10 mt-1 w-72 rounded-md border p-2.5 text-xs leading-relaxed shadow-lg"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-raised)',
            color: 'var(--text)',
          }}
        >
          <span className="mb-1 block text-[0.65rem] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            From the listing
          </span>
          <q className="font-mono">{trecho}</q>
        </div>
      )}
    </li>
  )
}
