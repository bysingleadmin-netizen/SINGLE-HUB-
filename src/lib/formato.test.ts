import { formatarData, formatarMoeda, iniciais } from './formato'

describe('formatarMoeda', () => {
  it('formata em reais no padrão brasileiro', () => {
    expect(formatarMoeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
    expect(formatarMoeda(0).replace(/\s/g, ' ')).toBe('R$ 0,00')
  })
})

describe('formatarData', () => {
  it('converte AAAA-MM-DD em dd/mm/aaaa', () => {
    expect(formatarData('2026-10-08')).toBe('08/10/2026')
  })

  it('aceita data com horário', () => {
    expect(formatarData('2026-10-08T14:30:00Z')).toBe('08/10/2026')
  })

  it('devolve vazio sem data', () => {
    expect(formatarData(null)).toBe('')
    expect(formatarData(undefined)).toBe('')
    expect(formatarData('')).toBe('')
  })
})

describe('iniciais', () => {
  it('usa a primeira e a última palavra', () => {
    expect(iniciais('Luan Uliana')).toBe('LU')
    expect(iniciais('  maria da silva souza ')).toBe('MS')
  })

  it('usa uma letra para nome de uma palavra', () => {
    expect(iniciais('Single')).toBe('S')
  })

  it('tem fallback para nome vazio', () => {
    expect(iniciais('')).toBe('?')
    expect(iniciais('   ')).toBe('?')
    expect(iniciais(null)).toBe('?')
  })
})
