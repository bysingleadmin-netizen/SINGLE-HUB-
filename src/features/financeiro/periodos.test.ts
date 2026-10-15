import { dentro, intervaloDoPeriodo, mesesDoIntervalo, periodoAnterior } from './periodos'

// 15/10/2026 é uma quinta-feira
const HOJE = '2026-10-15'

describe('intervaloDoPeriodo', () => {
  it('cada período a partir de hoje', () => {
    expect(intervaloDoPeriodo('mes', HOJE)).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
    expect(intervaloDoPeriodo('semana', HOJE)).toEqual({ inicio: '2026-10-12', fim: '2026-10-18' })
    expect(intervaloDoPeriodo('quinzena', HOJE)).toEqual({ inicio: '2026-10-01', fim: '2026-10-15' })
    expect(intervaloDoPeriodo('quinzena', '2026-02-20')).toEqual({ inicio: '2026-02-16', fim: '2026-02-28' })
    expect(intervaloDoPeriodo('mes_anterior', HOJE)).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' })
    expect(intervaloDoPeriodo('mes_anterior', '2026-01-10')).toEqual({ inicio: '2025-12-01', fim: '2025-12-31' })
    expect(intervaloDoPeriodo('trimestre', HOJE)).toEqual({ inicio: '2026-10-01', fim: '2026-12-31' })
    expect(intervaloDoPeriodo('semestre', HOJE)).toEqual({ inicio: '2026-07-01', fim: '2026-12-31' })
    expect(intervaloDoPeriodo('ano', HOJE)).toEqual({ inicio: '2026-01-01', fim: '2026-12-31' })
  })

  it('a semana começa na segunda, mesmo vista do domingo', () => {
    expect(intervaloDoPeriodo('semana', '2026-10-18')).toEqual({ inicio: '2026-10-12', fim: '2026-10-18' })
    expect(intervaloDoPeriodo('semana', '2026-10-12')).toEqual({ inicio: '2026-10-12', fim: '2026-10-18' })
  })
})

describe('periodoAnterior', () => {
  it('o mesmo tipo de período, logo antes', () => {
    expect(periodoAnterior('mes', HOJE)).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' })
    expect(periodoAnterior('mes_anterior', HOJE)).toEqual({ inicio: '2026-08-01', fim: '2026-08-31' })
    expect(periodoAnterior('semana', HOJE)).toEqual({ inicio: '2026-10-05', fim: '2026-10-11' })
    expect(periodoAnterior('trimestre', HOJE)).toEqual({ inicio: '2026-07-01', fim: '2026-09-30' })
    expect(periodoAnterior('ano', HOJE)).toEqual({ inicio: '2025-01-01', fim: '2025-12-31' })
  })
})

describe('auxiliares', () => {
  it('dentro aceita data ou carimbo de data e hora', () => {
    const outubro = { inicio: '2026-10-01', fim: '2026-10-31' }
    expect(dentro('2026-10-31', outubro)).toBe(true)
    expect(dentro('2026-10-01T09:00:00Z', outubro)).toBe(true)
    expect(dentro('2026-11-01', outubro)).toBe(false)
    expect(dentro(null, outubro)).toBe(false)
  })

  it('meses que o intervalo toca, virando o ano', () => {
    expect(mesesDoIntervalo({ inicio: '2026-11-16', fim: '2027-02-10' })).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
    expect(mesesDoIntervalo({ inicio: '2026-10-12', fim: '2026-10-18' })).toEqual(['2026-10'])
  })
})
