import { traduzirErroAuth } from './erros'

describe('traduzirErroAuth', () => {
  it('traduz credenciais inválidas', () => {
    expect(traduzirErroAuth('Invalid login credentials')).toBe('E-mail ou senha incorretos.')
  })

  it('traduz e-mail não confirmado', () => {
    expect(traduzirErroAuth('Email not confirmed')).toBe('Confirme seu e-mail antes de entrar.')
  })

  it('traduz falha de rede', () => {
    expect(traduzirErroAuth('Failed to fetch')).toBe('Sem conexão com o servidor. Tente novamente.')
  })

  it('nunca devolve o texto cru para erros desconhecidos', () => {
    expect(traduzirErroAuth('qualquer outra coisa')).toBe('Não foi possível entrar. Tente novamente.')
    expect(traduzirErroAuth(undefined)).toBe('Não foi possível entrar. Tente novamente.')
  })
})
