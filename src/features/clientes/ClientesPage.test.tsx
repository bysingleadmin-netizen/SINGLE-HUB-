vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { hojeISO } from '@/lib/datas'
import type { Cargo } from '@/lib/permissoes'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { ClientePage } from './ClientePage'
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
    expect(aba('Campanhas').getByRole('link', { name: 'Black Friday' })).toHaveAttribute(
      'href',
      '/app/campanhas/g1',
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
    expect(aba('Campanhas').getByText('Nenhuma campanha para este cliente.')).toBeInTheDocument()
    expect(aba('Conteúdos').getByText('Nenhum conteúdo para este cliente.')).toBeInTheDocument()
  })
})

describe('página do cliente: pagamentos', () => {
  it('a aba não existe para quem não é liderança', async () => {
    await abrirCliente('Social Media')
    expect(screen.queryByRole('tab', { name: 'Pagamentos' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Demandas' })).toBeInTheDocument()
  })

  it('a liderança vê o pagamento vencido como atrasado e marca como pago', async () => {
    await abrirCliente('Founder')
    const pagamentos = aba('Pagamentos')
    expect(await pagamentos.findByText('09/2026')).toBeInTheDocument()
    expect(pagamentos.getByText('Atrasado')).toBeInTheDocument()

    fireEvent.click(pagamentos.getByRole('button', { name: 'Marcar como pago' }))
    expect(await screen.findByText('Pagamento marcado como pago.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments[0]).toMatchObject({
      status: 'pago',
      data_pagamento: hojeISO(),
    })
  })

  it('adiciona um pagamento', async () => {
    await abrirCliente()
    const pagamentos = aba('Pagamentos')
    await pagamentos.findByText('09/2026')
    fireEvent.change(pagamentos.getByLabelText('Mês'), { target: { value: '2026-10' } })
    fireEvent.change(pagamentos.getByLabelText('Vencimento'), { target: { value: '2026-10-10' } })
    fireEvent.click(pagamentos.getByRole('button', { name: 'Adicionar pagamento' }))

    expect(await screen.findByText('Pagamento adicionado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments[1]).toMatchObject({
      client_id: 'c1',
      mes_referencia: '2026-10-01',
      valor: 1500,
      data_vencimento: '2026-10-10',
      status: 'pendente',
    })
  })

  it('explica quando o mês já tem pagamento', async () => {
    await abrirCliente()
    const pagamentos = aba('Pagamentos')
    await pagamentos.findByText('09/2026')
    bancoFalso().erroEscrita = { message: 'duplicate key', code: '23505' }
    fireEvent.change(pagamentos.getByLabelText('Mês'), { target: { value: '2026-09' } })
    fireEvent.change(pagamentos.getByLabelText('Vencimento'), { target: { value: '2026-09-10' } })
    fireEvent.click(pagamentos.getByRole('button', { name: 'Adicionar pagamento' }))

    expect(await screen.findByText('Já existe um pagamento para esse mês.')).toBeInTheDocument()
  })
})
