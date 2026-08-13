import type { CurrencyCode } from './types'

/**
 * Moedas oferecidas. Array `const` em vez de enum: o tsconfig usa
 * `erasableSyntaxOnly`, que proibe enum de TypeScript.
 */
export const CURRENCIES: ReadonlyArray<{
  code: CurrencyCode
  label: string
  /** Bandeira em emoji. Entra no <option>, que nao aceita <img> nem SVG. */
  flag: string
}> = [
  { code: 'USD', label: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', label: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', label: 'British Pound', flag: '🇬🇧' },
  { code: 'BRL', label: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'CAD', label: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', label: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CHF', label: 'Swiss Franc', flag: '🇨🇭' },
]

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return CURRENCIES.some((c) => c.code === v)
}
