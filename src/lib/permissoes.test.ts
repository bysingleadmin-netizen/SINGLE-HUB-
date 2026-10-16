import { CARGOS, isLideranca, normalizarCargo, podeAcessar } from './permissoes'
import type { Area, Cargo } from './permissoes'

describe('normalizarCargo', () => {
  it('mantém os cargos atuais', () => {
    for (const cargo of CARGOS) expect(normalizarCargo(cargo)).toBe(cargo)
  })

  it('leva os cargos de antes da migration 0010 para os novos', () => {
    for (const cargo of ['CEO', 'Founder', 'Co-Founder']) expect(normalizarCargo(cargo)).toBe('Liderança')
    for (const cargo of ['Social Media', 'Designer', 'Editor de Vídeo', 'Copywriter']) {
      expect(normalizarCargo(cargo)).toBe('Colaborador')
    }
    expect(normalizarCargo('Gestor de Tráfego')).toBe('Gestor de Tráfego')
  })

  it('cargo desconhecido fica com o menor acesso', () => {
    expect(normalizarCargo('Estagiário')).toBe('Colaborador')
    expect(normalizarCargo(null)).toBeNull()
  })
})

describe('isLideranca', () => {
  it('só a Liderança, inclusive com o cargo antigo', () => {
    expect(isLideranca('Liderança')).toBe(true)
    expect(isLideranca('CEO')).toBe(true)
    for (const cargo of CARGOS.filter((c) => c !== 'Liderança')) expect(isLideranca(cargo)).toBe(false)
    expect(isLideranca(null)).toBe(false)
    expect(isLideranca(undefined)).toBe(false)
  })

  it('a lista tem os seis cargos', () => {
    expect(CARGOS).toEqual(['Liderança', 'Gestor de Tráfego', 'SDR', 'Closer', 'Estrategista & Analista', 'Colaborador'])
  })
})

describe('podeAcessar', () => {
  // A tabela pedida: cada linha é uma área, cada coluna um cargo, na ordem de CARGOS
  const TABELA: Record<Area, [boolean, boolean, boolean, boolean, boolean, boolean]> = {
    dashboard: [true, true, true, true, true, true],
    clientes: [true, false, false, false, false, false],
    crm: [true, false, true, true, false, false],
    demandas: [true, true, true, true, true, true],
    conteudo: [true, true, true, true, true, true],
    anuncios: [true, true, false, false, true, false],
    calendario: [true, true, true, true, true, true],
    financeiro: [true, false, false, false, false, false],
    configuracoes: [true, false, false, false, false, false],
  }

  it.each(Object.entries(TABELA))('%s', (area, acessos) => {
    CARGOS.forEach((cargo: Cargo, i) => {
      expect(`${cargo}: ${podeAcessar(cargo, area as Area)}`).toBe(`${cargo}: ${acessos[i]}`)
    })
  })

  it('sem cargo não acessa nada', () => {
    expect(podeAcessar(null, 'dashboard')).toBe(false)
  })
})
