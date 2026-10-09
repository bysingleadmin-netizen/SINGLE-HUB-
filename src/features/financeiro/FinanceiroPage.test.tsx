vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { formatarMes } from '@/features/clientes/cliente'
import { hojeISO, somarDias } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import { bancoFalso, renderizar } from '@/test/renderizar'
import { FinanceiroPage } from './FinanceiroPage'

const HOJE = hojeISO()
const MES = HOJE.slice(0, 7)

// O formatador põe um espaço não separável depois de "R$"; a busca por texto enxerga um espaço comum
const moeda = (valor: number) => formatarMoeda(valor).replace(/\s/g, ' ')

function abrir(aba = '', tabelas: Record<string, object[]> = {}) {
  bancoFalso().reiniciar({
    clients: [],
    client_payments: [],
    expenses: [],
    monthly_goals: [],
    traffic_metrics: [],
    ...tabelas,
  })
  return renderizar(
    <Routes>
      <Route path="/app/financeiro/:aba?" element={<FinanceiroPage />} />
    </Routes>,
    { rota: `/app/financeiro${aba && `/${aba}`}` },
  )
}

const painel = (nome: string) => within(screen.getByRole('region', { name: nome }))

/** Para painéis que só aparecem depois de os dados carregarem */
const painelPronto = async (nome: string) => within(await screen.findByRole('region', { name: nome }))

const MES_ATUAL = `${MES}-01`

function cobranca(parcial: Record<string, unknown>) {
  return {
    client_id: 'c1',
    mes_referencia: MES_ATUAL,
    valor: 2000,
    data_vencimento: HOJE,
    data_pagamento: null,
    status: 'pendente',
    ...parcial,
  }
}

const CLIENTES = [
  { id: 'c1', nome: 'Clínica Aurora', status: 'ativo', mrr: 2000, data_inicio_contrato: null },
  { id: 'c2', nome: 'Padaria Sol', status: 'ativo', mrr: 800, data_inicio_contrato: null },
  { id: 'c3', nome: 'Loja Pausada', status: 'pausado', mrr: 900, data_inicio_contrato: null },
]

describe('abas', () => {
  it('abre na Visão Geral e troca de aba pelo endereço', async () => {
    abrir()
    expect(screen.getByRole('tab', { name: 'Visão Geral' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Nenhum pagamento atrasado.')).toBeInTheDocument()
    for (const nome of ['Pagamentos', 'Despesas', 'Relatórios']) {
      expect(screen.getByRole('tab', { name: nome })).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('tab', { name: 'Relatórios' }))
    expect(screen.getByRole('tab', { name: 'Relatórios' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Resultado do mês' })).toBeInTheDocument()
  })

  it('endereço de aba desconhecida cai na Visão Geral', () => {
    abrir('qualquer')
    expect(screen.getByRole('tab', { name: 'Visão Geral' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Visão Geral', () => {
  const pagamentos = [
    // Recebido neste mês
    cobranca({ id: 'p1', client_id: 'c2', valor: 750, status: 'pago', data_pagamento: HOJE }),
    // Venceu há 10 dias
    cobranca({ id: 'p2', data_vencimento: somarDias(HOJE, -10) }),
    // Vence em 3 dias
    cobranca({ id: 'p3', client_id: 'c2', valor: 800, data_vencimento: somarDias(HOJE, 3) }),
    // Vence fora da janela de 7 dias
    cobranca({ id: 'p4', client_id: 'c2', valor: 800, data_vencimento: somarDias(HOJE, 20), mes_referencia: '2099-01-01' }),
  ]

  it('mostra MRR ativo, recebido, pendente e a inadimplência', async () => {
    abrir('', { clients: CLIENTES, client_payments: pagamentos })
    const atrasados = painel('Pagamentos atrasados')
    expect(await atrasados.findByRole('link', { name: 'Clínica Aurora' })).toHaveAttribute(
      'href',
      '/app/clientes/c1',
    )
    expect(atrasados.getByText('10 dias de atraso')).toBeInTheDocument()

    const valorDe = (rotulo: string) => screen.getByText(rotulo).parentElement
    // O pausado não entra no MRR
    expect(valorDe('MRR ativo')).toHaveTextContent(moeda(2800))
    expect(valorDe('Recebido no mês')).toHaveTextContent(moeda(750))
    // Do mês atual: a vencida (2.000) e a que vence em 3 dias (800)
    expect(valorDe('Pendente no mês')).toHaveTextContent(moeda(2800))
    expect(valorDe('Em atraso')).toHaveTextContent(moeda(2000))
    expect(screen.getByText('1 cobrança vencida de 1 cliente')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /^Recebimentos dos últimos 6 meses/ }),
    ).toBeInTheDocument()
  })

  it('lista os vencimentos dos próximos sete dias', async () => {
    abrir('', { clients: CLIENTES, client_payments: pagamentos })
    const proximos = painel('Próximos vencimentos')
    expect(await proximos.findByRole('link', { name: 'Padaria Sol' })).toBeInTheDocument()
    expect(proximos.getAllByRole('listitem')).toHaveLength(1)
    expect(proximos.getByText('Vence em 3 dias')).toBeInTheDocument()
  })

  it('sem nada vencido nem a vencer, diz isso', async () => {
    abrir()
    expect(await screen.findByText('Nenhum vencimento nos próximos 7 dias.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma cobrança vencida')).toBeInTheDocument()
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    abrir()
    bancoFalso().erroLeitura = { message: 'sem rede' }
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhum pagamento atrasado.')).toBeInTheDocument()
  })
})

describe('Pagamentos', () => {
  const pagamentos = [
    cobranca({ id: 'p1', data_vencimento: somarDias(HOJE, -2) }),
    cobranca({ id: 'p2', client_id: 'c2', valor: 800 }),
    cobranca({ id: 'p3', client_id: 'c2', valor: 800, mes_referencia: '2020-01-01', status: 'pago', data_pagamento: '2020-01-10', forma_pagamento: 'dinheiro' }),
  ]
  const mesAtual = formatarMes(MES)

  it('mostra as cobranças em aberto de todos os clientes, com o total', async () => {
    abrir('pagamentos', { clients: CLIENTES, client_payments: pagamentos })
    const lista = await painelPronto('Pagamentos')
    const cartoes = lista.getAllByRole('listitem')
    expect(cartoes).toHaveLength(2)
    expect(cartoes[0]).toHaveTextContent('Clínica Aurora')
    expect(cartoes[0]).toHaveTextContent('Atrasado')
    expect(cartoes[1]).toHaveTextContent('Padaria Sol')
    expect(lista.getByText('2 cobranças em aberto')).toBeInTheDocument()
    expect(lista.getByText(moeda(2800))).toBeInTheDocument()
    expect(lista.queryByRole('button', { name: /Adicionar|Novo pagamento/ })).not.toBeInTheDocument()
  })

  it('confirma o recebimento em dinheiro e a cobrança vai para o histórico', async () => {
    abrir('pagamentos', { clients: CLIENTES, client_payments: pagamentos })
    const lista = await painelPronto('Pagamentos')
    fireEvent.click(lista.getByRole('button', { name: `Pagar ${mesAtual} de Padaria Sol com Dinheiro` }))
    const confirmacao = within(screen.getByRole('dialog', { name: 'Confirmar pagamento' }))
    expect(confirmacao.getByText('Padaria Sol')).toBeInTheDocument()
    fireEvent.click(confirmacao.getByRole('button', { name: 'Confirmar pagamento' }))

    expect(await screen.findByText('Pagamento confirmado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.client_payments.find((l) => l.id === 'p2')).toMatchObject({
      status: 'pago',
      data_pagamento: HOJE,
      forma_pagamento: 'dinheiro',
      arquivado: true,
    })
    await waitFor(() => expect(lista.getByText('1 cobrança em aberto')).toBeInTheDocument())

    fireEvent.click(lista.getByRole('button', { name: 'Histórico' }))
    expect(lista.getByText('2 pagamentos recebidos')).toBeInTheDocument()
    expect(lista.getByText(`Padaria Sol, ${mesAtual}`)).toBeInTheDocument()
  })

  it('o histórico guarda o que foi pago e filtra por cliente', async () => {
    abrir('pagamentos', { clients: CLIENTES, client_payments: pagamentos })
    const lista = await painelPronto('Pagamentos')
    fireEvent.click(lista.getByRole('button', { name: 'Histórico' }))
    expect(lista.getByText('Padaria Sol, 01/2020')).toBeInTheDocument()
    expect(lista.getByText(/Pago em 10\/01\/2020, Dinheiro/)).toBeInTheDocument()

    fireEvent.change(lista.getByLabelText('Cliente'), { target: { value: 'c1' } })
    expect(lista.getByText('Nenhum pagamento confirmado ainda.')).toBeInTheDocument()
  })
})

describe('Despesas', () => {
  const despesas = [
    { id: 'd1', descricao: 'Adobe', categoria: 'Ferramentas', valor: 300, data: HOJE, forma_pagamento: 'Cartão' },
    { id: 'd2', descricao: 'Freelancer', categoria: 'Equipe', valor: 1200, data: HOJE, forma_pagamento: 'Pix' },
    // Fora do mês atual: não entra no período inicial
    { id: 'd3', descricao: 'Antiga', categoria: 'Outros', valor: 50, data: '2020-01-10', forma_pagamento: 'Pix' },
  ]

  it('lista as despesas do mês atual com o total do período', async () => {
    abrir('despesas', { expenses: despesas })
    const lista = painel('Despesas')
    expect(await lista.findByText('Adobe')).toBeInTheDocument()
    expect(lista.getByText('Freelancer')).toBeInTheDocument()
    expect(lista.queryByText('Antiga')).not.toBeInTheDocument()
    expect(lista.getByText(moeda(1500))).toBeInTheDocument()
    expect(lista.getByText('2 despesas')).toBeInTheDocument()
  })

  it('filtra por categoria e por período', async () => {
    abrir('despesas', { expenses: despesas })
    const lista = painel('Despesas')
    await lista.findByText('Adobe')

    fireEvent.change(lista.getByLabelText('Categoria do filtro'), { target: { value: 'Equipe' } })
    expect(lista.queryByText('Adobe')).not.toBeInTheDocument()
    expect(lista.getByText('1 despesa')).toBeInTheDocument()

    fireEvent.change(lista.getByLabelText('Categoria do filtro'), { target: { value: '' } })
    fireEvent.change(lista.getByLabelText('De'), { target: { value: '2020-01-01' } })
    expect(lista.getByText('Antiga')).toBeInTheDocument()
    expect(lista.getByText(moeda(1550))).toBeInTheDocument()
  })

  it('lança uma despesa em nome de quem está logado', async () => {
    abrir('despesas')
    const form = painel('Nova despesa')
    fireEvent.change(form.getByLabelText('Descrição'), { target: { value: ' Canva ' } })
    fireEvent.change(form.getByLabelText('Valor'), { target: { value: '89,90' } })
    fireEvent.change(form.getByLabelText('Categoria'), { target: { value: 'Ferramentas' } })
    fireEvent.click(form.getByRole('button', { name: 'Lançar despesa' }))

    expect(await screen.findByText('Despesa lançada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.expenses[0]).toMatchObject({
      descricao: 'Canva',
      categoria: 'Ferramentas',
      valor: 89.9,
      data: HOJE,
      forma_pagamento: 'Pix',
      created_by: 'u1',
    })
    expect(await painel('Despesas').findByText('Canva')).toBeInTheDocument()
    expect(form.getByLabelText('Descrição')).toHaveValue('')
  })

  it('não lança sem descrição ou com valor inválido', async () => {
    abrir('despesas')
    const form = painel('Nova despesa')
    fireEvent.change(form.getByLabelText('Valor'), { target: { value: 'abc' } })
    fireEvent.click(form.getByRole('button', { name: 'Lançar despesa' }))

    expect(await form.findByText('Informe a descrição.')).toBeInTheDocument()
    expect(form.getByText('Informe um valor como 1.500,00.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.expenses).toHaveLength(0)
  })

  it('avisa quando o banco recusa o lançamento', async () => {
    abrir('despesas')
    const form = painel('Nova despesa')
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.change(form.getByLabelText('Descrição'), { target: { value: 'Canva' } })
    fireEvent.change(form.getByLabelText('Valor'), { target: { value: '10' } })
    fireEvent.click(form.getByRole('button', { name: 'Lançar despesa' }))

    expect(await screen.findByText('Não foi possível lançar a despesa.')).toBeInTheDocument()
    expect(form.getByLabelText('Descrição')).toHaveValue('Canva')
  })

  it('exclui uma despesa só depois de confirmar', async () => {
    abrir('despesas', { expenses: despesas })
    const lista = painel('Despesas')
    fireEvent.click(await lista.findByRole('button', { name: 'Excluir Adobe' }))
    expect(bancoFalso().tabelas.expenses).toHaveLength(3)

    const confirmacao = within(screen.getByRole('dialog', { name: 'Excluir despesa' }))
    fireEvent.click(confirmacao.getByRole('button', { name: 'Excluir despesa' }))
    expect(await screen.findByText('Despesa excluída.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.expenses.map((d) => d.id)).toEqual(['d2', 'd3'])
    await waitFor(() => expect(lista.queryByText('Adobe')).not.toBeInTheDocument())
  })

  it('período sem despesas mostra estado vazio', async () => {
    abrir('despesas')
    expect(await screen.findByText('Nenhuma despesa neste período.')).toBeInTheDocument()
  })
})

describe('DRE', () => {
  it('mostra receita, despesas e resultado do mês e a tabela dos últimos seis', async () => {
    abrir('relatorios', {
      client_payments: [
        {
          id: 'p1',
          client_id: 'c1',
          mes_referencia: `${MES}-01`,
          valor: 5000,
          data_vencimento: HOJE,
          data_pagamento: HOJE,
          status: 'pago',
        },
      ],
      expenses: [
        { id: 'd1', descricao: 'Equipe', categoria: 'Equipe', valor: 1800, data: HOJE, forma_pagamento: 'Pix' },
      ],
    })
    const resultado = painel('Resultado do mês')
    expect(await resultado.findByText(moeda(5000))).toBeInTheDocument()
    expect(resultado.getByText(moeda(1800))).toBeInTheDocument()
    expect(resultado.getByText(moeda(3200))).toHaveAttribute('data-sinal', 'positivo')

    const tabela = painel('Últimos 6 meses')
    expect(tabela.getAllByRole('row')).toHaveLength(7)
    const linhaAtual = within(tabela.getByRole('row', { name: new RegExp(`^${formatarMes(MES)}`) }))
    expect(linhaAtual.getByText(moeda(3200))).toBeInTheDocument()
  })

  it('mês sem movimento fica zerado e resultado negativo é marcado', async () => {
    abrir('relatorios', {
      expenses: [
        { id: 'd1', descricao: 'Equipe', categoria: 'Equipe', valor: 400, data: HOJE, forma_pagamento: 'Pix' },
      ],
    })
    const resultado = painel('Resultado do mês')
    expect(await resultado.findByText(moeda(-400))).toHaveAttribute('data-sinal', 'negativo')

    const anterior = (resultado.getByLabelText('Mês') as HTMLSelectElement).options[1].value
    fireEvent.change(resultado.getByLabelText('Mês'), { target: { value: anterior } })
    expect(resultado.getAllByText(moeda(0))).toHaveLength(3)
  })
})

describe('Meta e Tráfego', () => {
  const recebido = {
    id: 'p1',
    client_id: 'c1',
    mes_referencia: `${MES}-01`,
    valor: 2500,
    data_vencimento: HOJE,
    data_pagamento: HOJE,
    status: 'pago',
  }

  it('sem meta definida, explica e deixa definir', async () => {
    abrir('relatorios', { client_payments: [recebido] })
    const meta = await painelPronto(`Meta de ${formatarMes(MES)}`)
    expect(await meta.findByText(/Nenhuma meta definida para este mês/)).toBeInTheDocument()

    fireEvent.change(meta.getByLabelText('Meta do mês'), { target: { value: '10.000,00' } })
    fireEvent.click(meta.getByRole('button', { name: 'Salvar meta' }))
    expect(await screen.findByText('Meta salva.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.monthly_goals).toEqual([
      expect.objectContaining({ mes: `${MES}-01`, meta: 10000 }),
    ])
    expect(await meta.findByText('25%')).toBeInTheDocument()
    expect(meta.getByText(`Faltam ${moeda(7500)} para a meta.`)).toBeInTheDocument()
    expect(meta.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  })

  it('atualiza a meta do mês em vez de criar outra', async () => {
    abrir('relatorios', {
      client_payments: [recebido],
      monthly_goals: [{ id: 'g1', mes: `${MES}-01`, meta: 2000 }],
    })
    const meta = await painelPronto(`Meta de ${formatarMes(MES)}`)
    expect(await meta.findByText('Meta batida.')).toBeInTheDocument()
    expect(meta.getByLabelText('Meta do mês')).toHaveValue('2000,00')

    fireEvent.change(meta.getByLabelText('Meta do mês'), { target: { value: '5000' } })
    fireEvent.click(meta.getByRole('button', { name: 'Salvar meta' }))
    expect(await screen.findByText('Meta salva.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.monthly_goals).toEqual([
      expect.objectContaining({ id: 'g1', meta: 5000 }),
    ])
  })

  it('não salva meta com valor inválido', async () => {
    abrir('relatorios')
    const meta = await painelPronto(`Meta de ${formatarMes(MES)}`)
    fireEvent.change(await meta.findByLabelText('Meta do mês'), { target: { value: 'dez mil' } })
    fireEvent.click(meta.getByRole('button', { name: 'Salvar meta' }))
    expect(await meta.findByText('Informe um valor como 1.500,00.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.monthly_goals).toHaveLength(0)
  })

  it('salva as métricas do mês e mostra CPL e conversão no histórico', async () => {
    abrir('relatorios')
    const form = await painelPronto('Métricas de tráfego')
    fireEvent.change(form.getByLabelText('Investimento'), { target: { value: '1.500,00' } })
    fireEvent.change(form.getByLabelText('Leads do Instagram'), { target: { value: '20' } })
    fireEvent.change(form.getByLabelText('Leads do WhatsApp'), { target: { value: '10' } })
    fireEvent.change(form.getByLabelText('Convertidos'), { target: { value: '6' } })
    fireEvent.click(form.getByRole('button', { name: 'Salvar métricas' }))

    expect(await screen.findByText('Métricas salvas.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.traffic_metrics).toEqual([
      expect.objectContaining({
        mes: `${MES}-01`,
        investimento: 1500,
        leads_instagram: 20,
        leads_whatsapp: 10,
        convertidos: 6,
      }),
    ])
    const linha = within(
      await painel('Histórico de tráfego').findByRole('row', {
        name: new RegExp(`^${formatarMes(MES)}`),
      }),
    )
    expect(linha.getByText(moeda(50))).toBeInTheDocument()
    expect(linha.getByText('20%')).toBeInTheDocument()
  })

  it('traz o que já foi salvo no mês e atualiza a mesma linha', async () => {
    abrir('relatorios', {
      traffic_metrics: [
        { id: 'm1', mes: `${MES}-01`, investimento: 800, leads_instagram: 0, leads_whatsapp: 0, convertidos: 0 },
      ],
    })
    const form = await painelPronto('Métricas de tráfego')
    expect(form.getByLabelText('Investimento')).toHaveValue('800,00')
    // Sem leads não há custo por lead nem conversão
    expect(painel('Histórico de tráfego').getAllByText('sem dados')).toHaveLength(2)

    fireEvent.change(form.getByLabelText('Leads do Instagram'), { target: { value: '16' } })
    fireEvent.click(form.getByRole('button', { name: 'Salvar métricas' }))
    expect(await screen.findByText('Métricas salvas.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.traffic_metrics).toEqual([
      expect.objectContaining({ id: 'm1', leads_instagram: 16 }),
    ])
  })

  it('recusa mais convertidos do que leads', async () => {
    abrir('relatorios')
    const form = await painelPronto('Métricas de tráfego')
    fireEvent.change(form.getByLabelText('Leads do Instagram'), { target: { value: '2' } })
    fireEvent.change(form.getByLabelText('Convertidos'), { target: { value: '3' } })
    fireEvent.click(form.getByRole('button', { name: 'Salvar métricas' }))
    expect(
      await form.findByText('Os convertidos não podem passar do total de leads.'),
    ).toBeInTheDocument()
    expect(bancoFalso().tabelas.traffic_metrics).toHaveLength(0)
  })
})
