import {
  dentro,
  intervaloAnterior,
  intervaloDoPeriodo,
  mesesDoIntervalo,
  mesesParaEscolher,
  somarMeses,
  ultimosMesesAteHoje,
} from './periodos'

const HOJE = '2026-10-15'

describe('intervaloDoPeriodo', () => {
  it('botões rápidos a partir de hoje', () => {
    expect(intervaloDoPeriodo('mes_atual', HOJE)).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
    // Quarter: os três últimos meses completos, sem o atual
    expect(intervaloDoPeriodo('quarter', HOJE)).toEqual({ inicio: '2026-07-01', fim: '2026-09-30' })
    expect(intervaloDoPeriodo('semestral', HOJE)).toEqual({ inicio: '2026-05-01', fim: '2026-10-31' })
    expect(intervaloDoPeriodo('anual', HOJE)).toEqual({ inicio: '2025-11-01', fim: '2026-10-31' })
  })

  it('um mês escolhido na lista', () => {
    expect(intervaloDoPeriodo('2026-02', HOJE)).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
  })

  it('o quarter de janeiro volta ao ano anterior', () => {
    expect(intervaloDoPeriodo('quarter', '2027-01-05')).toEqual({ inicio: '2026-10-01', fim: '2026-12-31' })
  })
})

describe('intervaloAnterior', () => {
  it('o mesmo número de meses, logo antes', () => {
    expect(intervaloAnterior({ inicio: '2026-10-01', fim: '2026-10-31' })).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' })
    expect(intervaloAnterior({ inicio: '2026-07-01', fim: '2026-09-30' })).toEqual({ inicio: '2026-04-01', fim: '2026-06-30' })
    expect(intervaloAnterior({ inicio: '2026-01-01', fim: '2026-12-31' })).toEqual({ inicio: '2025-01-01', fim: '2025-12-31' })
  })
})

describe('meses', () => {
  it('somarMeses atravessa o ano', () => {
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
    expect(somarMeses('2026-10', -12)).toBe('2025-10')
  })

  it('últimos meses até hoje', () => {
    expect(ultimosMesesAteHoje(HOJE, 3)).toEqual({ inicio: '2026-08-01', fim: '2026-10-31' })
  })

  it('lista para escolher, do atual para trás, com o nome do mês', () => {
    const lista = mesesParaEscolher(HOJE, 3)
    expect(lista).toEqual([
      { valor: '2026-10', rotulo: 'Outubro 2026' },
      { valor: '2026-09', rotulo: 'Setembro 2026' },
      { valor: '2026-08', rotulo: 'Agosto 2026' },
    ])
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
