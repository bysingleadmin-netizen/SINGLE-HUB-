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
    receitas_asaas: [],
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

let sequencia = 0

/** Uma linha de receitas_asaas */
function receita(parcial: Record<string, unknown>) {
  sequencia++
  return {
    id: `r${sequencia}`,
    asaas_id: `pay_${sequencia}`,
    cliente_id: null,
    asaas_customer_id: null,
    nome_cliente_asaas: null,
    descricao: 'Mensalidade',
    valor: 1000,
    data_vencimento: HOJE,
    data_pagamento: null,
    status: 'PENDING',
    forma_pagamento: 'PIX',
    tipo: 'PIX',
    vinculado: false,
    criado_em: HOJE,
    atualizado_em: HOJE,
    ...parcial,
  }
}

/** Cobrança lançada à mão antes do Asaas: não pode entrar em nenhuma conta */
const MANUAL_ANTIGA = {
  id: 'antiga',
  client_id: 'c1',
  mes_referencia: `${MES}-01`,
  valor: 9999,
  data_vencimento: HOJE,
  data_pagamento: HOJE,
  status: 'pago',
}

const CLIENTES = [
  { id: 'c1', nome: 'Clínica Aurora', status: 'ativo', mrr: 2000, asaas_customer_id: 'cus_1' },
  { id: 'c2', nome: 'Padaria Sol', status: 'ativo', mrr: 800, asaas_customer_id: null },
]

describe('abas', () => {
  it('abre na Visão Geral e troca de aba pelo endereço', async () => {
    abrir()
    expect(screen.getByRole('tab', { name: 'Visão Geral' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Nenhum pagamento atrasado.')).toBeInTheDocument()
    for (const nome of ['Pagamentos', 'Despesas', 'Relatórios']) {
      expect(screen.getByRole('tab', { name: nome })).toBeInTheDocument()
    }
    expect(screen.queryByRole('tab', { name: 'Cobranças Asaas' })).not.toBeInTheDocument()

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
  const vinculada = { cliente_id: 'c1', asaas_customer_id: 'cus_1', nome_cliente_asaas: 'Aurora ME', vinculado: true }

  it('os números saem das cobranças do Asaas, sem as manuais antigas', async () => {
    abrir('', {
      clients: CLIENTES,
      client_payments: [MANUAL_ANTIGA],
      receitas_asaas: [
        receita({ status: 'RECEIVED', valor: 750, data_vencimento: `${MES}-01`, data_pagamento: HOJE }),
        receita({ ...vinculada, status: 'OVERDUE', valor: 2000, data_vencimento: `${MES}-01` }),
        receita({ status: 'PENDING', valor: 800, data_vencimento: `${MES}-28` }),
        receita({ status: 'DELETED', valor: 5000, data_vencimento: `${MES}-02` }),
        receita({ status: 'PENDING', valor: 300, data_vencimento: '2099-01-10' }),
      ],
    })
    const valorDe = (rotulo: string) => screen.getByText(rotulo).parentElement
    await waitFor(() => expect(valorDe('Recebido no mês')).toHaveTextContent(moeda(750)))
    // Vencem no mês: a paga, a atrasada e a pendente; a excluída fica de fora
    expect(valorDe('MRR ativo')).toHaveTextContent(moeda(3550))
    expect(valorDe('A receber no mês')).toHaveTextContent(moeda(800))
    expect(valorDe('Em atraso')).toHaveTextContent(moeda(2000))
    expect(screen.getByText('1 cobrança vencida de 1 cliente')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Recebimentos dos últimos 6 meses/ })).toBeInTheDocument()
  })

  it('pagamentos atrasados levam ao cliente vinculado e mostram os dias', async () => {
    abrir('', {
      clients: CLIENTES,
      receitas_asaas: [
        receita({ ...vinculada, status: 'OVERDUE', valor: 2000, data_vencimento: somarDias(HOJE, -10) }),
        receita({ nome_cliente_asaas: 'Sem Vínculo', status: 'OVERDUE', data_vencimento: somarDias(HOJE, -2) }),
      ],
    })
    const atrasados = await painelPronto('Pagamentos atrasados')
    expect(await atrasados.findByRole('link', { name: 'Clínica Aurora' })).toHaveAttribute('href', '/app/clientes/c1')
    expect(atrasados.getByText('10 dias de atraso')).toBeInTheDocument()
    // Sem vínculo aparece com o nome do Asaas, sem link
    expect(atrasados.getByText('Sem Vínculo')).toBeInTheDocument()
    expect(atrasados.queryByRole('link', { name: 'Sem Vínculo' })).not.toBeInTheDocument()
  })

  it('próximos vencimentos: as pendentes dos próximos 30 dias', async () => {
    abrir('', {
      clients: CLIENTES,
      receitas_asaas: [
        receita({ nome_cliente_asaas: 'Padaria', data_vencimento: somarDias(HOJE, 3) }),
        receita({ nome_cliente_asaas: 'Distante', data_vencimento: somarDias(HOJE, 40) }),
        receita({ nome_cliente_asaas: 'Já paga', status: 'RECEIVED', data_vencimento: somarDias(HOJE, 5) }),
      ],
    })
    const proximos = await painelPronto('Próximos vencimentos')
    expect(await proximos.findByText('Padaria')).toBeInTheDocument()
    expect(proximos.getAllByRole('listitem')).toHaveLength(1)
    expect(proximos.getByText('Vence em 3 dias')).toBeInTheDocument()
  })

  it('sem nada vencido nem a vencer, diz isso', async () => {
    abrir()
    expect(await screen.findByText('Nenhum vencimento nos próximos 30 dias.')).toBeInTheDocument()
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
  const RECEITAS = [
    receita({ cliente_id: 'c1', asaas_customer_id: 'cus_1', nome_cliente_asaas: 'Aurora Clínica ME', valor: 2000, data_vencimento: '2026-10-10', data_pagamento: '2026-10-09', status: 'RECEIVED', vinculado: true }),
    receita({ asaas_customer_id: 'cus_2', nome_cliente_asaas: 'Sol Panificadora', valor: 800, data_vencimento: '2026-10-20', status: 'PENDING', forma_pagamento: 'BOLETO', tipo: 'SUBSCRIPTION' }),
    receita({ asaas_customer_id: 'cus_2', nome_cliente_asaas: 'Sol Panificadora', descricao: 'Setembro', valor: 800, data_vencimento: '2026-09-20', status: 'OVERDUE', forma_pagamento: 'BOLETO' }),
    receita({ asaas_customer_id: 'cus_3', nome_cliente_asaas: 'Outro', valor: 50, data_vencimento: '2026-09-01', status: 'DELETED' }),
  ]
  const linhasDe = (lista: ReturnType<typeof within>, nome: string) =>
    lista
      .getAllByText(nome, { selector: '[data-cobranca] *' })
      .map((el: HTMLElement) => within(el.closest('[data-cobranca]') as HTMLElement))

  it('em aberto mostra as pendentes e as atrasadas do Asaas, com o total', async () => {
    abrir('pagamentos', { clients: CLIENTES, client_payments: [MANUAL_ANTIGA], receitas_asaas: RECEITAS })
    const lista = await painelPronto('Pagamentos')
    const [atrasada, pendente] = linhasDe(lista, 'Sol Panificadora')
    expect(atrasada.getByText('Atrasado')).toBeInTheDocument()
    expect(pendente.getByText('Pendente')).toBeInTheDocument()
    expect(pendente.getByText(/Boleto, assinatura/)).toBeInTheDocument()
    expect(lista.getByText('2 cobranças em aberto')).toBeInTheDocument()
    expect(lista.getByText(moeda(1600))).toBeInTheDocument()
    // Nem a paga, nem a excluída, nem a manual antiga
    expect(lista.queryByText('Clínica Aurora', { selector: '[data-cobranca] *' })).not.toBeInTheDocument()
    expect(lista.queryByText('Outro', { selector: '[data-cobranca] *' })).not.toBeInTheDocument()
    expect(lista.getByText(/3 cobranças sem cliente vinculado/)).toBeInTheDocument()
    // Ninguém confirma pagamento à mão
    expect(lista.queryByRole('button', { name: /Pix|Dinheiro|Editar/ })).not.toBeInTheDocument()
  })

  it('o histórico mostra as pagas como Pago, com o cliente vinculado', async () => {
    abrir('pagamentos', { clients: CLIENTES, receitas_asaas: RECEITAS })
    const lista = await painelPronto('Pagamentos')
    fireEvent.click(lista.getByRole('button', { name: 'Histórico' }))
    const [linha] = linhasDe(lista, 'Clínica Aurora')
    expect(linha.getByRole('link', { name: 'Clínica Aurora' })).toHaveAttribute('href', '/app/clientes/c1')
    expect(linha.getByText('vinculada')).toBeInTheDocument()
    expect(linha.getByText('Pago')).toBeInTheDocument()
    expect(lista.getByText('1 pagamento recebido')).toBeInTheDocument()
  })

  it('filtra pelo cliente vinculado', async () => {
    abrir('pagamentos', { clients: CLIENTES, receitas_asaas: RECEITAS })
    const lista = await painelPronto('Pagamentos')
    fireEvent.change(lista.getByLabelText('Cliente'), { target: { value: 'c1' } })
    expect(lista.getByText('Nenhuma cobrança em aberto.')).toBeInTheDocument()
  })

  it('por cliente mostra quanto foi pago das cobranças do mês', async () => {
    abrir('pagamentos', { clients: CLIENTES, receitas_asaas: RECEITAS })
    const lista = await painelPronto('Pagamentos')
    fireEvent.click(lista.getByRole('button', { name: 'Por cliente' }))
    fireEvent.change(lista.getByLabelText('Mês'), { target: { value: '2026-10' } })
    expect(lista.getByRole('progressbar', { name: 'Clínica Aurora' })).toHaveAttribute('aria-valuenow', '100')
    expect(lista.getByRole('progressbar', { name: 'Sol Panificadora' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('vincular salva o id do Asaas no cliente e vincula todas as cobranças dele', async () => {
    abrir('pagamentos', { clients: CLIENTES, receitas_asaas: RECEITAS })
    const lista = await painelPronto('Pagamentos')
    fireEvent.click(lista.getAllByRole('button', { name: 'Vincular cliente de Sol Panificadora' })[0])

    const modal = within(screen.getByRole('dialog', { name: 'Vincular cliente' }))
    fireEvent.change(modal.getByLabelText('Cliente'), { target: { value: 'c2' } })
    fireEvent.click(modal.getByRole('button', { name: 'Vincular' }))

    expect(await screen.findByText('Cobranças de Sol Panificadora vinculadas a Padaria Sol.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients.find((c) => c.id === 'c2')).toMatchObject({ asaas_customer_id: 'cus_2' })
    const deCus2 = bancoFalso().tabelas.receitas_asaas.filter((r) => r.asaas_customer_id === 'cus_2')
    expect(deCus2.every((r) => r.vinculado === true && r.cliente_id === 'c2')).toBe(true)
    await waitFor(() => expect(lista.queryAllByRole('button', { name: /^Vincular cliente/ })).toHaveLength(0))
  })

  it('não vincula sem escolher o cliente', async () => {
    abrir('pagamentos', { clients: CLIENTES, receitas_asaas: RECEITAS })
    const lista = await painelPronto('Pagamentos')
    fireEvent.click(lista.getAllByRole('button', { name: 'Vincular cliente de Sol Panificadora' })[0])
    const modal = within(screen.getByRole('dialog', { name: 'Vincular cliente' }))
    fireEvent.click(modal.getByRole('button', { name: 'Vincular' }))
    expect(await modal.findByText('Escolha o cliente.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.clients.find((c) => c.id === 'c2')).toMatchObject({ asaas_customer_id: null })
  })

  it('sem cobranças, convida a sincronizar; o botão chama a função e conta o resultado', async () => {
    abrir('pagamentos', { clients: CLIENTES })
    bancoFalso().respostaDaFuncao = { ok: true, cobrancas: 105, vinculadas: 98, semVinculo: 7 }
    const lista = await painelPronto('Pagamentos')
    expect(await lista.findByText('Nenhuma cobrança do Asaas ainda.')).toBeInTheDocument()

    fireEvent.click(lista.getByRole('button', { name: 'Sincronizar Asaas' }))
    expect(
      await screen.findByText('Asaas sincronizado: 105 cobranças, 98 vinculadas a clientes e 7 sem cliente.'),
    ).toBeInTheDocument()
    expect(bancoFalso().funcoesChamadas).toEqual([{ nome: 'asaas-sync', body: {} }])
  })

  it('a recusa da função aparece como erro', async () => {
    abrir('pagamentos', { clients: CLIENTES })
    bancoFalso().respostaDaFuncao = { erro: 'Apenas a liderança pode sincronizar o Asaas.' }
    const lista = await painelPronto('Pagamentos')
    fireEvent.click(await lista.findByRole('button', { name: 'Sincronizar Asaas' }))
    expect(await screen.findByText('Apenas a liderança pode sincronizar o Asaas.')).toBeInTheDocument()
  })

  it('função não publicada: diz o que falta', async () => {
    abrir('pagamentos', { clients: CLIENTES })
    bancoFalso().erroDaFuncao = { message: 'not found', context: { status: 404 } }
    const lista = await painelPronto('Pagamentos')
    fireEvent.click(await lista.findByRole('button', { name: 'Sincronizar Asaas' }))
    expect(
      await screen.findByText('A função asaas-sync ainda não foi publicada no Supabase. Veja docs/INTEGRACOES.md.'),
    ).toBeInTheDocument()
  })

  it('sem a tabela no banco, explica o que falta configurar', async () => {
    abrir('pagamentos', { clients: CLIENTES })
    bancoFalso().tabelasAusentes = ['receitas_asaas']
    expect(await screen.findByText('As cobranças do Asaas aparecem depois da migration 0006.')).toBeInTheDocument()
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
    fireEvent.click(await lista.findByRole('button', { name: 'Ações de Adobe' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    expect(bancoFalso().tabelas.expenses).toHaveLength(3)

    expect(screen.getByText(/^Excluir Adobe\? Ela sai do DRE do mês\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Despesa excluída.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.expenses.map((d) => d.id)).toEqual(['d2', 'd3'])
    await waitFor(() => expect(lista.queryByText('Adobe')).not.toBeInTheDocument())
  })

  it('despesa recorrente lança uma por mês, no mesmo grupo', async () => {
    abrir('despesas')
    const form = painel('Nova despesa')
    fireEvent.change(form.getByLabelText('Descrição'), { target: { value: 'Assinatura Figma' } })
    fireEvent.change(form.getByLabelText('Valor'), { target: { value: '200' } })
    fireEvent.change(form.getByLabelText('Data'), { target: { value: '2026-10-14' } })
    fireEvent.click(form.getByLabelText('Despesa recorrente'))
    fireEvent.change(form.getByLabelText('Repetir por (meses)'), { target: { value: '5' } })
    fireEvent.click(form.getByRole('button', { name: 'Lançar despesa' }))

    expect(await screen.findByText('5 despesas lançadas com sucesso.')).toBeInTheDocument()
    const lancadas = bancoFalso().tabelas.expenses
    expect(lancadas.map((d) => d.data)).toEqual(['2026-10-14', '2026-11-14', '2026-12-14', '2027-01-14', '2027-02-14'])
    expect(lancadas.every((d) => d.descricao === 'Assinatura Figma' && d.valor === 200 && d.recorrente === true)).toBe(true)
    expect(new Set(lancadas.map((d) => d.grupo_recorrencia)).size).toBe(1)
    expect(lancadas[0].grupo_recorrencia).toEqual(expect.any(String))
  })

  it('não lança recorrência fora de 1 a 36 meses', async () => {
    abrir('despesas')
    const form = painel('Nova despesa')
    fireEvent.change(form.getByLabelText('Descrição'), { target: { value: 'Assinatura' } })
    fireEvent.change(form.getByLabelText('Valor'), { target: { value: '200' } })
    fireEvent.click(form.getByLabelText('Despesa recorrente'))
    fireEvent.change(form.getByLabelText('Repetir por (meses)'), { target: { value: '40' } })
    fireEvent.click(form.getByRole('button', { name: 'Lançar despesa' }))

    expect(await form.findByText('Repita de 1 a 36 meses.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.expenses).toHaveLength(0)
  })

  it('sem a migration 0005, a recorrência lança os meses sem marcar o grupo', async () => {
    abrir('despesas')
    bancoFalso().colunasAusentes = ['expenses.recorrente', 'expenses.grupo_recorrencia']
    const form = painel('Nova despesa')
    fireEvent.change(form.getByLabelText('Descrição'), { target: { value: 'Assinatura' } })
    fireEvent.change(form.getByLabelText('Valor'), { target: { value: '200' } })
    fireEvent.change(form.getByLabelText('Data'), { target: { value: '2026-10-14' } })
    fireEvent.click(form.getByLabelText('Despesa recorrente'))
    fireEvent.change(form.getByLabelText('Repetir por (meses)'), { target: { value: '3' } })
    fireEvent.click(form.getByRole('button', { name: 'Lançar despesa' }))

    expect(await screen.findByText('3 despesas lançadas com sucesso.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.expenses).toHaveLength(3)
    expect(bancoFalso().tabelas.expenses[0]).not.toHaveProperty('recorrente')
  })

  it('edita pelo menu, no mesmo formulário da criação, já preenchido', async () => {
    abrir('despesas', { expenses: despesas })
    fireEvent.click(await painel('Despesas').findByRole('button', { name: 'Ações de Adobe' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))

    const modal = within(screen.getByRole('dialog', { name: 'Editar despesa' }))
    expect(modal.getByLabelText('Descrição')).toHaveValue('Adobe')
    expect(modal.getByLabelText('Valor')).toHaveValue('300,00')
    expect(modal.queryByLabelText('Despesa recorrente')).not.toBeInTheDocument()
    fireEvent.change(modal.getByLabelText('Valor'), { target: { value: '350' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Despesa atualizada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.expenses[0]).toMatchObject({ id: 'd1', descricao: 'Adobe', valor: 350 })
    expect(bancoFalso().tabelas.expenses).toHaveLength(3)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('período sem despesas mostra estado vazio', async () => {
    abrir('despesas')
    expect(await screen.findByText('Nenhuma despesa neste período.')).toBeInTheDocument()
  })
})

describe('DRE', () => {
  it('mostra receita, despesas e resultado do mês e a tabela dos últimos seis', async () => {
    abrir('relatorios', {
      client_payments: [MANUAL_ANTIGA],
      receitas_asaas: [receita({ status: 'RECEIVED', valor: 5000, data_pagamento: HOJE })],
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
  const recebido = receita({ status: 'RECEIVED', valor: 2500, data_pagamento: HOJE })

  it('sem meta definida, explica e deixa definir', async () => {
    abrir('relatorios', { receitas_asaas: [recebido] })
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
      receitas_asaas: [recebido],
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
