import {
  acharClienteDoAsaas,
  buscarClienteAsaas,
  linhaDaCobranca,
  linhaDoPagamento,
  listarTudo,
  tokenValido,
  vincularClientes,
} from './asaas'

const PAGAMENTO = {
  id: 'pay_123',
  customer: 'cus_9',
  customerName: 'Scofield Arquitetura Ltda',
  description: 'Mensalidade outubro',
  value: 2870,
  dueDate: '2026-10-14',
  paymentDate: '2026-10-13',
  status: 'RECEIVED',
  billingType: 'PIX',
  subscription: null,
}

describe('tokenValido', () => {
  it('aceita só o token configurado', () => {
    expect(tokenValido('segredo', 'segredo')).toBe(true)
    expect(tokenValido('outro', 'segredo')).toBe(false)
    expect(tokenValido('segred', 'segredo')).toBe(false)
    expect(tokenValido(null, 'segredo')).toBe(false)
  })

  it('sem token configurado, recusa tudo', () => {
    expect(tokenValido('', '')).toBe(false)
    expect(tokenValido('qualquer', undefined)).toBe(false)
  })
})

describe('linhaDaCobranca', () => {
  const AGORA = '2026-10-15T12:00:00.000Z'

  it('evento de cobrança vira a linha da tabela', () => {
    expect(linhaDaCobranca({ event: 'PAYMENT_RECEIVED', payment: PAGAMENTO }, AGORA)).toEqual({
      asaas_id: 'pay_123',
      asaas_customer_id: 'cus_9',
      nome_cliente_asaas: 'Scofield Arquitetura Ltda',
      descricao: 'Mensalidade outubro',
      valor: 2870,
      data_vencimento: '2026-10-14',
      data_pagamento: '2026-10-13',
      status: 'RECEIVED',
      forma_pagamento: 'PIX',
      tipo: 'PIX',
      atualizado_em: AGORA,
    })
  })

  it('cobrança de assinatura fica com o tipo SUBSCRIPTION', () => {
    const linha = linhaDaCobranca(
      { event: 'PAYMENT_CREATED', payment: { ...PAGAMENTO, status: 'PENDING', paymentDate: null, subscription: 'sub_1' } },
      AGORA,
    )
    expect(linha).toMatchObject({ tipo: 'SUBSCRIPTION', status: 'PENDING', data_pagamento: null })
  })

  it('cobrança excluída no Asaas fica com o status DELETED', () => {
    expect(linhaDaCobranca({ event: 'PAYMENT_DELETED', payment: PAGAMENTO }, AGORA)?.status).toBe('DELETED')
  })

  it('eventos que não são de cobrança não gravam nada', () => {
    expect(linhaDaCobranca({ event: 'SUBSCRIPTION_CREATED' }, AGORA)).toBeNull()
    expect(linhaDaCobranca({ event: 'PAYMENT_RECEIVED' }, AGORA)).toBeNull()
    expect(linhaDaCobranca({}, AGORA)).toBeNull()
  })
})

describe('linhaDoPagamento', () => {
  const AGORA = '2026-10-15T12:00:00.000Z'

  it('o nome vem do cadastro do cliente no Asaas, que a cobrança não traz', () => {
    const { customerName: _, ...semNome } = PAGAMENTO
    expect(linhaDoPagamento(semNome, AGORA, { id: 'cus_9', name: 'Scofield' }).nome_cliente_asaas).toBe(
      'Scofield',
    )
    expect(linhaDoPagamento(semNome, AGORA).nome_cliente_asaas).toBeNull()
  })

  it('cobrança confirmada no cartão usa a data em que o cliente pagou', () => {
    const linha = linhaDoPagamento(
      { ...PAGAMENTO, status: 'CONFIRMED', paymentDate: null, confirmedDate: '2026-10-10' },
      AGORA,
    )
    expect(linha.data_pagamento).toBe('2026-10-10')
  })
})

describe('acharClienteDoAsaas', () => {
  const CLIENTES = [
    { id: 'c1', nome: 'Scofield Arquitetura', cnpj: '12.345.678/0001-90', asaas_customer_id: null },
    { id: 'c2', nome: 'Padaria Sol', cnpj: null, asaas_customer_id: 'cus_2' },
    { id: 'c3', nome: 'Clínica Aurora', cnpj: null, asaas_customer_id: null },
    { id: 'c4', nome: 'Clínica Aurora Centro', cnpj: null, asaas_customer_id: null },
  ]

  it('primeiro pelo id do Asaas já gravado no cliente', () => {
    expect(acharClienteDoAsaas(CLIENTES, { id: 'cus_2', name: 'Outro nome' })).toEqual({
      clienteId: 'c2',
      gravarId: false,
    })
  })

  it('depois pelo CNPJ, comparando só os dígitos', () => {
    expect(acharClienteDoAsaas(CLIENTES, { id: 'cus_1', name: 'SA Ltda', cpfCnpj: '12345678000190' })).toEqual({
      clienteId: 'c1',
      gravarId: true,
    })
  })

  it('por último pelo nome, sem acento nem maiúscula', () => {
    expect(acharClienteDoAsaas(CLIENTES, { id: 'cus_1', name: 'SCOFIELD arquitetura ltda' })).toEqual({
      clienteId: 'c1',
      gravarId: true,
    })
  })

  it('nome que casa com mais de um cliente fica sem vínculo', () => {
    expect(acharClienteDoAsaas(CLIENTES, { id: 'cus_3', name: 'Clinica Aurora' })).toBeNull()
  })

  it('não rouba um cliente já ligado a outro cadastro do Asaas', () => {
    expect(acharClienteDoAsaas(CLIENTES, { id: 'cus_9', name: 'Padaria Sol' })).toBeNull()
  })

  it('CNPJ que não bate com ninguém cai na busca pelo nome; nome curto não busca', () => {
    expect(acharClienteDoAsaas(CLIENTES, { id: 'cus_1', name: 'Scofield Arq', cpfCnpj: '99999999000199' })).toEqual({
      clienteId: 'c1',
      gravarId: true,
    })
    expect(acharClienteDoAsaas(CLIENTES, { id: 'cus_1', name: 'AB' })).toBeNull()
  })
})

describe('vincularClientes', () => {
  it('um cliente daqui fica com um só cliente do Asaas', () => {
    const vinculos = vincularClientes([{ id: 'c1', nome: 'Padaria Sol', cnpj: null, asaas_customer_id: null }], [
      { id: 'cus_1', name: 'Padaria Sol' },
      { id: 'cus_2', name: 'Padaria Sol Filial' },
    ])
    expect(vinculos.get('cus_1')).toEqual({ clienteId: 'c1', gravarId: true })
    expect(vinculos.has('cus_2')).toBe(false)
  })
})

describe('API do Asaas', () => {
  function respostas(...corpos: unknown[]) {
    const urls: string[] = []
    const cabecalhos: Record<string, string>[] = []
    const buscar = async (url: string, init: RequestInit) => {
      urls.push(url)
      cabecalhos.push(init.headers as Record<string, string>)
      const corpo = corpos.shift()
      return new Response(JSON.stringify(corpo), { status: corpo === undefined ? 404 : 200 })
    }
    return { buscar, urls, cabecalhos }
  }

  it('listarTudo segue as páginas enquanto o Asaas disser que há mais', async () => {
    const { buscar, urls, cabecalhos } = respostas(
      { data: [{ id: 'a' }, { id: 'b' }], hasMore: true },
      { data: [{ id: 'c' }], hasMore: false },
    )
    const itens = await listarTudo<{ id: string }>('https://api.test/v3', '/payments', 'chave', buscar)
    expect(itens.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(urls).toEqual([
      'https://api.test/v3/payments?limit=100&offset=0',
      'https://api.test/v3/payments?limit=100&offset=100',
    ])
    expect(cabecalhos[0]).toMatchObject({ access_token: 'chave', 'User-Agent': 'SINGLE-OS' })
  })

  it('erro do Asaas vira falha com o status', async () => {
    const buscar = async () => new Response('{"errors":[{"description":"chave inválida"}]}', { status: 401 })
    await expect(listarTudo('https://api.test/v3', '/payments', 'x', buscar)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('buscarClienteAsaas devolve null quando o cliente não existe', async () => {
    const { buscar } = respostas()
    expect(await buscarClienteAsaas('https://api.test/v3', 'cus_x', 'chave', buscar)).toBeNull()
  })
})
