import { emailDeAcessoRevogado, emailDeConvite } from './emails'

describe('emailDeConvite', () => {
  const email = emailDeConvite({ nome: 'Bia', cargo: 'SDR', codigo: 'ABC234' })

  it('assunto com o nome do sistema e da agência', () => {
    expect(email.assunto).toBe('Você foi convidado para o SINGLE OS — SINGLE')
  })

  it('a prévia começa cumprimentando pelo nome', () => {
    expect(email.previa).toMatch(/^Olá, Bia, você recebeu acesso ao sistema de gestão da SINGLE\./)
    expect(email.html).toContain('Olá, Bia, você recebeu acesso ao sistema de gestão da SINGLE.')
  })

  it('leva o código e o link de entrada no HTML e no texto puro', () => {
    for (const corpo of [email.html, email.texto]) {
      expect(corpo).toContain('ABC234')
      expect(corpo).toContain('https://singlehubos.vercel.app/login')
    }
  })

  it('sem nome, cumprimenta sem vírgula sobrando', () => {
    expect(emailDeConvite({ cargo: 'SDR', codigo: 'X' }).previa).toMatch(/^Olá, você recebeu/)
  })

  it('não deixa o nome injetar HTML', () => {
    const malicioso = emailDeConvite({ nome: '<img src=x>', cargo: 'SDR', codigo: 'X' })
    expect(malicioso.html).not.toContain('<img src=x>')
    expect(malicioso.html).toContain('&lt;img src=x&gt;')
  })
})

describe('emailDeAcessoRevogado', () => {
  it('avisa que o acesso foi revogado', () => {
    const email = emailDeAcessoRevogado({ nome: 'Bia' })
    expect(email.assunto).toBe('Seu acesso ao SINGLE OS foi revogado — SINGLE')
    expect(email.texto).toContain('foi revogado')
  })
})
