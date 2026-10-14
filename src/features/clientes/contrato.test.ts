import { DURACOES, fimDoContrato, formatarMesCurto, seloDoContrato, situacaoDoContrato } from './contrato'

describe('fimDoContrato', () => {
  it('soma os meses ao início', () => {
    expect(fimDoContrato('2026-03-15', 12)).toBe('2027-03-15')
    expect(fimDoContrato('2026-10-01', 3)).toBe('2027-01-01')
  })

  it('em mês mais curto, cai no último dia', () => {
    expect(fimDoContrato('2026-11-30', 3)).toBe('2027-02-28')
  })
})

describe('situacaoDoContrato', () => {
  it('vigente, perto (30 dias ou menos) e vencido', () => {
    expect(situacaoDoContrato('2026-12-31', '2026-10-14')).toBe('vigente')
    expect(situacaoDoContrato('2026-11-13', '2026-10-14')).toBe('perto')
    expect(situacaoDoContrato('2026-10-14', '2026-10-14')).toBe('perto')
    expect(situacaoDoContrato('2026-10-13', '2026-10-14')).toBe('vencido')
  })
})

describe('seloDoContrato', () => {
  const HOJE = '2026-10-14'

  it('mostra o mês de encerramento com a cor da situação', () => {
    expect(seloDoContrato({ data_inicio_contrato: '2026-03-01', contrato_meses: 12 }, HOJE)).toEqual({
      texto: 'Encerra em mar/2027',
      tom: 'cinza',
    })
    expect(seloDoContrato({ data_inicio_contrato: '2026-05-01', contrato_meses: 6 }, HOJE)).toEqual({
      texto: 'Encerra em nov/2026',
      tom: 'amarelo',
    })
    expect(seloDoContrato({ data_inicio_contrato: '2026-01-01', contrato_meses: 6 }, HOJE)).toEqual({
      texto: 'Encerrou em jul/2026',
      tom: 'vermelho',
    })
  })

  it('sem duração ou sem início, não há selo', () => {
    expect(seloDoContrato({ data_inicio_contrato: '2026-01-01', contrato_meses: null }, HOJE)).toBeNull()
    expect(seloDoContrato({ data_inicio_contrato: null, contrato_meses: 12 }, HOJE)).toBeNull()
  })

  it('durações aceitas e mês curto', () => {
    expect(DURACOES).toEqual([3, 6, 12, 15])
    expect(formatarMesCurto('2027-03-15')).toBe('mar/2027')
  })
})
