import type { Client } from '@/types/database'
import {
  contatoVazio,
  contatosDe,
  filtrarClientes,
  formDoCliente,
  formVazio,
  formatarMes,
  linkInstagram,
  mesesDeCasa,
  moedaParaCampo,
  validarCliente,
} from './cliente'

describe('validarCliente', () => {
  it('exige o nome', () => {
    expect(validarCliente({ ...formVazio(), nome: '   ' })).toEqual({
      erros: { nome: 'Informe o nome do cliente.' },
    })
  })

  it('converte o valor digitado com vírgula e limpa os campos de texto', () => {
    const resultado = validarCliente({
      ...formVazio(),
      nome: '  Padaria Sol ',
      mrr: '1.500,50',
      data_inicio_contrato: '2026-01-15',
      instagram: ' @padariasol ',
      contatos: [{ ...contatoVazio(), email: 'ana@padaria.com' }],
    })
    expect(resultado).toEqual({
      valores: {
        nome: 'Padaria Sol',
        status: 'ativo',
        mrr: 1500.5,
        data_inicio_contrato: '2026-01-15',
        instagram: '@padariasol',
        link_conta_anuncios: null,
        contato_nome: null,
        contato_email: 'ana@padaria.com',
        contato_telefone: null,
        observacoes: null,
      },
    })
  })

  it('valor em branco vira zero e valor inválido é recusado', () => {
    expect(validarCliente({ ...formVazio(), nome: 'A', mrr: '' })).toMatchObject({
      valores: { mrr: 0 },
    })
    expect(validarCliente({ ...formVazio(), nome: 'A', mrr: 'mil reais' })).toEqual({
      erros: { mrr: 'Informe um valor como 1.500,00.' },
    })
  })

  it('completa o link de anúncios sem protocolo e recusa o que não é link da web', () => {
    expect(
      validarCliente({ ...formVazio(), nome: 'A', link_conta_anuncios: 'business.facebook.com/x' }),
    ).toMatchObject({ valores: { link_conta_anuncios: 'https://business.facebook.com/x' } })
    expect(
      validarCliente({ ...formVazio(), nome: 'A', link_conta_anuncios: 'javascript:alert(1)' }),
    ).toEqual({ erros: { link_conta_anuncios: 'Informe um link válido.' } })
  })

  it('recusa e-mail sem formato de e-mail', () => {
    expect(
      validarCliente({ ...formVazio(), nome: 'A', contatos: [{ ...contatoVazio(), email: 'ana' }] }),
    ).toEqual({ erros: { contatos: 'Informe um e-mail válido.' } })
  })
})

describe('base de clientes: área, responsáveis e contatos (migration 0012)', () => {
  const base = { ...formVazio(), nome: 'Conecta' }
  const isadora = { nome: ' Isadora ', funcao: 'Co-Founder', email: 'isa@conecta.com', telefone: '' }
  const bruno = { nome: 'Bruno', funcao: '', email: '', telefone: '(27) 99999-0000' }

  it('com a migration, grava a lista e repete o primeiro contato nas colunas antigas', () => {
    const resultado = validarCliente(
      { ...base, area_atuacao: ' Odontologia ', responsaveis: ['u1', 'u2'], contatos: [isadora, bruno, contatoVazio()] },
      { comBase: true },
    )
    expect(resultado).toMatchObject({
      valores: {
        area_atuacao: 'Odontologia',
        responsaveis: ['u1', 'u2'],
        contatos: [
          { nome: 'Isadora', funcao: 'Co-Founder', email: 'isa@conecta.com' },
          { nome: 'Bruno', telefone: '(27) 99999-0000' },
        ],
        contato_nome: 'Isadora',
        contato_email: 'isa@conecta.com',
        contato_telefone: null,
      },
    })
  })

  it('sem a migration, salva só o primeiro contato e nada das colunas novas', () => {
    const resultado = validarCliente({ ...base, area_atuacao: 'Varejo', contatos: [isadora, bruno] })
    expect(resultado).toMatchObject({ valores: { contato_nome: 'Isadora', contato_telefone: null } })
    expect(resultado).not.toHaveProperty('valores.contatos')
    expect(resultado).not.toHaveProperty('valores.area_atuacao')
    expect(resultado).not.toHaveProperty('valores.responsaveis')
  })

  it('recusa contato sem nome e e-mail inválido, dizendo de quem', () => {
    expect(
      validarCliente({ ...base, contatos: [{ ...contatoVazio(), funcao: 'CEO' }] }, { comBase: true }),
    ).toEqual({ erros: { contatos: 'Informe o nome de cada contato.' } })
    expect(
      validarCliente({ ...base, contatos: [{ ...isadora, email: 'isa' }] }, { comBase: true }),
    ).toEqual({ erros: { contatos: 'Informe um e-mail válido para Isadora.' } })
  })

  it('contatosDe usa a lista e, sem ela, o contato único', () => {
    const antigo = { contato_nome: 'Ana', contato_email: null, contato_telefone: '27 9999', contatos: [] }
    expect(contatosDe(antigo)).toEqual([{ nome: 'Ana', email: null, telefone: '27 9999' }])
    expect(contatosDe({ ...antigo, contatos: [{ nome: 'Isadora' }] })).toEqual([{ nome: 'Isadora' }])
    expect(contatosDe({ contato_nome: null, contato_email: null, contato_telefone: null })).toEqual([])
  })

  it('formDoCliente traz os contatos e sempre ao menos uma linha', () => {
    const cliente = { nome: 'A', mrr: 0, contatos: [{ nome: 'Isadora', funcao: 'Co-Founder' }] } as Client
    expect(formDoCliente(cliente).contatos).toEqual([
      { nome: 'Isadora', funcao: 'Co-Founder', email: '', telefone: '' },
    ])
    expect(formDoCliente({ nome: 'A', mrr: 0 } as Client).contatos).toEqual([contatoVazio()])
  })
})

describe('listagem da base de clientes', () => {
  const clientes = [
    { nome: 'Clínica Vita', status: 'ativo' as const },
    { nome: 'Conecta', status: 'pausado' as const },
    { nome: 'Padaria Sol', status: 'churn' as const },
  ]

  it('busca pelo nome sem diferenciar acentos nem maiúsculas', () => {
    expect(filtrarClientes(clientes, ' CLINICA', 'todos').map((c) => c.nome)).toEqual(['Clínica Vita'])
    expect(filtrarClientes(clientes, '', 'todos')).toHaveLength(3)
  })

  it('inativos são os pausados e os que saíram', () => {
    expect(filtrarClientes(clientes, '', 'ativos').map((c) => c.nome)).toEqual(['Clínica Vita'])
    expect(filtrarClientes(clientes, '', 'inativos').map((c) => c.nome)).toEqual(['Conecta', 'Padaria Sol'])
  })

  it('meses de casa contam meses completos desde o início', () => {
    expect(mesesDeCasa({ data_inicio_contrato: '2025-10-20' }, '2026-10-19')).toBe(11)
    expect(mesesDeCasa({ data_inicio_contrato: null }, '2026-10-19')).toBeNull()
  })
})

describe('formDoCliente', () => {
  it('prepara o cliente para edição, com o valor no formato brasileiro', () => {
    const cliente = {
      nome: 'Padaria Sol',
      status: 'pausado',
      mrr: 1500.5,
      data_inicio_contrato: null,
      instagram: '@padariasol',
      link_conta_anuncios: null,
      contato_nome: null,
      contato_email: null,
      contato_telefone: null,
      observacoes: null,
    } as Client
    expect(formDoCliente(cliente)).toMatchObject({
      nome: 'Padaria Sol',
      status: 'pausado',
      mrr: '1500,50',
      data_inicio_contrato: '',
      instagram: '@padariasol',
    })
  })

  it('moedaParaCampo sempre usa duas casas', () => {
    expect(moedaParaCampo(800)).toBe('800,00')
  })
})

describe('linkInstagram', () => {
  it('aceita arroba, nome puro e endereço completo', () => {
    expect(linkInstagram('@padaria.sol')).toBe('https://instagram.com/padaria.sol')
    expect(linkInstagram('padaria_sol')).toBe('https://instagram.com/padaria_sol')
    expect(linkInstagram('https://www.instagram.com/padariasol/')).toBe(
      'https://instagram.com/padariasol',
    )
  })

  it('devolve null para vazio ou texto que não é um perfil', () => {
    expect(linkInstagram(null)).toBeNull()
    expect(linkInstagram('  ')).toBeNull()
    expect(linkInstagram('javascript:alert(1)')).toBeNull()
  })
})

describe('dia de vencimento no cadastro', () => {
  const base = { ...formVazio(), nome: 'A' }

  it('só entra nos valores quando o banco já tem a coluna', () => {
    expect(validarCliente({ ...base, dia_vencimento: '10' })).not.toHaveProperty(
      'valores.dia_vencimento',
    )
    expect(validarCliente({ ...base, dia_vencimento: '10' }, { comVencimento: true })).toMatchObject({
      valores: { dia_vencimento: 10 },
    })
  })

  it('vazio vira null e valor fora de 1 a 31 é recusado', () => {
    expect(validarCliente(base, { comVencimento: true })).toMatchObject({
      valores: { dia_vencimento: null },
    })
    for (const invalido of ['0', '32', '1,5', 'dez']) {
      expect(validarCliente({ ...base, dia_vencimento: invalido }, { comVencimento: true })).toEqual({
        erros: { dia_vencimento: 'Informe um dia entre 1 e 31.' },
      })
    }
  })

  it('formDoCliente traz o dia já cadastrado', () => {
    expect(formDoCliente({ nome: 'A', mrr: 0, dia_vencimento: 5 } as Client).dia_vencimento).toBe('5')
    expect(formDoCliente({ nome: 'A', mrr: 0 } as Client).dia_vencimento).toBe('')
  })
})

describe('formatarMes', () => {
  it('mostra o mês como mm/aaaa', () => {
    expect(formatarMes('2026-10-01')).toBe('10/2026')
  })
})
