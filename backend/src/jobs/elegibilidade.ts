import type { VagaDto } from './job.dto';

/**
 * Quem pode se candidatar a esta vaga — respondido pelo campo, sem IA.
 *
 * **A pergunta que o produto existe para responder** e "esta vaga aceita quem
 * mora onde eu moro?". Os boards escondem isso no meio da descricao, e ler
 * cada anuncio com IA custaria US$ 341 no corpus inteiro (medido em 18/08).
 *
 * Medido nas 45 vagas reais que o motor de ATS trouxe em 19/08:
 *
 * | Sinal                     | Fatia |
 * | ------------------------- | ----: |
 * | `isRemote`/`workplaceType`|  71%  |
 * | "Remote, Canada" no local |  18%  |
 * | "Remote" sem pais         |  11%  |
 *
 * **A ordem dos sinais importa mais que os sinais.** O campo booleano vem
 * primeiro: 32 das 45 vagas tinham `regime: 'remoto'` com o `location`
 * mostrando escritorio ("San Francisco HQ"). Classificar pelo texto marcaria
 * 71% como presencial — todas erradas. O que a empresa preencheu num campo
 * vale mais que o que ela escreveu numa string livre.
 */

/** O que se conseguiu concluir sobre quem pode se candidatar. */
export interface Elegibilidade {
  /**
   * De onde a vaga aceita candidato, como o anuncio escreveu. Pode ser pais
   * ("Brazil"), regiao ("LATAM") ou **cidade** ("Bangalore") — o anuncio nao
   * distingue, e forcar um pais a partir da cidade seria inventar. `null`
   * quando nao se sabe; nunca lista vazia, que a tela leria como "nao aceita
   * ninguem".
   */
  paises: string[] | null;
  /** A vaga aceita candidato de qualquer lugar? */
  global: boolean;
  /** O texto do anuncio que sustenta a conclusao. Sem ele, nao ha conclusao. */
  trecho: string | null;
  /** `true` quando so a IA pode responder — o resto ja foi decidido aqui. */
  precisaLer: boolean;
}

/** Termos que significam "de qualquer lugar", sem restricao geografica. */
const SEM_FRONTEIRA =
  /\b(worldwide|world wide|anywhere|global(ly)?|fully remote|remote - global|any location|location independent)\b/i;

/**
 * "Remote, Canada" ou "Canada - Remote" — remoto COM pais amarrado.
 *
 * O pais aqui e restricao, nao endereco: a empresa aceita trabalho remoto,
 * mas so de quem mora naquele pais.
 */
const REMOTO_COM_PAIS = /remote\s*[,–-]\s*([^;|/]+)|([^;|/]+?)\s*[–-]\s*remote/gi;

/** Nomes que aparecem depois de "Remote," e NAO sao pais. */
const NAO_E_PAIS = new Set([
  'hq', 'office', 'hybrid', 'onsite', 'on-site', 'remote', 'global',
  'worldwide', 'anywhere', 'first', 'friendly', 'optional', 'ok',
]);

/**
 * Le a elegibilidade do que a vaga ja traz, sem chamar IA.
 *
 * Devolve `precisaLer: true` so quando os campos nao bastam — e o unico caso
 * em que vale gastar um token.
 */
export function lerElegibilidade(v: VagaDto): Elegibilidade {
  const local = (v.local ?? '').trim();
  const remotoPorCampo = v.regime === 'remoto';

  // 1. Sem fronteira declarada: aceita de qualquer lugar.
  if (SEM_FRONTEIRA.test(local)) {
    return { paises: null, global: true, trecho: local, precisaLer: false };
  }

  // 2. Remoto com pais amarrado: "Remote, Canada".
  const paises = extrairPaises(local);
  if (paises.length > 0) {
    return { paises, global: false, trecho: local, precisaLer: false };
  }

  // 3. O local nomeia um lugar, mesmo sem a palavra "remote".
  //
  // "Serbia", "New York City Office", "San Francisco HQ" — a empresa disse
  // ONDE, e isso responde a pergunta tanto para vaga presencial quanto para
  // remota: uma vaga remota ancorada em Belgrado aceita quem esta na Servia,
  // nao quem esta no Brasil. So marcar `[IA]` aqui jogaria 84% do corpus na
  // chamada cara (medido em 19/08: era o que acontecia).
  //
  // O escritorio E a restricao ate que a descricao diga o contrario. Errar
  // para o lado restritivo e o certo: a vaga aparece com o pais dela, e quem
  // mora fora ve que nao bate — em vez de receber um "aceita todo mundo" sem
  // base, que e o erro do JOB-09.
  const lugar = lugarNomeado(local);
  if (lugar) {
    return { paises: [lugar], global: false, trecho: local, precisaLer: false };
  }

  // 4. Remoto confirmado por campo, mas sem nenhum lugar legivel.
  //
  // E o unico caso que sobra para a IA: a empresa marcou `isRemote: true` e
  // nao disse de onde. "Nao disse" nao e "aceita todo mundo" — so a descricao
  // resolve.
  if (remotoPorCampo) {
    return { paises: null, global: false, trecho: local || null, precisaLer: true };
  }

  // 5. Nenhum sinal. Sem local e sem regime, so a descricao resolve.
  return { paises: null, global: false, trecho: null, precisaLer: true };
}

/**
 * A pessoa que mora em `pais` pode se candidatar?
 *
 * `null` e resposta legitima, e diferente de `false`: **"nao disse" nao e
 * "nao aceita"**. Foi o erro que o JOB-09 corrigiu na extracao por IA, e a
 * mesma regra vale aqui.
 */
export function aceitaQuemMoraEm(e: Elegibilidade, pais: string): boolean | null {
  if (e.global) return true;
  if (e.precisaLer || e.paises === null) return null;
  const alvo = normalizar(pais);
  return e.paises.some((p) => {
    const n = normalizar(p);
    return n.includes(alvo) || alvo.includes(n);
  });
}

/**
 * O local nomeia um lugar reconhecivel?
 *
 * Limpa o ruido que os ATS penduram no campo — "HQ", "Office", "(Hybrid)" —
 * e devolve o que sobrou, se sobrou algo com cara de lugar.
 */
function lugarNomeado(local: string): string | null {
  if (!local) return null;
  const limpo = limparLugar(
    local.replace(/\b(hq|office|headquarters|hybrid|onsite|on-site|remote|remoto)\b/gi, ''),
  );
  // Duas letras nao dizem nada; "US" e "UK" viriam pelo caminho do pais.
  return limpo && limpo.length >= 3 ? limpo : null;
}

/**
 * Tira a cauda que os ATS penduram no nome do lugar.
 *
 * **A ordem importa**, e errar nela deixa lixo: "LATAM [Remote]" com a
 * palavra removida antes dos colchetes vira `LATAM []` (medido em 20/08).
 * Por isso os delimitadores e o que esta dentro deles saem PRIMEIRO, e a
 * pontuacao solta no fim por ultimo.
 */
function limparLugar(bruto: string): string | null {
  const limpo = bruto
    .replace(/\(.*?\)/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/[[\]{}()]/g, ' ')
    .replace(/[,;|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;|/-]+|[\s,;|/-]+$/g, '')
    .trim();
  return limpo.length > 0 ? limpo : null;
}

function extrairPaises(local: string): string[] {
  if (!local) return [];
  const achados: string[] = [];
  for (const m of local.matchAll(REMOTO_COM_PAIS)) {
    const bruto = (m[1] ?? m[2] ?? '').trim();
    if (!bruto) continue;
    const limpo = limparLugar(bruto);
    if (!limpo || limpo.length < 3) continue;
    if (NAO_E_PAIS.has(limpo.toLowerCase())) continue;
    if (!achados.some((a) => a.toLowerCase() === limpo.toLowerCase())) {
      achados.push(limpo);
    }
  }
  return achados;
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
