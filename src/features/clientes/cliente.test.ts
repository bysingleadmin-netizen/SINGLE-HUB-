import type { Client } from '@/types/database'
import {
  formDoCliente,
  formVazio,
  formatarMes,
  linkInstagram,
  moedaParaCampo,
  statusDoPagamento,
  validarCliente,
  validarPagamento,
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
      contato_email: 'ana@padaria.com',
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
    expect(validarCliente({ ...formVazio(), nome: 'A', contato_email: 'ana' })).toEqual({
      erros: { contato_email: 'Informe um e-mail válido.' },
    })
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

describe('pagamentos', () => {
  it('monta o pagamento com o mês no primeiro dia', () => {
    expect(
      validarPagamento({ mes: '2026-10', valor: '1.500,00', vencimento: '2026-10-10' }),
    ).toEqual({
      valores: {
        mes_referencia: '2026-10-01',
        valor: 1500,
        data_vencimento: '2026-10-10',
        status: 'pendente',
      },
    })
  })

  it('aponta o que falta', () => {
    expect(validarPagamento({ mes: '', valor: '', vencimento: '' })).toEqual({
      erros: {
        mes: 'Escolha o mês.',
        valor: 'Informe um valor como 1.500,00.',
        vencimento: 'Informe o vencimento.',
      },
    })
  })

  it('mostra o mês como mm/aaaa', () => {
    expect(formatarMes('2026-10-01')).toBe('10/2026')
  })

  it('pendente vencido aparece como atrasado', () => {
    const hoje = '2026-10-08'
    expect(statusDoPagamento({ status: 'pendente', data_vencimento: '2026-10-01' }, hoje)).toBe(
      'atrasado',
    )
    expect(statusDoPagamento({ status: 'pendente', data_vencimento: '2026-10-20' }, hoje)).toBe(
      'pendente',
    )
    expect(statusDoPagamento({ status: 'pago', data_vencimento: '2026-10-01' }, hoje)).toBe('pago')
  })
})
