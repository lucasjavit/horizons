import type { Issuer } from './types'
import { newItemId } from './types'

/**
 * Empresas emissoras salvas no navegador.
 *
 * Mesmo tratamento do rascunho: o localStorage pode lancar excecao (janela
 * privada), vir corrompido ou de uma versao anterior. Nenhum desses casos
 * pode derrubar a pagina.
 */

const CHAVE = 'horizons.invoice.companies.v1'

export interface Company extends Issuer {
  id: string
}

export function emptyCompany(): Company {
  return { id: newItemId(), name: '', address: '', email: '', taxId: '' }
}

function saneia(bruto: unknown): Company[] {
  if (!Array.isArray(bruto)) return []
  return bruto
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => ({
      id: typeof c.id === 'string' && c.id ? c.id : newItemId(),
      name: typeof c.name === 'string' ? c.name : '',
      address: typeof c.address === 'string' ? c.address : '',
      email: typeof c.email === 'string' ? c.email : '',
      taxId: typeof c.taxId === 'string' ? c.taxId : '',
    }))
    // Empresa sem nome nao serve para escolher numa lista.
    .filter((c) => c.name.trim())
}

export function loadCompanies(): Company[] {
  let bruto: string | null = null
  try {
    bruto = localStorage.getItem(CHAVE)
  } catch {
    return []
  }
  if (!bruto) return []
  try {
    return saneia(JSON.parse(bruto))
  } catch {
    return []
  }
}

export function saveCompanies(lista: Company[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
  } catch {
    // Cota estourada ou storage bloqueado: perder a persistencia e aceitavel,
    // travar o formulario nao e.
  }
}
