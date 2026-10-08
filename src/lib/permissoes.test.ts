import { CARGOS, isLideranca } from './permissoes'

describe('isLideranca', () => {
  it('é verdadeiro para CEO, Founder e Co-Founder', () => {
    for (const cargo of ['CEO', 'Founder', 'Co-Founder'] as const) {
      expect(isLideranca(cargo)).toBe(true)
    }
  })

  it('é falso para os demais cargos', () => {
    for (const cargo of [
      'Gestor de Tráfego',
      'Social Media',
      'Designer',
      'Editor de Vídeo',
      'Copywriter',
    ] as const) {
      expect(isLideranca(cargo)).toBe(false)
    }
  })

  it('é falso sem cargo', () => {
    expect(isLideranca(null)).toBe(false)
    expect(isLideranca(undefined)).toBe(false)
  })

  it('a lista de cargos tem os oito cargos da agência', () => {
    expect(CARGOS).toHaveLength(8)
  })
})
