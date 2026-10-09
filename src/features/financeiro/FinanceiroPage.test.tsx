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

describe('abas', () => {
  it('abre no Dashboard e troca de aba pelo endereço', async () => {
    abrir()
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Nenhum pagamento atrasado.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'DRE' }))
    expect(screen.getByRole('tab', { name: 'DRE' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Resultado do mês' })).toBeInTheDocument()
  })

  it('endereço de aba desconhecida cai no Dashboard', () => {
    abrir('qualquer')
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Dashboard financeiro', () => {
  const clientes = [
    {
      id: 'c1',
      nome: 'Clínica Aurora',
      status: 'ativo',
      mrr: 2000,
      // Contrato começou há 40 dias e nada foi pago: o primeiro mês já venceu
      data_inicio_contrato: somarDias(HOJE, -40),
    },
    { id: 'c2', nome: 'Loja Pausada', status: 'pausado', mrr: 900, data_inicio_contrato: null },
  ]

  it('mostra MRR, ARR, recebido no mês e total em atraso', async () => {
    abrir('', {
      clients: clientes,
      client_payments: [
        {
          id: 'p1',
          client_id: 'c9',
          mes_referencia: `${MES}-01`,
          valor: 750,
          data_vencimento: HOJE,
          data_pagamento: HOJE,
          status: 'pago',
        },
      ],
    })
    const atrasados = painel('Pagamentos atrasados')
    // Dois meses vencidos do mesmo cliente: um aviso por mês
    const links = await atrasados.findAllByRole('link', { name: 'Clínica Aurora' })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute(
      'href',
      '/app/clientes/c1',
    )
    expect(atrasados.getAllByText(/de atraso$/)).toHaveLength(2)
    // ARR de 12 x 2.000 (o pausado não conta), 750 recebidos e dois meses de 2.000 em atraso
    expect(screen.getByText(moeda(24000))).toBeInTheDocument()
    expect(screen.getByText(moeda(750))).toBeInTheDocument()
    expect(screen.getByText(moeda(4000))).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: new RegExp(`^Faturamento dos últimos 6 meses`) }),
    ).toBeInTheDocument()
    expect(painel('Clientes há mais tempo').getByText('1 mês')).toBeInTheDocument()
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

describe('Lançamentos', () => {
  const despesas = [
    { id: 'd1', descricao: 'Adobe', categoria: 'Ferramentas', valor: 300, data: HOJE, forma_pagamento: 'Cartão' },
    { id: 'd2', descricao: 'Freelancer', categoria: 'Equipe', valor: 1200, data: HOJE, forma_pagamento: 'Pix' },
    // Fora do mês atual: não entra no período inicial
    { id: 'd3', descricao: 'Antiga', categoria: 'Outros', valor: 50, data: '2020-01-10', forma_pagamento: 'Pix' },
  ]

  it('lista as despesas do mês atual com o total do período', async () => {
    abrir('lancamentos', { expenses: despesas })
    const lista = painel('Despesas')
    expect(await lista.findByText('Adobe')).toBeInTheDocument()
    expect(lista.getByText('Freelancer')).toBeInTheDocument()
    expect(lista.queryByText('Antiga')).not.toBeInTheDocument()
    expect(lista.getByText(moeda(1500))).toBeInTheDocument()
    expect(lista.getByText('2 despesas')).toBeInTheDocument()
  })

  it('filtra por categoria e por período', async () => {
    abrir('lancamentos', { expenses: despesas })
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
    abrir('lancamentos')
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
    abrir('lancamentos')
    const form = painel('Nova despesa')
    fireEvent.change(form.getByLabelText('Valor'), { target: { value: 'abc' } })
    fireEvent.click(form.getByRole('button', { name: 'Lançar despesa' }))

    expect(await form.findByText('Informe a descrição.')).toBeInTheDocument()
    expect(form.getByText('Informe um valor como 1.500,00.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.expenses).toHaveLength(0)
  })

  it('avisa quando o banco recusa o lançamento', async () => {
    abrir('lancamentos')
    const form = painel('Nova despesa')
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.change(form.getByLabelText('Descrição'), { target: { value: 'Canva' } })
    fireEvent.change(form.getByLabelText('Valor'), { target: { value: '10' } })
    fireEvent.click(form.getByRole('button', { name: 'Lançar despesa' }))

    expect(await screen.findByText('Não foi possível lançar a despesa.')).toBeInTheDocument()
    expect(form.getByLabelText('Descrição')).toHaveValue('Canva')
  })

  it('exclui uma despesa só depois de confirmar', async () => {
    abrir('lancamentos', { expenses: despesas })
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
    abrir('lancamentos')
    expect(await screen.findByText('Nenhuma despesa neste período.')).toBeInTheDocument()
  })
})

describe('DRE', () => {
  it('mostra receita, despesas e resultado do mês e a tabela dos últimos seis', async () => {
    abrir('dre', {
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
    abrir('dre', {
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
    abrir('meta', { client_payments: [recebido] })
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
    abrir('meta', {
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
    abrir('meta')
    const meta = await painelPronto(`Meta de ${formatarMes(MES)}`)
    fireEvent.change(await meta.findByLabelText('Meta do mês'), { target: { value: 'dez mil' } })
    fireEvent.click(meta.getByRole('button', { name: 'Salvar meta' }))
    expect(await meta.findByText('Informe um valor como 1.500,00.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.monthly_goals).toHaveLength(0)
  })

  it('salva as métricas do mês e mostra CPL e conversão no histórico', async () => {
    abrir('meta')
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
    abrir('meta', {
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
    abrir('meta')
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
