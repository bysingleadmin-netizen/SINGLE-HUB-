import { geometriaDoGrafico, pontoMaisProximo, variacao } from './grafico'

const SERIE = [
  { mes: '2026-05', rotulo: 'mai', valor: 0 },
  { mes: '2026-06', rotulo: 'jun', valor: 1500 },
  { mes: '2026-07', rotulo: 'jul', valor: 9500 },
]

describe('geometriaDoGrafico', () => {
  it('ocupa a área inteira deixando 16 px de respiro em cada lado', () => {
    const { pontos, base } = geometriaDoGrafico(SERIE, 480, 300)
    expect(pontos[0].x).toBe(16)
    expect(pontos[2].x).toBe(464)
    // Em cima cabe o rótulo do valor; embaixo, o do mês
    expect(Math.min(...pontos.map((p) => p.y))).toBeGreaterThanOrEqual(16)
    expect(base).toBeLessThanOrEqual(300 - 16)
    expect(pontos[0].y).toBe(base)
  })

  it('acompanha a altura que recebe', () => {
    const baixo = geometriaDoGrafico(SERIE, 480, 160)
    const alto = geometriaDoGrafico(SERIE, 480, 400)
    expect(alto.base - alto.pontos[2].y).toBeGreaterThan(baixo.base - baixo.pontos[2].y)
  })

  it('com tudo zerado, a linha fica na base em vez de dividir por zero', () => {
    const zerada = SERIE.map((p) => ({ ...p, valor: 0 }))
    const { pontos, base } = geometriaDoGrafico(zerada, 480, 200)
    expect(pontos.every((p) => p.y === base)).toBe(true)
  })

  it('aguenta série de um ponto só', () => {
    const { pontos } = geometriaDoGrafico([SERIE[1]], 480, 200)
    expect(Number.isFinite(pontos[0].x)).toBe(true)
  })
})

describe('pontoMaisProximo', () => {
  const pontos = [{ x: 16 }, { x: 240 }, { x: 464 }]

  it('acha o ponto mais perto do mouse, inclusive fora das pontas', () => {
    expect(pontoMaisProximo(pontos, -50)).toBe(0)
    expect(pontoMaisProximo(pontos, 130)).toBe(1)
    expect(pontoMaisProximo(pontos, 900)).toBe(2)
  })

  it('sem pontos não há o que destacar', () => {
    expect(pontoMaisProximo([], 10)).toBeNull()
  })
})

describe('variacao', () => {
  it('compara o último mês com o anterior', () => {
    expect(variacao([{ valor: 1000 }, { valor: 1250 }])).toBe(0.25)
    expect(variacao([{ valor: 2000 }, { valor: 1500 }])).toBe(-0.25)
  })

  it('não inventa percentual sem base de comparação', () => {
    expect(variacao([{ valor: 500 }])).toBeNull()
    expect(variacao([{ valor: 0 }, { valor: 500 }])).toBeNull()
  })
})
