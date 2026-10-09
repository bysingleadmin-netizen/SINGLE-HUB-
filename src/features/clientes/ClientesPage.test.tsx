vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { hojeISO } from '@/lib/datas'
import type { Cargo } from '@/lib/permissoes'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
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
    clients: [PADARIA],
    client_payments: [PAGAMENTO],
  })
}

async function abrirDetalhe(cargo: Cargo = 'CEO') {
  popular()
  renderizar(<ClientesPage />, { cargo })
  fireEvent.click(await screen.findByRole('button', { name: /Padaria Sol/ }))
  return within(await screen.findByRole('dialog', { name: 'Padaria Sol' }))
}

describe('ClientesPage', () => {
  it('sem clientes mostra o estado vazio com a ação de cadastrar', async () => {
    bancoFalso().reiniciar()
    renderizar(<ClientesPage />)
    expect(await screen.findByText('Nenhum cliente cadastrado.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Novo cliente' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mostra o card com status, valor mensal e fidelidade', async () => {
    popular()
    renderizar(<ClientesPage />)
    const card = await screen.findByRole('button', { name: /Padaria Sol/ })
    expect(card).toHaveTextContent('Ativo')
    expect(card).toHaveTextContent(/1\.500,00/)
    expect(card).toHaveTextContent(/1 ano/)
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
    expect(await screen.findByRole('button', { name: /Clínica Vita/ })).toBeInTheDocument()
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

describe('detalhe do cliente', () => {
  it('mostra valores, links e contato', async () => {
    const detalhe = await abrirDetalhe()
    expect(detalhe.getByText(/18\.000,00/)).toBeInTheDocument()
    expect(detalhe.getByRole('link', { name: '@padariasol' })).toHaveAttribute(
      'href',
      'https://instagram.com/padariasol',
    )
    expect(detalhe.getByRole('link', { name: 'Abrir conta de anúncios' })).toHaveAttribute(
      'href',
      'https://business.facebook.com/padaria',
    )
    expect(detalhe.getByText('ana@padaria.com')).toBeInTheDocument()
  })

  it('troca o status direto no detalhe', async () => {
    const detalhe = await abrirDetalhe()
    fireEvent.change(detalhe.getByLabelText('Status'), { target: { value: 'pausado' } })
    expect(await screen.findByText('Status atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].status).toBe('pausado')
  })

  it('salva as observações ao sair do campo', async () => {
    const detalhe = await abrirDetalhe()
    const campo = detalhe.getByLabelText('Observações')
    fireEvent.change(campo, { target: { value: 'Ligar só à tarde' } })
    fireEvent.blur(campo)
    expect(await screen.findByText('Observações salvas.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].observacoes).toBe('Ligar só à tarde')
  })

  it('recusa logo que não é imagem', async () => {
    const detalhe = await abrirDetalhe()
    const arquivo = new File(['x'], 'contrato.pdf', { type: 'application/pdf' })
    fireEvent.change(detalhe.getByLabelText('Enviar logo'), { target: { files: [arquivo] } })
    expect(await screen.findByText('Envie uma imagem PNG, JPG, WEBP ou SVG.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].logo_url).toBeNull()
  })

  it('envia a logo e grava o endereço público', async () => {
    const detalhe = await abrirDetalhe()
    const arquivo = new File(['x'], 'logo.png', { type: 'image/png' })
    fireEvent.change(detalhe.getByLabelText('Enviar logo'), { target: { files: [arquivo] } })
    expect(await screen.findByText('Logo atualizada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].logo_url).toMatch(/^https:\/\/falso\.test\/logos\/c1\//)
  })

  it('abre a edição com os dados atuais', async () => {
    const detalhe = await abrirDetalhe()
    fireEvent.click(detalhe.getByRole('button', { name: 'Editar' }))
    const modal = within(screen.getByRole('dialog', { name: 'Editar cliente' }))
    expect(modal.getByLabelText('Nome')).toHaveValue('Padaria Sol')
    expect(modal.getByLabelText('Valor mensal (MRR)')).toHaveValue('1500,00')

    fireEvent.change(modal.getByLabelText('Nome'), { target: { value: 'Padaria do Sol' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].nome).toBe('Padaria do Sol')
  })
})

describe('histórico de pagamentos', () => {
  it('não aparece para quem não é liderança', async () => {
    const detalhe = await abrirDetalhe('Social Media')
    expect(detalhe.queryByText('Histórico de pagamentos')).not.toBeInTheDocument()
  })

  it('a liderança vê o pagamento vencido como atrasado e marca como pago', async () => {
    const detalhe = await abrirDetalhe('Founder')
    expect(await detalhe.findByText('09/2026')).toBeInTheDocument()
    expect(detalhe.getByText('Atrasado')).toBeInTheDocument()

    fireEvent.click(detalhe.getByRole('button', { name: 'Marcar como pago' }))
    expect(await screen.findByText('Pagamento marcado como pago.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments[0]).toMatchObject({
      status: 'pago',
      data_pagamento: hojeISO(),
    })
  })

  it('adiciona um pagamento', async () => {
    const detalhe = await abrirDetalhe()
    await detalhe.findByText('09/2026')
    fireEvent.change(detalhe.getByLabelText('Mês'), { target: { value: '2026-10' } })
    fireEvent.change(detalhe.getByLabelText('Vencimento'), { target: { value: '2026-10-10' } })
    fireEvent.click(detalhe.getByRole('button', { name: 'Adicionar pagamento' }))

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
    const detalhe = await abrirDetalhe()
    await detalhe.findByText('09/2026')
    bancoFalso().erroEscrita = { message: 'duplicate key', code: '23505' }
    fireEvent.change(detalhe.getByLabelText('Mês'), { target: { value: '2026-09' } })
    fireEvent.change(detalhe.getByLabelText('Vencimento'), { target: { value: '2026-09-10' } })
    fireEvent.click(detalhe.getByRole('button', { name: 'Adicionar pagamento' }))

    expect(await screen.findByText('Já existe um pagamento para esse mês.')).toBeInTheDocument()
  })
})
