import type { FiltrosDto } from './job.dto';

/**
 * Assinatura dos filtros: perfis com a mesma assinatura leem as mesmas vagas.
 *
 * E o que impede N perfis virarem N buscas a cada 50 minutos — decisao do
 * stakeholder, e a diferenca entre a feature caber no orcamento ou nao.
 *
 * Sai de tres campos, e nao de todos: senioridade, tecnologias e regiao sao os
 * que mudam **quais vagas existem**. Salario minimo e palavra excluida mudam
 * quais interessam a cada pessoa, e isso se filtra depois, sobre o mesmo
 * resultado — colocar salario na assinatura faria "senior React 8k" e "senior
 * React 12k" dispararem duas buscas identicas.
 */
export function assinaturaDoGrupo(filtros: FiltrosDto): string {
  const senioridade = normalizar(filtros.seniority) || 'qualquer';

  // Ordenado e sem repetido: "React, Node" e "node,react" tem de cair no mesmo
  // grupo, senao a ordem em que a pessoa digitou criaria buscas duplicadas.
  const stack = unicoOrdenado(filtros.technologies);

  // O cargo entra junto da stack: "Data Engineer Python" e "Backend Python"
  // procuram vagas diferentes, ainda que a tecnologia coincida.
  const cargos = unicoOrdenado(filtros.job_titles);

  // Regiao e o par regime + locais. Remoto sem local declarado e um grupo por
  // si: e a busca mais ampla, e a que mais gente compartilha.
  const regime = normalizar(filtros.remote) || 'qualquer';
  const locais = unicoOrdenado(filtros.locations);
  const regiao = [regime, locais.join('+') || 'qualquer'].join(':');

  return [
    senioridade,
    stack.join('+') || 'qualquer',
    cargos.join('+') || 'qualquer',
    regiao,
  ].join('|');
}

/**
 * Minusculas, sem acento e sem espaco sobrando.
 *
 * Sem isto "São Paulo" e "sao paulo" viram grupos diferentes, e a busca roda
 * duas vezes para o mesmo resultado.
 */
function normalizar(valor: string | undefined): string {
  if (!valor) return '';
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function unicoOrdenado(lista: string[] | undefined): string[] {
  if (!lista?.length) return [];
  const limpos = lista.map(normalizar).filter(Boolean);
  return [...new Set(limpos)].sort();
}
