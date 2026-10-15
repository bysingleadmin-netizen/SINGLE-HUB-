import { armazenamentoDaSessao, definirLembrarConta, lembrarConta } from './sessao'

const CHAVE = 'sb-teste-auth-token'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('armazenamentoDaSessao', () => {
  it('sem lembrar (o padrão), a sessão fica só nesta aba', () => {
    expect(lembrarConta()).toBe(false)
    armazenamentoDaSessao.setItem(CHAVE, 'sessao')
    expect(sessionStorage.getItem(CHAVE)).toBe('sessao')
    expect(localStorage.getItem(CHAVE)).toBeNull()
    expect(armazenamentoDaSessao.getItem(CHAVE)).toBe('sessao')
  })

  it('lembrando, a sessão vai para o localStorage e sai da aba', () => {
    sessionStorage.setItem(CHAVE, 'antiga')
    definirLembrarConta(true)
    expect(lembrarConta()).toBe(true)
    armazenamentoDaSessao.setItem(CHAVE, 'sessao')
    expect(localStorage.getItem(CHAVE)).toBe('sessao')
    expect(sessionStorage.getItem(CHAVE)).toBeNull()
    expect(armazenamentoDaSessao.getItem(CHAVE)).toBe('sessao')
  })

  it('sair apaga dos dois lugares', () => {
    localStorage.setItem(CHAVE, 'a')
    sessionStorage.setItem(CHAVE, 'b')
    armazenamentoDaSessao.removeItem(CHAVE)
    expect(armazenamentoDaSessao.getItem(CHAVE)).toBeNull()
  })

  it('desmarcar depois de lembrar tira a sessão do localStorage na próxima gravação', () => {
    definirLembrarConta(true)
    armazenamentoDaSessao.setItem(CHAVE, 'sessao')
    definirLembrarConta(false)
    armazenamentoDaSessao.setItem(CHAVE, 'renovada')
    expect(localStorage.getItem(CHAVE)).toBeNull()
    expect(sessionStorage.getItem(CHAVE)).toBe('renovada')
  })
})
