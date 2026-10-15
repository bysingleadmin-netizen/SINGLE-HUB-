import { aplicarTema, lerTema, salvarTema } from './tema'

describe('tema', () => {
  it('o padrão é escuro, inclusive com valor desconhecido salvo', () => {
    expect(lerTema()).toBe('escuro')
    localStorage.setItem('tema', 'azul')
    expect(lerTema()).toBe('escuro')
  })

  it('salvar grava no localStorage e aplica no <html>', () => {
    salvarTema('claro')
    expect(localStorage.getItem('tema')).toBe('claro')
    expect(lerTema()).toBe('claro')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    aplicarTema('escuro')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})
