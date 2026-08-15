import { WARN_INK } from '../blocks/BlockRenderer'

/**
 * A caixa de upload do currículo.
 *
 * ESTADO ATUAL: **preparada, mas desligada.** O endpoint de extração
 * (`POST /jobs/cv`) está sendo escrito em paralelo — o `CvLidoDto` já existe
 * em `backend/src/jobs/job.dto.ts`, a rota ainda não. Enquanto isso o input
 * fica `disabled` e a caixa diz que a leitura chega em seguida, em vez de
 * oferecer um botão que abriria um 404.
 *
 * O aviso de privacidade já está no lugar definitivo — **acima do botão de
 * escolher arquivo**, não em rodapé nem em modal depois da escolha. É critério
 * de aceite do card JOB-02 ("a tela avisa que o CV vai para o provedor de IA,
 * antes do upload"), e um aviso que chega depois da escolha chega tarde: a
 * decisão já foi tomada.
 *
 * Para ligar quando o endpoint existir: trocar o bloco desabilitado por
 * `<input type="file" accept=".pdf,.docx">` com a máquina
 * `ocioso/enviando/lido/recusado`, e as mensagens de erro da §6 do desenho.
 * Duas regras que o desenho fixa e não podem ser perdidas na ligação: recusa
 * **nunca** preenche campo, e erro de upload **nunca** apaga o que foi digitado.
 */
export function CaixaUploadCV() {
  return (
    <section
      aria-labelledby="cv-titulo"
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <h2 id="cv-titulo" className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden>⬆</span>
        Comece pelo seu currículo (opcional)
      </h2>

      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        A gente lê e preenche os filtros abaixo. Você confere e corrige antes de
        salvar.
      </p>

      {/* O aviso é um <p> com borda esquerda, e NÃO role="alert": alert
          interrompe o leitor de tela, e isto é contexto, não urgência. O id
          existe para o futuro input apontar com aria-describedby — quem chega
          pelo teclado ouve o aviso ao focar o botão, que é o "antes do upload"
          de quem não enxerga a tela. */}
      <div
        id="cv-privacidade"
        className="mt-4 rounded-lg border border-l-4 p-3.5 text-sm"
        style={{
          borderColor: 'var(--border)',
          borderLeftColor: WARN_INK,
          background: 'var(--surface-sunken)',
        }}
      >
        <p className="font-medium">
          <span aria-hidden>⚠ </span>O arquivo é enviado para o provedor de IA
          para ser lido.
        </p>
        <p className="mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Guardamos só o que ele entendeu: stack, senioridade e anos de
          experiência. O arquivo e o texto do currículo não ficam salvos em
          lugar nenhum.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="cv-arquivo" className="text-sm font-medium">
          Arquivo do currículo
        </label>
        <input
          id="cv-arquivo"
          type="file"
          accept=".pdf,.docx"
          disabled
          aria-describedby="cv-privacidade cv-em-breve"
          className="max-w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>

      <p id="cv-em-breve" className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        A leitura de currículo chega em seguida. Por enquanto, preencha os
        filtros abaixo — o formulário funciona inteiro sem ela.
      </p>
    </section>
  )
}
