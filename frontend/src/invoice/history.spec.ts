/**
 * Camada 1 — `invoice/history.ts` (QA-04).
 *
 * O historico local das invoices baixadas. Duas regras carregam o modulo, e as
 * duas sao faceis de quebrar sem ninguem perceber:
 *
 * 1. **A assinatura decide o que e "a mesma invoice".** Baixar de novo sem
 *    mudar nada nao pode criar registro repetido; abrir a do mes passado,
 *    trocar o periodo e baixar TEM de criar um novo. A assinatura compara o
 *    conteudo que vai para o documento, e ignora o resto.
 * 2. **A copia e profunda.** Sem ela o registro seguiria mudando junto com o
 *    rascunho que a pessoa continua editando — o historico reescreveria o
 *    passado a cada tecla.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearHistory, loadHistory, recordDownload, removeFromHistory } from './history'
import { emptyDraft, newItemId } from './types'
import type { InvoiceDraft } from './types'

const CHAVE = 'horizons.invoice.history.v1'

function draft(over: Partial<InvoiceDraft> = {}): InvoiceDraft {
  return {
    ...emptyDraft(),
    invoiceNumber: 'INV-001',
    issueDate: '2026-09-01',
    from: { name: 'Lucas', address: 'Rua A', email: 'l@e.co', taxId: '123' },
    billTo: { name: 'Acme', address: 'Av B', email: 'a@e.co' },
    items: [{ id: newItemId(), description: 'Logo design', quantity: '1', rate: '500' }],
    ...over,
  }
}

describe('historico local', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('gravar e ler', () => {
    it('sem nada guardado, o historico e vazio', () => {
      expect(loadHistory()).toEqual([])
    })

    it('a invoice baixada entra no historico', () => {
      const lista = recordDownload(draft())
      expect(lista).toHaveLength(1)
      expect(lista[0].draft.invoiceNumber).toBe('INV-001')
      expect(loadHistory()).toHaveLength(1)
    })

    it('cada registro ganha id e data', () => {
      const [e] = recordDownload(draft())
      expect(e.id).toBeTruthy()
      expect(Number.isNaN(Date.parse(e.savedAt))).toBe(false)
    })

    it('a mais recente fica no topo', () => {
      recordDownload(draft({ invoiceNumber: 'INV-001' }))
      const lista = recordDownload(draft({ invoiceNumber: 'INV-002' }))
      expect(lista.map((e) => e.draft.invoiceNumber)).toEqual(['INV-002', 'INV-001'])
    })
  })

  describe('a assinatura — o que conta como "a mesma invoice"', () => {
    it('baixar duas vezes SEM mudar nada nao duplica', () => {
      // ⚠️ O ponto do modulo. Clicar em baixar de novo e gesto comum (o PDF
      // abriu na aba errada, a pessoa repete) e nao pode encher o historico.
      recordDownload(draft())
      const lista = recordDownload(draft())
      expect(lista).toHaveLength(1)
    })

    it('a repetida SOBE para o topo, porque foi usada de novo', () => {
      recordDownload(draft({ invoiceNumber: 'INV-001' }))
      recordDownload(draft({ invoiceNumber: 'INV-002' }))
      const lista = recordDownload(draft({ invoiceNumber: 'INV-001' }))
      expect(lista).toHaveLength(2)
      expect(lista[0].draft.invoiceNumber).toBe('INV-001')
    })

    it('a repetida mantem o id e renova a data', () => {
      const [antes] = recordDownload(draft())
      const [depois] = recordDownload(draft())
      expect(depois.id).toBe(antes.id)
      expect(Date.parse(depois.savedAt)).toBeGreaterThanOrEqual(Date.parse(antes.savedAt))
    })

    it('mudar o numero cria registro novo', () => {
      recordDownload(draft({ invoiceNumber: 'INV-001' }))
      expect(recordDownload(draft({ invoiceNumber: 'INV-002' }))).toHaveLength(2)
    })

    it('mudar a data de emissao cria registro novo', () => {
      // O caso que o modulo nomeia: abrir a do mes passado, trocar o periodo e
      // baixar. Sao duas faturas, e o historico precisa das duas.
      recordDownload(draft({ issueDate: '2026-08-01' }))
      expect(recordDownload(draft({ issueDate: '2026-09-01' }))).toHaveLength(2)
    })

    it('mudar o valor de uma linha cria registro novo', () => {
      recordDownload(draft())
      const outro = draft({
        items: [{ id: newItemId(), description: 'Logo design', quantity: '1', rate: '900' }],
      })
      expect(recordDownload(outro)).toHaveLength(2)
    })

    it('mudar o cliente cria registro novo', () => {
      recordDownload(draft())
      const outro = draft({ billTo: { name: 'Outra', address: 'Av B', email: 'a@e.co' } })
      expect(recordDownload(outro)).toHaveLength(2)
    })

    it('mudar a moeda cria registro novo', () => {
      recordDownload(draft({ currency: 'USD' }))
      expect(recordDownload(draft({ currency: 'EUR' }))).toHaveLength(2)
    })

    it('o ID da linha NAO entra na assinatura', () => {
      // ⚠️ Os ids sao gerados a cada montagem do rascunho e nao vao para o
      // documento. Se entrassem, NADA seria igual a nada — a deduplicacao
      // morreria em silencio e o historico duplicaria a cada download.
      recordDownload(draft({ items: [{ id: 'a', description: 'X', quantity: '1', rate: '10' }] }))
      const lista = recordDownload(
        draft({ items: [{ id: 'b-diferente', description: 'X', quantity: '1', rate: '10' }] }),
      )
      expect(lista).toHaveLength(1)
    })

    it('espaco em volta do texto nao cria registro novo', () => {
      // A assinatura usa `.trim()`: um espaco a mais no numero e a mesma
      // fatura, e o documento sai igual.
      recordDownload(draft({ invoiceNumber: 'INV-001' }))
      expect(recordDownload(draft({ invoiceNumber: '  INV-001  ' }))).toHaveLength(1)
    })

    it('o texto livre de pagamento NAO conta na assinatura', () => {
      // `paymentDetails` nao entra em `assinatura()` — este teste documenta o
      // comportamento atual, para que mudar isso seja uma escolha e nao um
      // acidente.
      recordDownload(draft({ paymentDetails: 'Pago via Wise' }))
      expect(recordDownload(draft({ paymentDetails: 'Pago via PIX' }))).toHaveLength(1)
    })
  })

  describe('a copia profunda', () => {
    it('editar o rascunho DEPOIS nao reescreve o historico', () => {
      // ⚠️ Sem `JSON.parse(JSON.stringify(...))` o registro compartilharia os
      // objetos com o rascunho vivo, e o historico mudaria a cada tecla.
      //
      // ⚠️ E a afirmacao tem de ser sobre a lista EM MEMORIA, e nao so sobre o
      // que volta do `loadHistory()`. Medido em 01/09 removendo a copia
      // profunda: este teste continuava passando, porque `loadHistory()`
      // re-parseia o JSON do localStorage — e o round-trip corta a referencia
      // sozinho, escondendo o defeito. O que a tela segura na mao e a lista
      // devolvida pelo `recordDownload()`, e e la que o vazamento aparece.
      const vivo = draft()
      const listaViva = recordDownload(vivo)

      vivo.invoiceNumber = 'MUDADO'
      vivo.items[0].rate = '99999'
      vivo.billTo.name = 'Outro cliente'

      expect(listaViva[0].draft.invoiceNumber).toBe('INV-001')
      expect(listaViva[0].draft.items[0].rate).toBe('500')
      expect(listaViva[0].draft.billTo.name).toBe('Acme')

      // E o que foi gravado tambem, pelo mesmo motivo visto do outro lado.
      const [guardado] = loadHistory()
      expect(guardado.draft.invoiceNumber).toBe('INV-001')
      expect(guardado.draft.items[0].rate).toBe('500')
      expect(guardado.draft.billTo.name).toBe('Acme')
    })

    it('o objeto devolvido tambem esta desacoplado do rascunho', () => {
      const vivo = draft()
      const [entrada] = recordDownload(vivo)
      vivo.items[0].description = 'trocado'
      expect(entrada.draft.items[0].description).toBe('Logo design')
    })
  })

  describe('remover e limpar', () => {
    it('removeFromHistory tira so o pedido', () => {
      recordDownload(draft({ invoiceNumber: 'INV-001' }))
      const lista = recordDownload(draft({ invoiceNumber: 'INV-002' }))
      const alvo = lista.find((e) => e.draft.invoiceNumber === 'INV-001')!

      const depois = removeFromHistory(alvo.id)
      expect(depois).toHaveLength(1)
      expect(depois[0].draft.invoiceNumber).toBe('INV-002')
    })

    it('remover id inexistente nao mexe em nada', () => {
      recordDownload(draft())
      expect(removeFromHistory('nao-existe')).toHaveLength(1)
    })

    it('a remocao persiste', () => {
      const [e] = recordDownload(draft())
      removeFromHistory(e.id)
      expect(loadHistory()).toEqual([])
    })

    it('clearHistory apaga tudo', () => {
      recordDownload(draft({ invoiceNumber: 'INV-001' }))
      recordDownload(draft({ invoiceNumber: 'INV-002' }))
      clearHistory()
      expect(loadHistory()).toEqual([])
    })
  })

  describe('o teto de 200 registros', () => {
    it('o que passa de 200 e cortado ao gravar', () => {
      // O corte e por seguranca, nao por espaco (cabem ~9.000 em 5 MB). O que
      // importa e nao crescer sem limite.
      const muitos = Array.from({ length: 205 }, (_, i) => ({
        id: `id-${i}`,
        savedAt: new Date().toISOString(),
        draft: draft({ invoiceNumber: `INV-${i}` }),
      }))
      localStorage.setItem(CHAVE, JSON.stringify(muitos))

      // Um download novo regrava a lista, e e a gravacao que corta.
      const lista = recordDownload(draft({ invoiceNumber: 'NOVA' }))
      expect(lista[0].draft.invoiceNumber).toBe('NOVA')
      expect(loadHistory()).toHaveLength(200)
    })

    it('o mais NOVO sobrevive ao corte, e o mais velho cai', () => {
      const muitos = Array.from({ length: 200 }, (_, i) => ({
        id: `id-${i}`,
        savedAt: new Date().toISOString(),
        draft: draft({ invoiceNumber: `INV-${i}` }),
      }))
      localStorage.setItem(CHAVE, JSON.stringify(muitos))

      recordDownload(draft({ invoiceNumber: 'NOVA' }))
      const guardado = loadHistory()
      expect(guardado[0].draft.invoiceNumber).toBe('NOVA')
      // `INV-199` era o ultimo e foi empurrado para fora pelo corte.
      expect(guardado.map((e) => e.draft.invoiceNumber)).not.toContain('INV-199')
    })
  })

  describe('o que nao pode derrubar a pagina', () => {
    it('JSON corrompido vira historico vazio', () => {
      localStorage.setItem(CHAVE, '{quebrado')
      expect(loadHistory()).toEqual([])
    })

    it('conteudo que nao e lista vira vazio', () => {
      localStorage.setItem(CHAVE, JSON.stringify({ nao: 'e lista' }))
      expect(loadHistory()).toEqual([])
    })

    it('entradas malformadas sao filtradas, e as boas ficam', () => {
      localStorage.setItem(
        CHAVE,
        JSON.stringify([
          null,
          'texto',
          { id: 'sem-draft' },
          { draft: {} },
          { id: 'boa', savedAt: new Date().toISOString(), draft: draft() },
        ]),
      )
      const lista = loadHistory()
      expect(lista).toHaveLength(1)
      expect(lista[0].id).toBe('boa')
    })

    it('storage que LANCA na leitura devolve vazio', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(loadHistory()).toEqual([])
    })

    it('storage que LANCA na escrita nao propaga', () => {
      // Perder o historico e ruim; travar quem esta baixando a fatura e pior.
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() => recordDownload(draft())).not.toThrow()
    })

    it('clearHistory que LANCA nao propaga', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(() => clearHistory()).not.toThrow()
    })

    /**
     * ⚠️ BUG ABERTO — `docs/backlog/cards/INV-17-historico-corrompido-derruba-o-download.md`
     *
     * O teste entra ANTES da correcao, como o QA-02 fez com o
     * `documentos.spec.ts`. Aquele usou `it.failing`; **o Vitest 4 removeu o
     * `it.failing`** (`TypeError: it.failing is not a function` — medido em
     * 01/09), entao aqui o mesmo efeito e escrito a mao.
     *
     * A propriedade que importa e a do `.failing`, e ela esta preservada:
     * afirmar o comportamento ERRADO deixa a suite verde hoje **e a quebra no
     * dia em que alguem corrigir sem apagar este bloco** — que e o lembrete de
     * apagar. Um `skip` nao teria isso: sumiria em silencio, e teste que se
     * pula sozinho e o que o CLAUDE.md proibe.
     *
     * O defeito: o filtro do `ler()` so exige `typeof draft === 'object'`, e
     * `{}` passa; a `assinatura()` entao faz `d.invoiceNumber.trim()` e lanca
     * `TypeError`. Como `recordDownload()` assina TODO registro guardado para
     * achar a duplicata, um registro velho e ruim derruba o download de uma
     * invoice nova e valida — o unico gesto que a tela existe para fazer.
     *
     * Ao corrigir: trocar este bloco pelo `expect(...).not.toThrow()` que o
     * card descreve.
     */
    it('BUG INV-17 · registro corrompido AINDA derruba o download', () => {
      localStorage.setItem(
        CHAVE,
        JSON.stringify([{ id: 'velho', savedAt: new Date().toISOString(), draft: {} }]),
      )

      // O comportamento correto seria `.not.toThrow()`. Enquanto o bug existe,
      // e o `toThrow` que descreve a realidade — e e ele que vai falhar quando
      // a realidade mudar.
      expect(() => recordDownload(draft())).toThrow(TypeError)
    })
  })
})
