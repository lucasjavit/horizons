import type { CurrencyCode } from './types'

/**
 * Moedas oferecidas. Array `const` em vez de enum: o tsconfig usa
 * `erasableSyntaxOnly`, que proibe enum de TypeScript.
 */
export const CURRENCIES: ReadonlyArray<{
  code: CurrencyCode
  label: string
}> = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
]

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return CURRENCIES.some((c) => c.code === v)
}
