import { itensVisiveis, tituloDaRota } from './navegacao'

describe('itensVisiveis', () => {
  it('esconde Financeiro de quem não é liderança', () => {
    expect(itensVisiveis('Designer').map((i) => i.rotulo)).toEqual([
      'Dashboard',
      'Clientes',
      'Demandas',
      'Conteúdo',
      'Campanhas',
      'Configurações',
    ])
  })

  it('mostra Financeiro para a liderança, antes de Configurações', () => {
    expect(itensVisiveis('CEO').map((i) => i.rotulo)).toEqual([
      'Dashboard',
      'Clientes',
      'Demandas',
      'Conteúdo',
      'Campanhas',
      'Financeiro',
      'Configurações',
    ])
  })

  it('esconde Financeiro sem cargo', () => {
    expect(itensVisiveis(null).some((i) => i.rotulo === 'Financeiro')).toBe(false)
  })
})

describe('tituloDaRota', () => {
  it('acha o título pela rota, inclusive em subrotas', () => {
    expect(tituloDaRota('/app/dashboard')).toBe('Dashboard')
    expect(tituloDaRota('/app/campanhas/123')).toBe('Campanhas')
    expect(tituloDaRota('/app/financeiro/dre')).toBe('Financeiro')
  })

  it('tem fallback para rota desconhecida', () => {
    expect(tituloDaRota('/app/qualquer')).toBe('SINGLE')
  })
})
