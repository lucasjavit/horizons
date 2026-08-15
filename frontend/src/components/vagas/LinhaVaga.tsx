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
 * **Campo ausente não aparece.** Nenhum "não informado", nenhum traço, nenhum
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
              <Chip destaque>{salario}</Chip>
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
              <Chip>
                {bandeira && <span aria-hidden>{bandeira} </span>}
                {vaga.local ?? vaga.paisIso?.toUpperCase()}
              </Chip>
            )}
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
}: {
  children: React.ReactNode
  destaque?: boolean
}) {
  return (
    <li
      className="rounded-md border px-2 py-0.5 text-xs"
      style={
        destaque
          ? { borderColor: 'var(--brand)', color: 'var(--brand)', fontWeight: 600 }
          : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
      }
    >
      {children}
    </li>
  )
}
