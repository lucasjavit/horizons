import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveDraft } from './storage'
import { defaultInvoiceNumber, emptyDraft } from './types'
import { rascunhoInicial, useInvoiceDraft } from './useInvoiceDraft'

// INV-21: o numero da invoice nasce `INV-AAAA-MM` e continua editavel.
describe('numero padrao da invoice', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    // Meio-dia local: longe da virada do dia, para o fuso nao decidir o mes.
    vi.setSystemTime(new Date(2026, 2, 9, 12, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('e INV-ANO-MES do mes corrente, com zero a esquerda', () => {
    expect(defaultInvoiceNumber()).toBe('INV-2026-03')
    expect(emptyDraft().invoiceNumber).toBe('INV-2026-03')
  })

  it('acompanha a virada do ano', () => {
    vi.setSystemTime(new Date(2027, 11, 31, 12, 0, 0))
    expect(defaultInvoiceNumber()).toBe('INV-2027-12')
  })

  it('sem rascunho guardado, a tela abre com o padrao', () => {
    expect(rascunhoInicial().invoiceNumber).toBe('INV-2026-03')
  })

  it('rascunho guardado com numero em branco ganha o padrao, e so o numero muda', () => {
    const guardado = { ...emptyDraft(), invoiceNumber: '  ', dueDate: '2026-04-01' }
    saveDraft(guardado)
    expect(rascunhoInicial()).toEqual({ ...guardado, invoiceNumber: 'INV-2026-03' })
  })

  it('rascunho guardado com numero proprio abre intacto', () => {
    saveDraft({ ...emptyDraft(), invoiceNumber: 'ACME-042' })
    expect(rascunhoInicial().invoiceNumber).toBe('ACME-042')
  })

  it('o campo aceita edicao livre: apagar nao traz o padrao de volta', () => {
    const { result } = renderHook(() => useInvoiceDraft())
    expect(result.current.draft.invoiceNumber).toBe('INV-2026-03')
    act(() => result.current.setCampo('invoiceNumber', ''))
    expect(result.current.draft.invoiceNumber).toBe('')
    act(() => result.current.setCampo('invoiceNumber', 'ACME-042'))
    expect(result.current.draft.invoiceNumber).toBe('ACME-042')
  })

  it('Start over devolve o padrao', () => {
    const { result } = renderHook(() => useInvoiceDraft())
    act(() => result.current.setCampo('invoiceNumber', 'ACME-042'))
    act(() => result.current.reset())
    expect(result.current.draft.invoiceNumber).toBe('INV-2026-03')
  })
})
