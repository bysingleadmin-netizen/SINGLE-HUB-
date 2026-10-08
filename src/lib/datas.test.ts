import { diffDias, hojeISO, mesesCompletos, somarDias } from './datas'

describe('hojeISO', () => {
  it('usa a data local, mesmo perto da meia-noite', () => {
    expect(hojeISO(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08')
    expect(hojeISO(new Date(2026, 0, 5, 0, 10))).toBe('2026-01-05')
  })
})

describe('somarDias', () => {
  it('atravessa mês e ano', () => {
    expect(somarDias('2026-10-30', 2)).toBe('2026-11-01')
    expect(somarDias('2026-12-31', 2)).toBe('2027-01-02')
  })

  it('aceita valores negativos', () => {
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('diffDias', () => {
  it('conta dias de uma data até a outra', () => {
    expect(diffDias('2026-10-01', '2026-10-08')).toBe(7)
    expect(diffDias('2026-10-08', '2026-10-01')).toBe(-7)
    expect(diffDias('2026-10-08', '2026-10-08')).toBe(0)
  })
})

describe('mesesCompletos', () => {
  it('só conta o mês depois que o dia do início chega', () => {
    expect(mesesCompletos('2026-01-15', '2026-10-14')).toBe(8)
    expect(mesesCompletos('2026-01-15', '2026-10-15')).toBe(9)
  })

  it('conta anos inteiros', () => {
    expect(mesesCompletos('2025-10-08', '2026-10-08')).toBe(12)
  })

  it('nunca é negativo', () => {
    expect(mesesCompletos('2026-12-01', '2026-10-08')).toBe(0)
  })
})
