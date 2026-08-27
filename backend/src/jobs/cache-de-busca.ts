import { createHash } from 'node:crypto';
import type { FiltrosDto } from './job.dto';

/**
 * A assinatura de UM conjunto de filtros, para uso como chave de cache.
 *
 * **Nao e o `assinaturaDoGrupo` do `grupo.ts`, e a diferenca e o card
 * inteiro.** Aquele e grosseiro DE PROPOSITO: sai de cinco campos (senioridade,
 * stack, cargos, regime, locais) porque o trabalho dele e juntar perfis que
 * podem compartilhar uma busca agendada — "senior React 8k" e "senior React
 * 12k" tem de cair no mesmo grupo, senao viram duas buscas identicas.
 *
 * Aqui a pergunta e outra: "a pagina 2 pode vir da mesma consulta que a 1?". Um
 * campo de fora da assinatura de grupo — `countries`, `company_sizes`,
 * `posted_within_days` — muda QUAIS VAGAS a API devolve. Reusar a assinatura de
 * grupo faria a pagina 2 de `countries=['br']` vir da busca de
 * `countries=['mx']`, com vagas plausiveis do filtro errado e nada na tela
 * denunciando.
 *
 * Por isso esta percorre TODAS as chaves do objeto, e nao uma lista escrita a
 * mao: campo novo no `FiltrosDto` entra na chave sozinho. Uma lista aqui
 * envelheceria em silencio a cada eixo novo do modal — e o sintoma seria
 * exatamente o bug que ela deveria impedir.
 */
export function chaveDoCache(filtros: FiltrosDto): string {
  const partes: string[] = [];

  // Ordenado pelo nome do campo: `{a:1, b:2}` e `{b:2, a:1}` sao o mesmo
  // filtro, e a ordem em que a tela montou o objeto nao pode criar duas chaves.
  for (const campo of Object.keys(filtros).sort()) {
    const bruto = (filtros as Record<string, unknown>)[campo];
    const valor = normalizarValor(bruto);
    // Campo vazio nao entra: `{}` e `{technologies: []}` sao a mesma busca, e
    // limpar um filtro pela tela deixa a lista vazia em vez de remover a chave.
    if (valor === null) continue;
    partes.push(`${campo}=${valor}`);
  }

  // Hash e nao a string crua: os filtros somam mais de 40 eixos, e uma chave de
  // varios KB viraria a maior parte do que o Map guarda. O sha-256 truncado em
  // 32 hex da 128 bits — colisao aqui exigiria mais buscas simultaneas do que
  // o processo aguenta.
  return createHash('sha256').update(partes.join('&')).digest('hex').slice(0, 32);
}

/**
 * Um valor de filtro em forma canonica, ou `null` se ele nao diz nada.
 *
 * Lista vira ordenada e sem repetido pelo mesmo motivo do `grupo.ts`: a ordem
 * em que a pessoa clicou nos chips nao muda a consulta, e sem isto marcar
 * "React, Node" e "Node, React" seriam dois caches para o mesmo resultado.
 */
function normalizarValor(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) {
    const limpos = [...new Set(v.map((x) => texto(x)).filter((x) => x.length > 0))].sort();
    return limpos.length > 0 ? limpos.join('+') : null;
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  const t = texto(v);
  return t.length > 0 ? t : null;
}

/** Minusculas, sem acento, sem espaco sobrando — como no `grupo.ts`. */
function texto(v: unknown): string {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return '';
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
