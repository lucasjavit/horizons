import type { DadosDoEmail } from './email-corpo';
import { linhaElegibilidade, linhaSalario, linkContratado, linkDescadastro } from './email-corpo';

/**
 * O corpo da mensagem do Telegram (JOB-32).
 *
 * **Irmao de `montarCorpo`, alimentado pelos MESMOS `DadosDoEmail`.** E a
 * forma da decisao de arquitetura do card: a selecao de vagas e os dados dela
 * sao compartilhados, so a renderizacao e por canal. `linhaSalario` e
 * `linhaElegibilidade` sao reusadas daqui — a regra "afirmacao sem trecho nao
 * e afirmacao" (JOB-09) tem de valer igual nos dois canais, e ela vale por
 * serem literalmente a mesma funcao, nao por alguem lembrar de copiar.
 *
 * Funcao pura, pelo mesmo motivo do e-mail: e a parte que se confere sem
 * token de bot nenhum.
 */

/** Quantas vagas cabem numa mensagem. Mesmo teto do e-mail, mesmo motivo. */
const MAX_VAGAS = 8;

/**
 * O teto do `sendMessage`, da documentacao da Bot API.
 *
 * Mensagem maior que isto e **recusada inteira** — nao truncada pelo Telegram.
 * Por isso o corte e nosso, e com folga: o limite conta em UTF-16, e emoji e
 * acento contam mais de um. Errar para baixo custa uma vaga a menos na
 * mensagem; errar para cima custa a mensagem toda.
 */
const LIMITE_TELEGRAM = 4096;
/** A folga. O rodape com os links de um clique tem de caber depois do corte. */
const FOLGA = 400;

/**
 * **Sem `parse_mode`, e essa e a decisao de seguranca desta tela.**
 *
 * O card avisa que o escape do Telegram e diferente do HTML e que o
 * `escaparHtml` do e-mail nao serve. Ele nao serve mesmo — mas a saida melhor
 * que escapar certo e **nao ter o que escapar**: sem `parse_mode`, o Telegram
 * trata o texto como literal, e nao existe marcacao para injetar. Um titulo de
 * vaga chamado `<script>alert(1)</script>`, `*bold*` ou `[x](javascript:...)`
 * chega na tela da pessoa exatamente como esta no anuncio, que e o certo.
 *
 * O que se perde e negrito no titulo da vaga. O que se ganha e que texto de
 * terceiro — que e o que todo titulo de vaga e — nunca vira marcacao. Para uma
 * lista de vagas com link, e troca barata: o Telegram detecta URL crua
 * sozinho, entao os links continuam clicaveis sem marcacao nenhuma.
 *
 * Isto e o equivalente Telegram do susto do JOB-24 com `<script>`, e a razao
 * de nao haver `escaparTelegram` neste arquivo: nao ha escape porque nao ha
 * interpretacao.
 */
export interface CorpoDoTelegram {
  texto: string;
}

export function montarTexto(dados: DadosDoEmail): CorpoDoTelegram {
  const { nome, vagas, totalNovas, urlBase, token, cadencia } = dados;
  const mostradas = vagas.slice(0, MAX_VAGAS);

  const quantas = totalNovas === 1 ? '1 new job' : `${totalNovas} new jobs`;
  const periodo = cadencia === 'mensal' ? 'this month' : 'this week';

  const sair = linkDescadastro(urlBase, token);
  const contratado = linkContratado(urlBase, token);

  const cabecalho = [`Hi ${nome},`, '', `We found ${quantas} matching your profile ${periodo}.`, ''];

  // Cada vaga vira um bloco. Montados um a um para o corte poder acontecer
  // entre blocos: cortar no meio de uma vaga deixaria um titulo sem link.
  const blocos = mostradas.map((v) => {
    const linhas = [`• ${v.title} — ${v.company}`];
    if (v.local) linhas.push(`  ${v.local}`);

    const sal = linhaSalario(v);
    if (sal) {
      linhas.push(`  ${sal.afirmacao}`);
      // O trecho acompanha a afirmacao, sempre — mesma regra do e-mail.
      if (sal.trecho) linhas.push(`  "${sal.trecho}"`);
    }

    const eleg = linhaElegibilidade(v);
    if (eleg) {
      linhas.push(`  ${eleg.afirmacao}`);
      linhas.push(`  "${eleg.trecho}"`);
    }

    linhas.push(`  ${v.url}`);
    return linhas.join('\n');
  });

  // **Trunca em vez de quebrar em cinco mensagens** (caso de borda do card):
  // cinco notificacoes seguidas no celular e o que faz desinstalar o bot.
  const teto = LIMITE_TELEGRAM - FOLGA;
  let usado = cabecalho.join('\n').length;
  const cabem: string[] = [];
  for (const bloco of blocos) {
    // **`continue`, e nao `break`.**
    //
    // Medido pelo QA em 24/08: com `break`, uma unica vaga grande derrubava
    // a mensagem INTEIRA — 8 vagas viravam "We found 8 new jobs" e nenhum
    // anuncio, porque o primeiro bloco que nao coube parava o loop e
    // descartava os sete seguintes, todos pequenos.
    //
    // Hoje os dados reais sao curtos (titulo de ate 72 chars), mas nada na
    // ingestao limita esses campos — e a notificacao semanal chegar vazia e
    // pior que chegar sem uma vaga.
    // +2 pela linha em branco entre blocos.
    if (usado + bloco.length + 2 > teto) continue;
    cabem.push(bloco);
    usado += bloco.length + 2;
  }

  // Quantas ficaram de fora: as que nao couberam no corte de MAX_VAGAS mais as
  // que nao couberam no limite de caracteres.
  const sobraram = totalNovas - cabem.length;

  const partes = [cabecalho.join('\n'), cabem.join('\n\n')];
  if (sobraram > 0) {
    partes.push(`\nAnd ${sobraram} more: ${urlBase}/vagas`);
  }
  partes.push(
    ['', '—', `Got the job? Switch to one job a month: ${contratado}`, `Stop these: ${sair}`].join(
      '\n',
    ),
  );

  const texto = partes.join('\n');

  // Cinto e suspensorio. O calculo acima ja garante a folga, mas um `urlBase`
  // absurdamente longo ou um nome gigante poderiam furar o teto — e uma
  // mensagem recusada inteira e pior que uma cortada no fim.
  return { texto: texto.length > LIMITE_TELEGRAM ? texto.slice(0, LIMITE_TELEGRAM) : texto };
}
