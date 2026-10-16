import { intervaloDoVolume, volumePorColuna } from './volume'

const COLUNAS = [
  { id: 'a_fazer', titulo: 'A Fazer' },
  { id: 'feito', titulo: 'Feito' },
]

const ITENS = [
  { coluna: 'a_fazer', cliente: 'c1', data: '2026-10-02T10:00:00Z' },
  { coluna: 'a_fazer', cliente: 'c2', data: '2026-06-10' },
  { coluna: 'feito', cliente: 'c1', data: '2026-09-30' },
  { coluna: 'feito', cliente: null, data: null },
]

describe('volumePorColuna', () => {
  it('conta por coluna, na ordem das colunas', () => {
    expect(volumePorColuna(ITENS, COLUNAS, { clienteId: '', intervalo: null }).map((b) => b.valor)).toEqual([2, 2])
  })

  it('filtra por cliente', () => {
    expect(volumePorColuna(ITENS, COLUNAS, { clienteId: 'c1', intervalo: null }).map((b) => b.valor)).toEqual([1, 1])
  })

  it('filtra pelo período; card sem data fica de fora', () => {
    const intervalo = intervaloDoVolume('3', '2026-10-15')
    expect(intervalo).toEqual({ inicio: '2026-08-01', fim: '2026-10-31' })
    expect(volumePorColuna(ITENS, COLUNAS, { clienteId: '', intervalo }).map((b) => b.valor)).toEqual([1, 1])
  })

  it('sem período, intervalo nulo; mês atual é um mês', () => {
    expect(intervaloDoVolume('', '2026-10-15')).toBeNull()
    expect(intervaloDoVolume('mes', '2026-10-15')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
  })
})
