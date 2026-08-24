import type { VagaDto } from '../jobs/job.dto';

/**
 * O corpo do e-mail semanal.
 *
 * **Em ingles, como o resto da aba Jobs.** O idioma misto e deliberado no
 * Horizons: trilhas em portugues, vagas e invoice em ingles porque miram o
 * mercado global. Quem recebe este e-mail esta procurando vaga la fora.
 *
 * Funcao pura, separada do servico de envio, porque e a parte que se confere
 * sem SMTP: da para gerar o corpo, abrir no navegador e ler. Com o provedor
 * de log como default (nao ha SMTP), isto e a unica forma de verificar o
 * e-mail de verdade hoje.
 */

/** Quantas vagas cabem numa mensagem. */
const MAX_VAGAS = 8;

/**
 * O teto existe pelo que o card diz: **"melhor tres vagas certas que trinta"**.
 *
 * Uma lista de 40 itens nao e lida — e arquivada. Oito cabe numa tela de
 * celular sem rolar ate o fim, e o link para o site cobre o resto.
 */
export interface DadosDoEmail {
  nome: string;
  vagas: VagaDto[];
  /** Quantas vagas novas existiam ao todo, antes do corte de `MAX_VAGAS`. */
  totalNovas: number;
  /** Base publica do site, para montar os links de um clique. */
  urlBase: string;
  token: string;
  cadencia: string;
}

export interface CorpoDoEmail {
  assunto: string;
  html: string;
  texto: string;
}

/**
 * Escapa o que vai para dentro do HTML.
 *
 * Titulo e empresa vem de anuncio de terceiro — texto que nunca foi validado
 * por nos. Uma empresa chamada `<script>` nao deve virar script no cliente de
 * e-mail de ninguem, e aspas soltas quebrariam o `href`.
 */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A linha de elegibilidade de uma vaga, **com o trecho que a prova**.
 *
 * Regra do JOB-09, e a razao de este produto existir: a afirmacao "aceita quem
 * mora no Brasil" sem o texto que a sustenta e um palpite com cara de fato. Se
 * nao ha trecho, NAO ha afirmacao — devolve `null` e a vaga sai sem a linha,
 * em vez de sair com uma promessa que ninguem pode conferir.
 */
export function linhaElegibilidade(vaga: VagaDto): { afirmacao: string; trecho: string } | null {
  if (!vaga.elegibilidadeTrecho) return null;

  if (vaga.elegivelGlobal) {
    return { afirmacao: 'Open to candidates anywhere', trecho: vaga.elegibilidadeTrecho };
  }
  if (vaga.paisesElegiveis?.length) {
    return {
      afirmacao: `Hires from: ${vaga.paisesElegiveis.join(', ')}`,
      trecho: vaga.elegibilidadeTrecho,
    };
  }
  return null;
}

/** O salario, so quando ha moeda E valor. "150K—200K USD / year". */
export function linhaSalario(vaga: VagaDto): { afirmacao: string; trecho: string | null } | null {
  if (!vaga.currency) return null;
  if (vaga.salaryMin == null && vaga.salaryMax == null) return null;

  const k = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v));
  const faixa =
    vaga.salaryMin != null && vaga.salaryMax != null
      ? `${k(vaga.salaryMin)}—${k(vaga.salaryMax)}`
      : k((vaga.salaryMin ?? vaga.salaryMax) as number);

  return {
    afirmacao: `${faixa} ${vaga.currency} / year`,
    trecho: vaga.salaryTrecho,
  };
}

/** O link de um clique que descadastra. Sem login: o token e a credencial. */
export function linkDescadastro(urlBase: string, token: string): string {
  return `${urlBase}/email/sair?t=${encodeURIComponent(token)}`;
}

/** O link do "consegui a vaga" (JOB-25). Mesmo mecanismo de token. */
export function linkContratado(urlBase: string, token: string): string {
  return `${urlBase}/email/contratado?t=${encodeURIComponent(token)}`;
}

export function montarCorpo(dados: DadosDoEmail): CorpoDoEmail {
  const { nome, vagas, totalNovas, urlBase, token, cadencia } = dados;
  const mostradas = vagas.slice(0, MAX_VAGAS);
  const sobraram = totalNovas - mostradas.length;

  const quantas = totalNovas === 1 ? '1 new job' : `${totalNovas} new jobs`;
  const periodo = cadencia === 'mensal' ? 'this month' : 'this week';
  const assunto = `${quantas} for you ${periodo}`;

  const sair = linkDescadastro(urlBase, token);
  const contratado = linkContratado(urlBase, token);

  // ---- texto puro ----
  const linhasTexto: string[] = [
    `Hi ${nome},`,
    '',
    `We found ${quantas} matching your profile ${periodo}.`,
    '',
  ];
  for (const v of mostradas) {
    linhasTexto.push(`* ${v.title} — ${v.company}`);
    if (v.local) linhasTexto.push(`  Location: ${v.local}`);
    const sal = linhaSalario(v);
    if (sal) {
      linhasTexto.push(`  Salary: ${sal.afirmacao}`);
      // O trecho vai junto da afirmacao, sempre. Ver `linhaElegibilidade`.
      if (sal.trecho) linhasTexto.push(`    from the posting: "${sal.trecho}"`);
    }
    const eleg = linhaElegibilidade(v);
    if (eleg) {
      linhasTexto.push(`  ${eleg.afirmacao}`);
      linhasTexto.push(`    from the posting: "${eleg.trecho}"`);
    }
    linhasTexto.push(`  ${v.url}`);
    linhasTexto.push('');
  }
  if (sobraram > 0) {
    linhasTexto.push(`And ${sobraram} more at ${urlBase}/vagas`);
    linhasTexto.push('');
  }
  linhasTexto.push('---');
  linhasTexto.push(`Got the job? Tell us and switch to one job a month: ${contratado}`);
  linhasTexto.push(`Stop these emails: ${sair}`);

  // ---- html ----
  // Estilo inline e tabela-livre: cliente de e-mail ignora <style> no head e
  // nao tem tokens CSS. Isto NAO segue a regra de cor por variavel do
  // frontend de proposito — nao ha :root aqui, do mesmo jeito que o PDF da
  // invoice usa hex cru.
  const cartoes = mostradas
    .map((v) => {
      const partes: string[] = [
        `<div style="font-size:16px;font-weight:600;color:#111827;">${escaparHtml(v.title)}</div>`,
        `<div style="font-size:14px;color:#4b5563;margin-top:2px;">${escaparHtml(v.company)}${
          v.local ? ` · ${escaparHtml(v.local)}` : ''
        }</div>`,
      ];

      const sal = linhaSalario(v);
      if (sal) {
        partes.push(
          `<div style="font-size:14px;color:#065f46;margin-top:8px;">${escaparHtml(sal.afirmacao)}</div>`,
        );
        if (sal.trecho) {
          partes.push(citacao(sal.trecho));
        }
      }

      const eleg = linhaElegibilidade(v);
      if (eleg) {
        partes.push(
          `<div style="font-size:14px;color:#111827;margin-top:8px;">${escaparHtml(eleg.afirmacao)}</div>`,
        );
        partes.push(citacao(eleg.trecho));
      }

      partes.push(
        `<div style="margin-top:12px;"><a href="${escaparHtml(v.url)}" style="font-size:14px;color:#1d4ed8;">View job</a></div>`,
      );

      return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;background:#ffffff;">${partes.join(
        '',
      )}</div>`;
    })
    .join('');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;padding:24px;">
<div style="max-width:600px;margin:0 auto;">
<p style="font-size:16px;color:#111827;">Hi ${escaparHtml(nome)},</p>
<p style="font-size:15px;color:#4b5563;">We found <strong>${escaparHtml(quantas)}</strong> matching your profile ${escaparHtml(periodo)}.</p>
${cartoes}
${
  sobraram > 0
    ? `<p style="font-size:14px;color:#4b5563;">And ${sobraram} more on <a href="${escaparHtml(urlBase)}/vagas" style="color:#1d4ed8;">your jobs page</a>.</p>`
    : ''
}
<div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:16px;">
<p style="font-size:14px;color:#111827;margin:0 0 12px;">Got the job? 🎉</p>
<p style="font-size:13px;color:#4b5563;margin:0 0 12px;">Tell us and we'll switch you to one hand-picked job a month, so you keep an eye on the market without looking for it.</p>
<a href="${escaparHtml(contratado)}" style="display:inline-block;background:#065f46;color:#ffffff;padding:10px 16px;border-radius:6px;font-size:14px;text-decoration:none;">I got the job 🎉</a>
</div>
<p style="font-size:12px;color:#6b7280;margin-top:24px;">
<a href="${escaparHtml(sair)}" style="color:#6b7280;">Stop these emails</a>
</p>
</div>
</div>`;

  return { assunto, html, texto: linhasTexto.join('\n') };
}

/** O trecho do anuncio, visualmente subordinado a afirmacao que ele prova. */
function citacao(trecho: string): string {
  return `<div style="font-size:13px;color:#6b7280;border-left:3px solid #d1d5db;padding-left:10px;margin-top:4px;font-style:italic;">“${escaparHtml(
    trecho,
  )}”</div>`;
}
