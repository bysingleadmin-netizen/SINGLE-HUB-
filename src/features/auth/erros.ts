const PADRAO = 'Não foi possível entrar. Tente novamente.'

export function traduzirErroAuth(mensagem: string | undefined): string {
  const texto = (mensagem ?? '').toLowerCase()
  if (texto.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (texto.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (texto.includes('failed to fetch') || texto.includes('network')) {
    return 'Sem conexão com o servidor. Tente novamente.'
  }
  return PADRAO
}
