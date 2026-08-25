/**
 * De uma URL de vaga, o par (host, ATS, slug) — sem chamar a rede (JOB-37).
 *
 * **Esta e a metade barata do card.** Toda vaga que entra ja traz `url` e
 * `company`; host e slug saem dai por parsing puro. Nenhuma chamada a mais no
 * caminho da busca, que ja leva ~58s.
 *
 * O que foi medido em 25/08, contra as 67 URLs que a busca ja tinha achado:
 *
 * | | |
 * | --- | ---: |
 * | pares (ats, slug) fora do catalogo | **0** |
 * | hosts sem slug na URL | 2 (`careers.duolingo.com`, `epicgames.com`) |
 *
 * E isso **corrige a medicao do card**, que dizia "3 empresas fora do
 * catalogo". As tres — Duolingo, Udemy, Epic Games — ja estavam la, com slug
 * de Greenhouse. O card as achou fora porque casou por NOME da empresa, e o
 * catalogo casa por (ats, slug). Ver a secao "O que foi medido de verdade" no
 * card.
 */

/**
 * Os estados de uma descoberta na fila.
 *
 * `ja_no_catalogo` existe porque **o slug so aparece na verificacao** quando a
 * URL nao o carrega. Medido em 25/08: Duolingo, Roblox e Epic Games publicam em
 * dominio proprio (`careers.duolingo.com`), a captura nao tinha slug para
 * comparar, e os tres slugs adivinhados ja estavam no catalogo. Sem este
 * estado a fila os mostraria como achado para sempre.
 */
export type EstadoDescoberta =
  | 'nova'
  | 'confirmada'
  | 'morta'
  | 'desconhecida'
  | 'ja_no_catalogo';

/** O que se aprende de uma URL de vaga sem sair da maquina. */
export interface Descoberta {
  /** Host sem `www.`, minusculo. */
  host: string;
  /** `greenhouse` | `lever` | `ashby`, ou `null` quando o host e desconhecido. */
  ats: string | null;
  /**
   * O slug do board. **String vazia** quando a URL nao o carrega — nunca
   * `null`, porque o par (host, slug) e chave unica no banco e `NULL` nao e
   * igual a `NULL` no Postgres.
   */
  slug: string;
}

/**
 * Hosts que sao o proprio ATS. O slug e o primeiro segmento do caminho.
 *
 * `job-boards.greenhouse.io/pinterest/jobs/123` → `greenhouse` + `pinterest`.
 */
const HOSTS_DE_ATS: ReadonlyArray<readonly [string, string]> = [
  ['greenhouse.io', 'greenhouse'],
  ['lever.co', 'lever'],
  ['ashbyhq.com', 'ashby'],
];

/**
 * Segmentos que nunca sao slug de board.
 *
 * Sem isto, `jobs.lever.co/jobs/abc` daria o slug `jobs`. Sao os caminhos que
 * os proprios ATS usam antes do board.
 */
const NAO_E_SLUG = new Set(['jobs', 'job', 'careers', 'career', 'job-board', 'boards', 'embed']);

/**
 * O que se aprende da URL de uma vaga. `null` quando nem host da para tirar.
 *
 * **Nunca lanca.** Ela roda no caminho da busca, e uma URL torta nao pode
 * derrubar a vaga que a carregava.
 */
export function extrair(url: string): Descoberta | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  // So http(s). `ftp://x` e `javascript:` sao URL valida para o parser e nunca
  // sao vaga.
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (!host) return null;
  const partes = u.pathname.split('/').filter(Boolean);

  // **O host conhecido vem PRIMEIRO.**
  //
  // Medido em 25/08, e foi bug meu: `boards.greenhouse.io/applovin/jobs/470...
  // ?gh_jid=4705009006` e greenhouse com o slug `applovin` bem ali no caminho.
  // Com o ramo do `gh_jid` na frente, ele caia no caso "dominio proprio" e o
  // slug era jogado fora — oito vagas da AppLovin viraram uma descoberta sem
  // slug, que a verificacao teria de adivinhar a toa. O `gh_jid` aparece
  // tambem nas URLs do proprio Greenhouse, entao ele so decide quando o host
  // NAO diz nada.
  for (const [dominio, ats] of HOSTS_DE_ATS) {
    if (host === dominio || host.endsWith(`.${dominio}`)) {
      const slug = partes.find((p) => ehSlug(p));
      return { host, ats, slug: slug ? limpar(slug) : '' };
    }
  }

  // **`gh_jid` na query prova Greenhouse por baixo, em dominio proprio.**
  //
  // Medido em 25/08: `careers.duolingo.com/jobs/8734207002?gh_jid=8734207002` e
  // `app.careerpuck.com/job-board/udemy/job/6142399004?gh_jid=...` sao os dois
  // embeds de Greenhouse — `boards-api.greenhouse.io/v1/boards/duolingo` e
  // `/udemy` respondem 200 com 80 e 14 vagas. Sem esta regra, o careerpuck
  // pareceria "um ATS novo por descobrir", e nao e: e o mesmo Greenhouse com
  // outra roupa.
  if (u.searchParams.has('gh_jid')) {
    const i = partes.indexOf('job-board');
    // `.../job-board/<slug>/job/<id>` — o careerpuck carrega o slug na URL.
    if (i >= 0 && partes[i + 1] && ehSlug(partes[i + 1])) {
      return { host, ats: 'greenhouse', slug: limpar(partes[i + 1]) };
    }
    // Dominio proprio: o `gh_jid` diz "e Greenhouse", mas nao diz de qual
    // board. O slug fica vazio e a verificacao o adivinha a partir do host.
    return { host, ats: 'greenhouse', slug: '' };
  }

  // Host desconhecido. **E o caso que interessa** — pode ser um ATS que o
  // produto ainda nao sabe consultar, e um ATS novo nao vale uma empresa: vale
  // todas as que ele hospeda.
  return { host, ats: null, slug: '' };
}

/**
 * Palpites de slug a partir do host, para quando a URL nao o carrega.
 *
 * Medido em 25/08 contra a API real: `careers.duolingo.com` → `duolingo` da 80
 * vagas, `jobs.wise.com` → `wise` da 19. E falha honestamente —
 * `app.careerpuck.com` → `careerpuck` da 404, `careers.nubank.com.br` →
 * `nubank` da 0. As duas falhas sao o resultado certo: o careerpuck **nao** e
 * um board do Greenhouse, e a Nubank nao publica ali.
 *
 * Em ordem, do mais provavel ao menos: o rotulo mais especifico do dominio
 * primeiro.
 */
export function palpitesDeSlug(host: string): string[] {
  const genericos = new Set([
    'careers', 'career', 'jobs', 'job', 'boards', 'apply', 'www', 'app',
    'com', 'io', 'co', 'net', 'org', 'ai', 'dev', 'br', 'us', 'uk', 'me',
  ]);
  const partes = host
    .split('.')
    .map((p) => limpar(p))
    .filter((p) => p && !genericos.has(p));
  // Sem duplicata e no maximo dois: cada palpite e uma chamada de rede, e a
  // terceira ja e chute sobre chute.
  return [...new Set(partes)].slice(0, 2);
}

/**
 * Este segmento pode ser um slug de board?
 *
 * Dois cortes. O primeiro e a lista de caminhos que os proprios ATS usam antes
 * do board. O segundo e o **puramente numerico**: sem ele,
 * `job-boards.greenhouse.io/jobs/1` devolvia o slug `1`, que e o ID da vaga —
 * uma descoberta inteira em cima de um numero de linha.
 */
function ehSlug(p: string): boolean {
  return !NAO_E_SLUG.has(p) && !/^\d+$/.test(p);
}

/**
 * O slug normalizado.
 *
 * Minusculo e sem query nem fragmento residual. Nao remove hifen nem
 * sublinhado: `alternative-payments` e slug legitimo de Ashby.
 */
function limpar(s: string): string {
  return decodeURIComponent(s).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 120);
}
