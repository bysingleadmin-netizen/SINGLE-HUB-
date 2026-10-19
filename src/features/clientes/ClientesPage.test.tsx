vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { hojeISO, somarDias } from '@/lib/datas'
import type { Cargo } from '@/lib/permissoes'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { escolher } from '@/test/escolher'
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
async function abrirCliente(cargo: Cargo = 'Liderança', id = 'c1') {
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

    fireEvent.click(padaria.getByRole('button', { name: 'Ações de Padaria Sol' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    expect(
      within(screen.getByRole('dialog', { name: 'Editar cliente' })).getByLabelText('Nome'),
    ).toHaveValue('Padaria Sol')
  })

  it('a liderança exclui um cliente pelo menu, avisando o que sai junto', async () => {
    popular()
    renderizar(<ClientesPage />)
    const card = within((await screen.findByRole('link', { name: 'Clínica Vita' })).closest('article')!)
    fireEvent.click(card.getByRole('button', { name: 'Ações de Clínica Vita' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    expect(screen.getByText(/^Excluir Clínica Vita\? As cobranças dele também são excluídas/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('Cliente excluído.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Clínica Vita' })).not.toBeInTheDocument())
    expect(bancoFalso().tabelas.clients.some((c) => c.nome === 'Clínica Vita')).toBe(false)
  })

  it('quem não é liderança edita, mas não exclui clientes', async () => {
    popular()
    renderizar(<ClientesPage />, { cargo: 'Colaborador' })
    const card = within((await screen.findByRole('link', { name: 'Clínica Vita' })).closest('article')!)
    fireEvent.click(card.getByRole('button', { name: 'Ações de Clínica Vita' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar'])
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
  it('perfil em seções: informações, canais com ícone, contrato e financeiro', async () => {
    await abrirCliente()
    for (const secao of ['Informações básicas', 'Canais', 'Contrato', 'Financeiro']) {
      expect(screen.getByRole('region', { name: secao })).toBeInTheDocument()
    }
    // Nenhum ARR calculado solto; o valor mensal fica na seção Financeiro
    expect(screen.queryByText(/18\.000,00/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Financeiro' })).getByText(/1\.500,00/)).toBeInTheDocument()

    const canais = within(screen.getByRole('region', { name: 'Canais' }))
    expect(canais.getByRole('link', { name: '@padariasol' })).toHaveAttribute('href', 'https://instagram.com/padariasol')
    expect(canais.getByRole('link', { name: /Meta Ads/ })).toHaveAttribute('href', 'https://business.facebook.com/padaria')
    expect(canais.getByText('Instagram')).toBeInTheDocument()
    expect(canais.getByText('ana@padaria.com')).toBeInTheDocument()
    // O contato aparece como pessoa, separado da empresa
    expect(canais.getByText('Ana')).toBeInTheDocument()
    expect(canais.getByText('Contato')).toBeInTheDocument()

    const contrato = within(screen.getByRole('region', { name: 'Contrato' }))
    expect(contrato.getByText('01/01/2025')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para Clientes' })).toHaveAttribute('href', '/app/clientes')
  })

  it('telefone ganha o botão do WhatsApp, só com os números', async () => {
    popular()
    bancoFalso().tabelas.clients[0].contato_telefone = '(27) 99999-0000'
    renderizar(
      <Routes>
        <Route path="/app/clientes/:id" element={<ClientePage />} />
      </Routes>,
      { rota: '/app/clientes/c1' },
    )
    expect(await screen.findByRole('link', { name: 'Abrir WhatsApp de Ana' })).toHaveAttribute(
      'href',
      'https://wa.me/5527999990000',
    )
  })

  it('quem não é liderança não vê a seção Financeiro', async () => {
    await abrirCliente('Colaborador')
    expect(screen.queryByRole('region', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.queryByText(/1\.500,00/)).not.toBeInTheDocument()
  })

  it('troca o status direto na página', async () => {
    await abrirCliente()
    escolher(screen.getByLabelText('Status'), 'pausado')
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
    await abrirCliente('Liderança', 'c2')
    expect(aba('Anúncios').getByText('Nenhum anúncio para este cliente.')).toBeInTheDocument()
    expect(aba('Conteúdos').getByText('Nenhum conteúdo para este cliente.')).toBeInTheDocument()
  })
})

describe('página do cliente: pagamentos', () => {
  let sequencia = 0
  function receita(parcial: Record<string, unknown> = {}) {
    sequencia++
    return {
      id: `r${sequencia}`,
      asaas_id: `pay_${sequencia}`,
      cliente_id: 'c1',
      asaas_customer_id: 'cus_1',
      nome_cliente_asaas: 'Padaria Sol ME',
      descricao: 'Mensalidade',
      valor: 1500,
      data_vencimento: '2026-10-10',
      data_pagamento: null,
      status: 'PENDING',
      forma_pagamento: 'PIX',
      tipo: 'PIX',
      vinculado: true,
      criado_em: '2026-10-01',
      atualizado_em: '2026-10-01',
      ...parcial,
    }
  }

  async function abrirPagamentos(tabelas: Record<string, object[]> = {}) {
    bancoFalso().reiniciar({
      profiles: [perfilDeTeste()],
      clients: [PADARIA, { ...PADARIA, id: 'c2', nome: 'Clínica Vita' }],
      client_payments: [],
      receitas_asaas: [],
      ...tabelas,
    })
    renderizar(
      <Routes>
        <Route path="/app/clientes/:id" element={<ClientePage />} />
      </Routes>,
      { rota: '/app/clientes/c1' },
    )
    await screen.findByRole('heading', { name: 'Padaria Sol' })
    return aba('Pagamentos')
  }

  it('a aba não existe para quem não é liderança', async () => {
    await abrirCliente('Colaborador')
    expect(screen.queryByRole('tab', { name: 'Pagamentos' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Demandas' })).toBeInTheDocument()
  })

  it('mostra as cobranças do Asaas ligadas ao cliente, em aberto e no histórico', async () => {
    const painel = await abrirPagamentos({
      receitas_asaas: [
        receita({ status: 'OVERDUE', data_vencimento: '2026-10-10' }),
        receita({ status: 'RECEIVED', data_vencimento: '2026-09-10', data_pagamento: '2026-09-09' }),
        receita({ cliente_id: 'c2', asaas_customer_id: 'cus_2', valor: 999 }),
      ],
    })
    const emAberto = within(await painel.findByRole('region', { name: 'Em aberto' }))
    expect(emAberto.getAllByRole('listitem')).toHaveLength(1)
    expect(emAberto.getByText('Atrasado')).toBeInTheDocument()
    const historico = within(painel.getByRole('region', { name: 'Histórico' }))
    expect(historico.getByText('Pago')).toBeInTheDocument()
    expect(historico.getByText(/pago 09\/09\/2026/)).toBeInTheDocument()
    // A cobrança de outro cliente não aparece
    expect(painel.queryByText(/999,00/)).not.toBeInTheDocument()
    // Nada se confirma à mão
    expect(painel.queryByRole('button', { name: /Pix|Dinheiro|Editar/ })).not.toBeInTheDocument()
  })

  it('sem cobranças do Asaas ligadas, explica como ligar', async () => {
    const painel = await abrirPagamentos()
    expect(await painel.findByText('Nenhuma cobrança do Asaas ligada a este cliente.')).toBeInTheDocument()
  })

  it('pagamentos lançados à mão antes do Asaas ficam só para consulta', async () => {
    const painel = await abrirPagamentos({
      client_payments: [
        { id: 'p1', client_id: 'c1', mes_referencia: '2026-08-01', valor: 1500, data_vencimento: '2026-08-10', data_pagamento: '2026-08-09', status: 'pago', forma_pagamento: 'pix' },
        { id: 'p2', client_id: 'c1', mes_referencia: '2026-11-01', valor: 1500, data_vencimento: '2026-11-10', data_pagamento: null, status: 'pendente' },
      ],
    })
    const antigos = within(await painel.findByRole('region', { name: 'Lançados à mão' }))
    expect(antigos.getAllByRole('listitem')).toHaveLength(1)
    expect(antigos.getByText(/Pago em 09\/08\/2026, Pix/)).toBeInTheDocument()
  })
})

describe('cadastro do cliente: dia do vencimento e CNPJ', () => {
  async function abrirEdicao(colunasAusentes: string[] = []) {
    popular()
    bancoFalso().colunasAusentes = colunasAusentes
    renderizar(<ClientesPage />)
    const card = within((await screen.findByRole('link', { name: 'Padaria Sol' })).closest('article')!)
    fireEvent.click(card.getByRole('button', { name: 'Ações de Padaria Sol' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
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
    await modal.findByLabelText('CNPJ ou CPF')
    expect(modal.queryByLabelText('Dia do vencimento')).not.toBeInTheDocument()
    fireEvent.change(modal.getByLabelText('Nome'), { target: { value: 'Padaria do Sol' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0]).not.toHaveProperty('dia_vencimento')
  })

  it('guarda o CNPJ como digitado, para ligar o cliente ao Asaas', async () => {
    const modal = await abrirEdicao()
    fireEvent.change(await modal.findByLabelText('CNPJ ou CPF'), { target: { value: '12.345.678/0001-90' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].cnpj).toBe('12.345.678/0001-90')
  })

  it('recusa documento que não é CNPJ nem CPF', async () => {
    const modal = await abrirEdicao()
    fireEvent.change(await modal.findByLabelText('CNPJ ou CPF'), { target: { value: '1234' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await modal.findByText('Informe um CNPJ com 14 dígitos ou um CPF com 11.')).toBeInTheDocument()
  })

  it('sem a migration 0007, o campo de CNPJ não aparece e o cadastro salva sem ele', async () => {
    const modal = await abrirEdicao(['clients.cnpj'])
    await modal.findByLabelText('Dia do vencimento')
    expect(modal.queryByLabelText('CNPJ ou CPF')).not.toBeInTheDocument()
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0]).not.toHaveProperty('cnpj')
  })
})

describe('contrato de fidelidade', () => {
  it('mostra o tempo de casa e o encerramento do contrato, amarelo perto do fim', async () => {
    // 6 meses contados de 170 dias atrás vencem em cerca de 12 dias
    const inicio = somarDias(hojeISO(), -170)
    bancoFalso().reiniciar({
      profiles: [perfilDeTeste()],
      clients: [
        { id: 'c1', nome: 'Scofield', status: 'ativo', mrr: 2870, data_inicio_contrato: inicio, contrato_meses: 6, created_at: '2026-01-01' },
      ],
    })
    renderizar(<ClientesPage />)
    const selo = await screen.findByText(/^Encerra em /)
    expect(selo).toHaveAttribute('data-tom', 'amarelo')
    expect(screen.getByText(/5 meses de casa/)).toBeInTheDocument()
  })

  it('cadastra a duração do contrato', async () => {
    bancoFalso().reiniciar({ profiles: [perfilDeTeste()], clients: [] })
    renderizar(<ClientesPage />)
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo cliente/ }))[0])
    const modal = within(screen.getByRole('dialog', { name: 'Novo cliente' }))
    fireEvent.change(modal.getByLabelText('Nome'), { target: { value: 'Scofield' } })
    fireEvent.change(await modal.findByLabelText('Duração do contrato'), { target: { value: '12' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(bancoFalso().tabelas.clients[0]).toMatchObject({ nome: 'Scofield', contrato_meses: 12 }),
    )
  })

  it('sem a coluna no banco, a duração não aparece', async () => {
    bancoFalso().reiniciar({ profiles: [perfilDeTeste()], clients: [] })
    bancoFalso().colunasAusentes = ['clients.contrato_meses']
    renderizar(<ClientesPage />)
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo cliente/ }))[0])
    const modal = within(screen.getByRole('dialog', { name: 'Novo cliente' }))
    await modal.findByLabelText('CNPJ ou CPF')
    expect(modal.queryByLabelText('Duração do contrato')).not.toBeInTheDocument()
  })
})

describe('base de clientes: busca, filtro e tabela', () => {
  const ISADORA = { nome: 'Isadora', funcao: 'Co-Founder', email: 'isa@conecta.com', telefone: '(27) 99999-0000' }

  function popularBase() {
    bancoFalso().reiniciar({
      profiles: [perfilDeTeste(), { ...perfilDeTeste('Gestor de Tráfego'), id: 'u2', nome: 'Bia Souza' }],
      clients: [
        { ...PADARIA, area_atuacao: 'Alimentação', responsaveis: ['u2'], contatos: [] },
        {
          ...PADARIA,
          id: 'c2',
          nome: 'Conecta',
          status: 'pausado',
          mrr: 4000,
          data_inicio_contrato: '2026-01-10',
          contrato_meses: 12,
          cnpj: '12.345.678/0001-90',
          area_atuacao: 'Tecnologia',
          responsaveis: ['u1', 'u2'],
          contatos: [ISADORA, { nome: 'Bruno' }],
        },
        { ...PADARIA, id: 'c3', nome: 'Clínica Vita', status: 'churn', mrr: 900, data_inicio_contrato: null },
      ],
    })
  }

  async function abrirTabela() {
    popularBase()
    renderizar(<ClientesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tabela' }))
    return screen.getByRole('table', { name: 'Base de clientes' })
  }

  const nomesNaTabela = () =>
    within(screen.getByRole('table', { name: 'Base de clientes' }))
      .getAllByRole('button', { name: /^Abrir / })
      .map((b) => b.getAttribute('aria-label')?.replace('Abrir ', ''))

  it('busca pelo nome nas duas visões, sem diferenciar acentos', async () => {
    popularBase()
    renderizar(<ClientesPage />)
    fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'clinica' } })
    expect(screen.getByRole('link', { name: 'Clínica Vita' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Conecta' })).not.toBeInTheDocument()
    expect(screen.getByText('1 de 3 clientes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
    expect(nomesNaTabela()).toEqual(['Clínica Vita'])
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'xyz' } })
    expect(screen.getByText('Nenhum cliente com essa busca.')).toBeInTheDocument()
  })

  it('filtra ativos e inativos (pausados e churn)', async () => {
    await abrirTabela()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ativos' } })
    expect(nomesNaTabela()).toEqual(['Padaria Sol'])
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inativos' } })
    expect(nomesNaTabela()).toEqual(['Clínica Vita', 'Conecta'])
  })

  it('mostra as colunas da base e ordena ao clicar no cabeçalho', async () => {
    const tabela = within(await abrirTabela())
    for (const coluna of ['Nome', 'Área de atuação', 'Responsável SINGLE', 'MRR', 'Status', 'Meses de casa', 'Início']) {
      expect(tabela.getByRole('columnheader', { name: new RegExp(coluna) })).toBeInTheDocument()
    }
    expect(await tabela.findByText('Tecnologia')).toBeInTheDocument()
    expect(await tabela.findByText('Bia Souza')).toBeInTheDocument()
    expect(nomesNaTabela()).toEqual(['Clínica Vita', 'Conecta', 'Padaria Sol'])
    fireEvent.click(tabela.getByRole('button', { name: /MRR/ }))
    expect(nomesNaTabela()).toEqual(['Clínica Vita', 'Padaria Sol', 'Conecta'])
    fireEvent.click(tabela.getByRole('button', { name: /MRR/ }))
    expect(nomesNaTabela()).toEqual(['Conecta', 'Padaria Sol', 'Clínica Vita'])
    // Sem data de início fica no fim
    fireEvent.click(tabela.getByRole('button', { name: /Meses de casa/ }))
    expect(nomesNaTabela()).toEqual(['Conecta', 'Padaria Sol', 'Clínica Vita'])
  })

  it('a tabela fica escolhida ao voltar para a tela', async () => {
    await abrirTabela()
    expect(localStorage.getItem('single:visao:clientes')).toBe('lista')
  })

  it('clicar na linha abre a ficha completa, e Editar abre o formulário', async () => {
    await abrirTabela()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Conecta' }))
    const ficha = within(screen.getByRole('dialog', { name: 'Conecta' }))
    expect(ficha.getByText('12.345.678/0001-90')).toBeInTheDocument()
    expect((await ficha.findAllByText('Tecnologia')).length).toBeGreaterThan(0)
    expect(ficha.getByText(/4\.000,00/)).toBeInTheDocument()
    expect(ficha.getByText('10/01/2026')).toBeInTheDocument()
    // 12 meses a partir de 10/01/2026 terminam na véspera de 10/01/2027
    expect(ficha.getByText('09/01/2027')).toBeInTheDocument()
    const responsaveis = within(ficha.getByRole('region', { name: 'Responsáveis da SINGLE' }))
    expect(responsaveis.getByText('Luan Uliana')).toBeInTheDocument()
    expect(responsaveis.getByText('Bia Souza')).toBeInTheDocument()
    const contatos = within(ficha.getByRole('region', { name: 'Contatos' }))
    expect(contatos.getByText('Isadora')).toBeInTheDocument()
    expect(contatos.getByText('Co-Founder')).toBeInTheDocument()
    expect(contatos.getByRole('link', { name: 'isa@conecta.com' })).toHaveAttribute('href', 'mailto:isa@conecta.com')
    expect(contatos.getByRole('link', { name: 'Abrir WhatsApp de Isadora' })).toBeInTheDocument()
    expect(contatos.getByText('Bruno')).toBeInTheDocument()
    expect(ficha.getByRole('link', { name: 'Abrir página do cliente' })).toHaveAttribute('href', '/app/clientes/c2')

    fireEvent.click(ficha.getByRole('button', { name: 'Editar' }))
    const modal = within(screen.getByRole('dialog', { name: 'Editar cliente' }))
    expect(modal.getByLabelText('Nome')).toHaveValue('Conecta')
    expect(modal.getByLabelText('Área de atuação')).toHaveValue('Tecnologia')
    expect(modal.getAllByLabelText('Nome do contato').map((c) => (c as HTMLInputElement).value)).toEqual([
      'Isadora',
      'Bruno',
    ])
  })

  it('cliente que só tem o contato antigo mostra esse contato na ficha', async () => {
    await abrirTabela()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Padaria Sol' }))
    const contatos = within(screen.getByRole('region', { name: 'Contatos' }))
    expect(contatos.getByText('Ana')).toBeInTheDocument()
    expect(contatos.getByRole('link', { name: 'ana@padaria.com' })).toBeInTheDocument()
  })

  it('salva área, responsáveis e vários contatos, com o primeiro nas colunas antigas', async () => {
    await abrirTabela()
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Padaria Sol' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const modal = within(screen.getByRole('dialog', { name: 'Editar cliente' }))
    fireEvent.change(await modal.findByLabelText('Área de atuação'), { target: { value: 'Padaria' } })
    fireEvent.change(modal.getByLabelText('Responsáveis da SINGLE'), { target: { value: 'Luan' } })
    fireEvent.click(modal.getByRole('option', { name: /Luan Uliana/ }))
    fireEvent.change(modal.getByLabelText('Função'), { target: { value: 'Dona' } })
    fireEvent.click(modal.getByRole('button', { name: 'Adicionar contato' }))
    fireEvent.change(modal.getAllByLabelText('Nome do contato')[1], { target: { value: 'Carlos' } })
    fireEvent.change(modal.getAllByLabelText('Telefone do contato')[1], { target: { value: '27 98888-7777' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0]).toMatchObject({
      area_atuacao: 'Padaria',
      responsaveis: ['u2', 'u1'],
      contatos: [
        { nome: 'Ana', funcao: 'Dona', email: 'ana@padaria.com' },
        { nome: 'Carlos', telefone: '27 98888-7777' },
      ],
      contato_nome: 'Ana',
      contato_email: 'ana@padaria.com',
    })
  })

  it('remove um contato e avisa contato sem nome', async () => {
    await abrirTabela()
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Conecta' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const modal = within(screen.getByRole('dialog', { name: 'Editar cliente' }))
    fireEvent.click(await modal.findByRole('button', { name: 'Remover contato 1' }))
    expect(modal.getAllByLabelText('Nome do contato').map((c) => (c as HTMLInputElement).value)).toEqual(['Bruno'])
    fireEvent.change(modal.getByLabelText('Nome do contato'), { target: { value: '' } })
    fireEvent.change(modal.getByLabelText('Função'), { target: { value: 'CEO' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await modal.findByText('Informe o nome de cada contato.')).toBeInTheDocument()
  })

  it('sem a migration 0012, a tabela não tem área nem responsável e o formulário tem um contato só', async () => {
    popularBase()
    bancoFalso().colunasAusentes = ['clients.contatos']
    renderizar(<ClientesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tabela' }))
    const tabela = within(screen.getByRole('table', { name: 'Base de clientes' }))
    await tabela.findByRole('columnheader', { name: /MRR/ })
    expect(tabela.queryByRole('columnheader', { name: /Área de atuação/ })).not.toBeInTheDocument()
    expect(tabela.queryByRole('columnheader', { name: /Responsável SINGLE/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Padaria Sol' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    const modal = within(screen.getByRole('dialog', { name: 'Editar cliente' }))
    await modal.findByLabelText('CNPJ ou CPF')
    expect(modal.queryByLabelText('Área de atuação')).not.toBeInTheDocument()
    expect(modal.queryByRole('button', { name: 'Adicionar contato' })).not.toBeInTheDocument()
    fireEvent.change(modal.getByLabelText('Nome do contato'), { target: { value: 'Ana Paula' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients[0].contato_nome).toBe('Ana Paula')
    // O que já estava gravado fica como estava; o formulário não manda as colunas novas
    expect(bancoFalso().tabelas.clients[0].area_atuacao).toBe('Alimentação')
  })
})
