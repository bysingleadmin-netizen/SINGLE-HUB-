import {
  CHAVE_EXPANDIDA,
  RECOLHIDA,
  guardarExpandida,
  lerExpandida,
  registrosVisiveis,
  temMaisNas24h,
} from './atividadeRecolhivel'

const AGORA = new Date('2026-10-14T12:00:00Z')
const horasAtras = (h: number) => ({ id: `r${h}`, created_at: new Date(AGORA.getTime() - h * 3_600_000).toISOString() })

describe('registrosVisiveis', () => {
  const registros = [1, 2, 3, 5, 8, 20, 30, 50].map(horasAtras)

  it('recolhida mostra só os 4 mais recentes', () => {
    expect(registrosVisiveis(registros, false, AGORA).map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r5'])
    expect(RECOLHIDA).toBe(4)
  })

  it('expandida mostra tudo das últimas 24 horas e nada mais antigo', () => {
    expect(registrosVisiveis(registros, true, AGORA).map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r5', 'r8', 'r20'])
  })

  it('sem nada nas últimas 24 horas, expandida mostra os 4 mais recentes que houver', () => {
    const antigos = [30, 40, 50, 60, 70].map(horasAtras)
    expect(registrosVisiveis(antigos, true, AGORA)).toHaveLength(4)
  })

  it('temMaisNas24h diz se expandir mostra algo a mais', () => {
    expect(temMaisNas24h(registros, AGORA)).toBe(true)
    expect(temMaisNas24h([1, 2, 30].map(horasAtras), AGORA)).toBe(false)
  })
})

describe('estado guardado', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('lê e grava no localStorage', () => {
    expect(lerExpandida()).toBe(false)
    guardarExpandida(true)
    expect(localStorage.getItem(CHAVE_EXPANDIDA)).toBe('1')
    expect(lerExpandida()).toBe(true)
  })

  it('com o armazenamento bloqueado, começa recolhida e não quebra', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(lerExpandida()).toBe(false)
    expect(() => guardarExpandida(true)).not.toThrow()
  })
})
