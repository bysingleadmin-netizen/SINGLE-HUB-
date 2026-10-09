vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { hojeISO } from '@/lib/datas'
import type { Cargo } from '@/lib/permissoes'
import { SincronizarCobrancas } from '@/dados/pagamentos'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { ClientePage } from './ClientePage'
import { proximoMes, vencimentoNoMes } from './cartoes'
import { ClientesPage } from './ClientesPage'

const PADARIA = {
  id: 'c1',
  nome: 'Padaria Sol',
  logo_url: null,
  status: 'ativo',
  mrr: 1500,
  data_inicio_contrato: '2025-01-01',
  instagram: '@padariasol',
  link_conta_anuncios: 'https://business.facebook.com/padaria',
  contato_nome: 'Ana',
  contato_email: 'ana@padaria.com',
  contato_telefone: null,
  observacoes: 'Prefere WhatsApp',
  created_at: '2026-01-01T00:00:00Z',
}

const PAGAMENTO = {
  id: 'p1',
  client_id: 'c1',
  mes_referencia: '2026-09-01',
  valor: 1500,
  data_vencimento: '2026-09-10',
  data_pagamento: null,
  status: 'pendente',
  created_at: '2026-09-01T00:00:00Z',
}

function popular() {
  bancoFalso().reiniciar({
    profiles: [perfilDeTeste()],
    clients: [PADARIA, { ...PADARIA, id: 'c2', nome: 'Clínica Vita', instagram: null, link_conta_anuncios: null }],
    client_payments: [PAGAMENTO],
    tasks: [
      { id: 't1', titulo: 'Roteiro de reels', status: 'em_andamento', tipo: 'conteudo', client_id: 'c1', data_entrega: '2026-12-01', posicao: 1, created_at: '2026-10-01' },
      { id: 't2', titulo: 'De outro cliente', status: 'a_fazer', tipo: 'trafego', client_id: 'c2', data_entrega: null, posicao: 1, created_at: '2026-10-02' },
    ],
    campaigns: [
      { id: 'g1', nome: 'Black Friday', client_id: 'c1', status: 'em_execucao', orcamento: 3000, data_inicio: null, data_fim: null, proxima_otimizacao: null, created_at: '2026-10-01' },
    ],
    content_cards: [
      { id: 'k1', titulo: 'Carrossel de dicas', tipo_conteudo: 'carrossel', etapa: 'editar', client_id: 'c1', data_entrega: null, posicao: 1, created_at: '2026-10-01' },
    ],
  })
}

/** Abre a página do cliente como o app faz, pela rota. */
async function abrirCliente(cargo: Cargo = 'CEO', id = 'c1') {
  popular()
  renderizar(
    <Routes>
      <Route path="/app/clientes/:id" element={<ClientePage />} />
    </Routes>,
    { cargo, rota: `/app/clientes/${id}` },
  )
  await screen.findByRole('heading', { name: id === 'c1' ? 'Padaria Sol' : 'Clínica Vita' })
}

function aba(nome: string) {
  fireEvent.click(screen.getByRole('tab', { name: nome }))
  return within(screen.getByRole('tabpanel', { name: nome }))
}

describe('ClientesPage', () => {
  it('sem clientes mostra o estado vazio com a ação de cadastrar', async () => {
    bancoFalso().reiniciar()
    renderizar(<ClientesPage />)
    expect(await screen.findByText('Nenhum cliente cadastrado.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Novo cliente' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mostra o card com status, valor mensal e fidelidade, levando à página do cliente', async () => {
    popular()
    renderizar(<ClientesPage />)
    const link = await screen.findByRole('link', { name: 'Padaria Sol' })
    expect(link).toHaveAttribute('href', '/app/clientes/c1')
    const card = within(link.closest('article')!)
    expect(card.getByText('Ativo')).toBeInTheDocument()
    expect(card.getByText(/1\.500,00/)).toBeInTheDocument()
    expect(card.getByText(/1 ano/)).toBeInTheDocument()
  })

  it('ações rápidas do card: editar e abrir os canais que o cliente tem', async () => {
    popular()
    renderizar(<ClientesPage />)
    const padaria = within((await screen.findByRole('link', { name: 'Padaria Sol' })).closest('article')!)
    expect(padaria.getByRole('link', { name: 'Conta de anúncios de Padaria Sol' })).toHaveAttribute(
      'href',
      'https://business.facebook.com/padaria',
    )
    expect(padaria.getByRole('link', { name: 'Instagram de Padaria Sol' })).toHaveAttribute(
      'href',
      'https://instagram.com/padariasol',
    )
    const clinica = within(screen.getByRole('link', { name: 'Clínica Vita' }).closest('article')!)
    expect(clinica.queryByRole('link', { name: /Conta de anúncios/ })).not.toBeInTheDocument()

    fireEvent.click(padaria.getByRole('button', { name: 'Editar Padaria Sol' }))
    expect(
      within(screen.getByRole('dialog', { name: 'Editar cliente' })).getByLabelText('Nome'),
    ).toHaveValue('Padaria Sol')
  })

  it('cadastra um cliente, aceita valor com vírgula e registra a atividade', async () => {
    bancoFalso().reiniciar()
    renderizar(<ClientesPage />)
    await screen.findByText('Nenhum cliente cadastrado.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Novo cliente' })[0])

    const modal = within(screen.getByRole('dialog', { name: 'Novo cliente' }))
    fireEvent.change(modal.getByLabelText('Nome'), { target: { value: 'Clínica Vita' } })
    fireEvent.change(modal.getByLabelText('Valor mensal (MRR)'), { target: { value: '2.500,50' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Cliente cadastrado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0]).toMatchObject({ nome: 'Clínica Vita', mrr: 2500.5 })
    expect(await screen.findByRole('link', { name: 'Clínica Vita' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'cliente_criado' }),
      ),
    )
  })

  it('não salva sem nome', async () => {
    bancoFalso().reiniciar()
    renderizar(<ClientesPage />)
    await screen.findByText('Nenhum cliente cadastrado.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Novo cliente' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome do cliente.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients).toHaveLength(0)
  })

  it('avisa e mantém o formulário aberto quando o banco recusa', async () => {
    bancoFalso().reiniciar()
    renderizar(<ClientesPage />)
    await screen.findByText('Nenhum cliente cadastrado.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Novo cliente' })[0])
    bancoFalso().erroEscrita = { message: 'negado' }

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Clínica Vita' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Não foi possível salvar o cliente.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo cliente' })).toBeInTheDocument()
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    bancoFalso().reiniciar()
    bancoFalso().erroLeitura = { message: 'sem rede' }
    renderizar(<ClientesPage />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhum cliente cadastrado.')).toBeInTheDocument()
  })
})

describe('página do cliente: visão geral', () => {
  it('mostra valores, links e contato', async () => {
    await abrirCliente()
    expect(screen.getByText(/18\.000,00/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '@padariasol' })).toHaveAttribute(
      'href',
      'https://instagram.com/padariasol',
    )
    expect(screen.getByRole('link', { name: 'Abrir conta de anúncios' })).toHaveAttribute(
      'href',
      'https://business.facebook.com/padaria',
    )
    expect(screen.getByText('ana@padaria.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para Clientes' })).toHaveAttribute(
      'href',
      '/app/clientes',
    )
  })

  it('troca o status direto na página', async () => {
    await abrirCliente()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pausado' } })
    expect(await screen.findByText('Status atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].status).toBe('pausado')
  })

  it('salva as observações ao sair do campo', async () => {
    await abrirCliente()
    const campo = screen.getByLabelText('Observações')
    fireEvent.change(campo, { target: { value: 'Ligar só à tarde' } })
    fireEvent.blur(campo)
    expect(await screen.findByText('Observações salvas.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].observacoes).toBe('Ligar só à tarde')
  })

  it('recusa logo que não é imagem', async () => {
    await abrirCliente()
    const arquivo = new File(['x'], 'contrato.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Enviar logo'), { target: { files: [arquivo] } })
    expect(await screen.findByText('Envie uma imagem PNG, JPG, WEBP ou SVG.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].logo_url).toBeNull()
  })

  it('envia a logo e grava o endereço público', async () => {
    await abrirCliente()
    const arquivo = new File(['x'], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Enviar logo'), { target: { files: [arquivo] } })
    expect(await screen.findByText('Logo atualizada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].logo_url).toMatch(/^https:\/\/falso\.test\/logos\/c1\//)
  })

  it('abre a edição com os dados atuais', async () => {
    await abrirCliente()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const modal = within(screen.getByRole('dialog', { name: 'Editar cliente' }))
    expect(modal.getByLabelText('Nome')).toHaveValue('Padaria Sol')
    expect(modal.getByLabelText('Valor mensal (MRR)')).toHaveValue('1500,00')

    fireEvent.change(modal.getByLabelText('Nome'), { target: { value: 'Padaria do Sol' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].nome).toBe('Padaria do Sol')
  })

  it('avisa quando o cliente não existe', async () => {
    popular()
    renderizar(
      <Routes>
        <Route path="/app/clientes/:id" element={<ClientePage />} />
      </Routes>,
      { rota: '/app/clientes/nao-existe' },
    )
    expect(await screen.findByText('Cliente não encontrado.')).toBeInTheDocument()
  })
})

describe('página do cliente: abas', () => {
  it('Demandas lista só as do cliente, com status, e leva ao quadro', async () => {
    await abrirCliente()
    const demandas = aba('Demandas')
    expect(demandas.getByRole('link', { name: 'Roteiro de reels' })).toHaveAttribute(
      'href',
      '/app/demandas?abrir=t1',
    )
    expect(demandas.getByText('Em Andamento')).toBeInTheDocument()
    expect(demandas.queryByText('De outro cliente')).not.toBeInTheDocument()
  })

  it('Campanhas e Conteúdos listam o que é do cliente', async () => {
    await abrirCliente()
    expect(aba('Anúncios').getByRole('link', { name: 'Black Friday' })).toHaveAttribute(
      'href',
      '/app/anuncios/g1',
    )
    const conteudos = aba('Conteúdos')
    expect(conteudos.getByRole('link', { name: 'Carrossel de dicas' })).toHaveAttribute(
      'href',
      '/app/conteudo?abrir=k1',
    )
    expect(conteudos.getByText('Editar')).toBeInTheDocument()
  })

  it('aba sem itens mostra estado vazio', async () => {
    await abrirCliente('CEO', 'c2')
    expect(aba('Anúncios').getByText('Nenhum anúncio para este cliente.')).toBeInTheDocument()
    expect(aba('Conteúdos').getByText('Nenhum conteúdo para este cliente.')).toBeInTheDocument()
  })
})

describe('página do cliente: pagamentos recorrentes', () => {
  const HOJE = hojeISO()
  const MES_ATUAL = `${HOJE.slice(0, 7)}-01`
  const MES_QUE_VEM = proximoMes(MES_ATUAL)
  const MES_PASSADO = (() => {
    const [ano, mes] = MES_ATUAL.split('-').map(Number)
    return mes === 1 ? `${ano - 1}-12-01` : `${ano}-${String(mes - 1).padStart(2, '0')}-01`
  })()
  // Contrato iniciado no dia 28 do mês passado: as cobranças vencem todo dia 28
  const CLIENTE = { ...PADARIA, data_inicio_contrato: `${MES_PASSADO.slice(0, 8)}28` }
  const mes = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`

  function cobranca(iso: string, parcial: Record<string, unknown> = {}) {
    return {
      id: `p-${iso}`,
      client_id: 'c1',
      mes_referencia: iso,
      valor: 1500,
      data_vencimento: vencimentoNoMes(iso, 28),
      data_pagamento: null,
      status: 'pendente',
      created_at: '2026-01-01',
      ...parcial,
    }
  }

  const paga = (iso: string, valor = 1500) =>
    cobranca(iso, { valor, status: 'pago', data_pagamento: `${iso.slice(0, 8)}27` })

  interface Cenario {
    cliente?: Record<string, unknown>
    pagamentos?: Record<string, unknown>[]
    colunasAusentes?: string[]
    /** false deixa as cobranças exatamente como o teste as pôs no banco */
    sincronizar?: boolean
  }

  async function abrirPagamentos({
    cliente = CLIENTE,
    pagamentos = [],
    colunasAusentes = [],
    sincronizar = true,
  }: Cenario = {}) {
    bancoFalso().reiniciar({
      profiles: [perfilDeTeste()],
      clients: [cliente],
      client_payments: pagamentos,
    })
    bancoFalso().colunasAusentes = colunasAusentes
    renderizar(
      <>
        {/* No app, quem mantém as cobranças em dia é o layout */}
        {sincronizar && <SincronizarCobrancas />}
        <Routes>
          <Route path="/app/clientes/:id" element={<ClientePage />} />
        </Routes>
      </>,
      { rota: '/app/clientes/c1' },
    )
    await screen.findByRole('heading', { name: 'Padaria Sol' })
    fireEvent.click(screen.getByRole('tab', { name: 'Pagamentos' }))
    const painel = within(screen.getByRole('tabpanel', { name: 'Pagamentos' }))
    await painel.findByText(/Valor e vencimento vêm do cadastro|para gerar as cobranças|não gera cobrança/)
    return painel
  }

  const emAberto = (painel: Awaited<ReturnType<typeof abrirPagamentos>>) =>
    within(painel.getByRole('region', { name: 'Em aberto' }))

  async function pagar(nome: string) {
    fireEvent.click(await screen.findByRole('button', { name: nome }))
    const confirmacao = within(screen.getByRole('dialog', { name: 'Confirmar pagamento' }))
    fireEvent.click(confirmacao.getByRole('button', { name: 'Confirmar pagamento' }))
  }

  it('a aba não existe para quem não é liderança', async () => {
    await abrirCliente('Social Media')
    expect(screen.queryByRole('tab', { name: 'Pagamentos' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Demandas' })).toBeInTheDocument()
  })

  it('gera sozinho as cobranças do mês atual e dos três seguintes, sem voltar no tempo', async () => {
    const painel = await abrirPagamentos()
    await waitFor(() => expect(emAberto(painel).getAllByRole('listitem')).toHaveLength(4))
    const cartoes = emAberto(painel).getAllByRole('listitem')
    expect(cartoes[0]).toHaveTextContent(mes(MES_ATUAL))
    expect(cartoes[0]).toHaveTextContent(/1\.500,00/)
    expect(cartoes[1]).toHaveTextContent(mes(MES_QUE_VEM))

    // O contrato começou no mês passado, mas mês passado não é criado depois do fato
    const linhas = bancoFalso().tabelas.client_payments
    expect(linhas).toHaveLength(4)
    expect(linhas.some((l) => l.mes_referencia === MES_PASSADO)).toBe(false)
    expect(linhas[0]).toMatchObject({
      client_id: 'c1',
      mes_referencia: MES_ATUAL,
      valor: 1500,
      data_vencimento: vencimentoNoMes(MES_ATUAL, 28),
      status: 'pendente',
    })
    expect(painel.queryByRole('button', { name: 'Adicionar pagamento' })).not.toBeInTheDocument()
    expect(painel.getByText('Nenhum pagamento confirmado ainda.')).toBeInTheDocument()
  })

  it('cobrança de mês passado que ficou em aberto aparece como atrasada', async () => {
    const painel = await abrirPagamentos({ pagamentos: [cobranca(MES_PASSADO)] })
    const primeiro = (await emAberto(painel).findAllByRole('listitem'))[0]
    expect(primeiro).toHaveTextContent(mes(MES_PASSADO))
    expect(primeiro).toHaveTextContent('Atrasado')
  })

  it('confirmar por Pix leva a cobrança ao histórico, com a forma e a data de hoje', async () => {
    const painel = await abrirPagamentos()
    await pagar(`Pagar ${mes(MES_ATUAL)} com Pix`)

    expect(await screen.findByText('Pagamento confirmado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments.find((l) => l.mes_referencia === MES_ATUAL)).toMatchObject({
      status: 'pago',
      data_pagamento: HOJE,
      forma_pagamento: 'pix',
      arquivado: true,
    })
    const historico = within(painel.getByRole('region', { name: 'Histórico' }))
    expect(await historico.findByText(mes(MES_ATUAL))).toBeInTheDocument()
    expect(historico.getByText(/Pix/)).toBeInTheDocument()
    await waitFor(() => expect(emAberto(painel).getAllByRole('listitem')).toHaveLength(3))
  })

  it('ao pagar, cria a cobrança do mês seguinte se ela ainda não existir', async () => {
    const painel = await abrirPagamentos({ pagamentos: [cobranca(MES_ATUAL)], sincronizar: false })
    await pagar(`Pagar ${mes(MES_ATUAL)} com Dinheiro`)

    expect(await screen.findByText('Pagamento confirmado.')).toBeInTheDocument()
    const linhas = bancoFalso().tabelas.client_payments
    expect(linhas.find((l) => l.mes_referencia === MES_ATUAL)).toMatchObject({
      status: 'pago',
      forma_pagamento: 'dinheiro',
    })
    expect(linhas.find((l) => l.mes_referencia === MES_QUE_VEM)).toMatchObject({
      client_id: 'c1',
      status: 'pendente',
      valor: 1500,
      data_vencimento: vencimentoNoMes(MES_QUE_VEM, 28),
    })
    expect(await emAberto(painel).findByText(mes(MES_QUE_VEM))).toBeInTheDocument()
  })

  it('cancelar a confirmação não grava nada', async () => {
    await abrirPagamentos({ pagamentos: [cobranca(MES_ATUAL)], sincronizar: false })
    fireEvent.click(screen.getByRole('button', { name: `Pagar ${mes(MES_ATUAL)} com Pix` }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Confirmar pagamento' })).getByRole('button', {
        name: 'Cancelar',
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments).toEqual([expect.objectContaining({ status: 'pendente' })])
  })

  it('se o banco recusa, avisa e a cobrança continua em aberto', async () => {
    const painel = await abrirPagamentos({ pagamentos: [cobranca(MES_ATUAL)], sincronizar: false })
    bancoFalso().erroEscrita = { message: 'negado' }
    await pagar(`Pagar ${mes(MES_ATUAL)} com Pix`)

    expect(await screen.findByText('Não foi possível confirmar o pagamento.')).toBeInTheDocument()
    expect(emAberto(painel).getAllByRole('listitem')).toHaveLength(1)
  })

  it('valor alterado no cadastro vale para as cobranças em aberto, não para o que já foi pago', async () => {
    const painel = await abrirPagamentos({
      cliente: { ...CLIENTE, mrr: 2000 },
      pagamentos: [paga(MES_PASSADO, 1500), cobranca(MES_ATUAL)],
    })
    expect(within(painel.getByRole('region', { name: 'Histórico' })).getByText(/1\.500,00/)).toBeInTheDocument()
    await waitFor(() => expect(emAberto(painel).getAllByText(/2\.000,00/)).toHaveLength(4))
    expect(emAberto(painel).queryByText(/1\.500,00/)).not.toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments.find((l) => l.mes_referencia === MES_ATUAL)).toMatchObject({
      valor: 2000,
    })
  })

  it('cliente em churn tem as cobranças em aberto canceladas e o histórico preservado', async () => {
    const painel = await abrirPagamentos({
      cliente: { ...CLIENTE, status: 'churn' },
      pagamentos: [paga(MES_PASSADO), cobranca(MES_ATUAL), cobranca(MES_QUE_VEM)],
    })
    expect(await painel.findByText('Nenhuma cobrança em aberto.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments.map((l) => l.status)).toEqual([
      'pago',
      'cancelado',
      'cancelado',
    ])
    expect(within(painel.getByRole('region', { name: 'Histórico' })).getByText(mes(MES_PASSADO))).toBeInTheDocument()
  })

  it('sem início de contrato nem dia de vencimento, explica o que falta', async () => {
    const painel = await abrirPagamentos({ cliente: { ...CLIENTE, data_inicio_contrato: null } })
    expect(
      painel.getByText(
        'Informe o início do contrato ou o dia do vencimento no cadastro do cliente para gerar as cobranças.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments).toHaveLength(0)
  })

  it('sem as migrations, gera e confirma do mesmo jeito e avisa que a forma não foi gravada', async () => {
    await abrirPagamentos({
      colunasAusentes: [
        'clients.dia_vencimento',
        'client_payments.forma_pagamento',
        'client_payments.arquivado',
      ],
    })
    await pagar(`Pagar ${mes(MES_ATUAL)} com Pix`)

    expect(
      await screen.findByText(/Pagamento confirmado\. A forma de pagamento não foi gravada/),
    ).toBeInTheDocument()
    const linha = bancoFalso().tabelas.client_payments.find((l) => l.mes_referencia === MES_ATUAL)
    expect(linha).toMatchObject({ status: 'pago' })
    expect(linha).not.toHaveProperty('forma_pagamento')
    expect(linha).not.toHaveProperty('arquivado')
  })
})

describe('cadastro do cliente: dia do vencimento', () => {
  async function abrirEdicao(colunasAusentes: string[] = []) {
    popular()
    bancoFalso().colunasAusentes = colunasAusentes
    renderizar(<ClientesPage />)
    const card = within((await screen.findByRole('link', { name: 'Padaria Sol' })).closest('article')!)
    fireEvent.click(card.getByRole('button', { name: 'Editar Padaria Sol' }))
    return within(screen.getByRole('dialog', { name: 'Editar cliente' }))
  }

  it('com a coluna no banco, o campo aparece e é salvo', async () => {
    const modal = await abrirEdicao()
    fireEvent.change(await modal.findByLabelText('Dia do vencimento'), { target: { value: '5' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].dia_vencimento).toBe(5)
  })

  it('recusa dia fora de 1 a 31', async () => {
    const modal = await abrirEdicao()
    fireEvent.change(await modal.findByLabelText('Dia do vencimento'), { target: { value: '40' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await modal.findByText('Informe um dia entre 1 e 31.')).toBeInTheDocument()
  })

  it('sem a coluna, o campo não aparece e o cadastro continua salvando', async () => {
    const modal = await abrirEdicao(['clients.dia_vencimento'])
    await modal.findByText(/vencem no mesmo dia do mês/)
    expect(modal.queryByLabelText('Dia do vencimento')).not.toBeInTheDocument()
    fireEvent.change(modal.getByLabelText('Nome'), { target: { value: 'Padaria do Sol' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0]).not.toHaveProperty('dia_vencimento')
  })
})
