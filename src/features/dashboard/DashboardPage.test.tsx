vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { hojeISO, somarDias } from '@/lib/datas'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { DashboardPage } from './DashboardPage'

const HOJE = hojeISO()

function popular() {
  bancoFalso().reiniciar({
    profiles: [perfilDeTeste()],
    clients: [
      { id: 'c1', nome: 'Padaria Sol', status: 'ativo', mrr: 1500, created_at: '2026-01-01' },
      { id: 'c2', nome: 'Clínica Vita', status: 'ativo', mrr: 2500.5, created_at: '2026-01-02' },
      { id: 'c3', nome: 'Loja Antiga', status: 'churn', mrr: 900, created_at: '2026-01-03' },
    ],
    tasks: [
      {
        id: 't1',
        titulo: 'Roteiro de reels',
        status: 'a_fazer',
        tipo: 'conteudo',
        client_id: 'c1',
        responsavel_id: 'u1',
        data_entrega: somarDias(HOJE, -3),
        created_at: '2026-01-01',
      },
      {
        id: 't2',
        titulo: 'Relatório mensal',
        status: 'em_andamento',
        tipo: 'estrategia',
        client_id: 'apagado',
        responsavel_id: null,
        data_entrega: somarDias(HOJE, 2),
        created_at: '2026-01-02',
      },
      { id: 't3', titulo: 'Feita', status: 'concluido', tipo: 'trafego', created_at: '2026-01-03' },
      {
        id: 't4',
        titulo: 'Aprovar criativos',
        status: 'aguardando_aprovacao',
        tipo: 'trafego',
        client_id: 'c2',
        responsavel_id: 'u1',
        data_entrega: HOJE,
        created_at: '2026-01-04',
      },
    ],
    content_cards: [
      { id: 'k1', titulo: 'Carrossel', etapa: 'aguardando_aprovacao', created_at: '2026-01-01' },
      { id: 'k2', titulo: 'Post', etapa: 'editar', created_at: '2026-01-02' },
    ],
    campaigns: [
      {
        id: 'g1',
        nome: 'Black Friday',
        client_id: 'c1',
        status: 'em_execucao',
        proxima_otimizacao: somarDias(HOJE, -1),
        created_at: '2026-01-01',
      },
      {
        id: 'g2',
        nome: 'Institucional',
        client_id: 'c2',
        status: 'em_execucao',
        proxima_otimizacao: somarDias(HOJE, 20),
        created_at: '2026-01-02',
      },
    ],
    campaign_tasks: [
      { id: 'ct1', campaign_id: 'g1', funcao: 'copy', titulo: 'Copy', status: 'pendente' },
      { id: 'ct2', campaign_id: 'g1', funcao: 'copy', titulo: 'Feita', status: 'concluido' },
    ],
    calendar_events: [
      {
        id: 'e1',
        titulo: 'Reunião de pauta',
        descricao: null,
        tipo: 'reuniao',
        data_inicio: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
        data_fim: null,
        dia_inteiro: false,
        client_id: null,
        created_by: 'u1',
        created_at: '2026-01-01',
      },
      {
        id: 'e2',
        titulo: 'Evento de outro dia',
        descricao: null,
        tipo: 'outro',
        data_inicio: '2020-01-01T12:00:00Z',
        data_fim: null,
        dia_inteiro: false,
        client_id: null,
        created_by: 'u1',
        created_at: '2026-01-02',
      },
    ],
    activity_log: [
      {
        id: 'a1',
        user_id: 'u1',
        acao: 'demanda_criada',
        descricao: 'criou a demanda "Roteiro de reels"',
        entidade: 'tasks',
        entidade_id: 't1',
        created_at: new Date().toISOString(),
      },
    ],
  })
}

function painel(nome: string) {
  return within(screen.getByRole('region', { name: nome }))
}

describe('DashboardPage', () => {
  it('com o banco vazio mostra zeros e estados vazios, sem erro', async () => {
    bancoFalso().reiniciar()
    renderizar(<DashboardPage />)

    expect(await screen.findByText('Nenhuma entrega nos próximos 7 dias.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma otimização nos próximos 3 dias.')).toBeInTheDocument()
    expect(screen.getByText('Nada registrado ainda.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar demanda' })).toHaveAttribute('href', '/app/demandas')
    expect(screen.getByRole('link', { name: 'Criar anúncio' })).toHaveAttribute(
      'href',
      '/app/anuncios',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calcula os quatro indicadores', async () => {
    popular()
    renderizar(<DashboardPage />)

    const valorDe = (rotulo: string) => screen.getByText(rotulo).parentElement
    await waitFor(() => expect(valorDe('Clientes ativos')).toHaveTextContent('2'))
    expect(valorDe('Clientes ativos')).toHaveTextContent('2')
    // 3 demandas, 2 conteúdos em produção e 1 tarefa de anúncio
    expect(valorDe('Tarefas abertas')).toHaveTextContent('6')
    expect(valorDe('Conteúdos aguardando aprovação')).toHaveTextContent('1')
    // t1 está aberta com a entrega vencida
    expect(valorDe('Cards atrasados')).toHaveTextContent('1')
  })

  it('lista as próximas entregas, com atraso em destaque e nomes de reserva', async () => {
    popular()
    renderizar(<DashboardPage />)

    await screen.findByText('Roteiro de reels')
    const entregas = painel('Próximas entregas')
    expect(entregas.getByText('3 dias de atraso')).toBeInTheDocument()
    expect(entregas.getByText(/Padaria Sol/)).toBeInTheDocument()
    expect(entregas.getByText(/Sem cliente/)).toBeInTheDocument()
    expect(entregas.getByText(/Sem responsável/)).toBeInTheDocument()
    expect(entregas.queryByText('Feita')).not.toBeInTheDocument()
  })

  it('marcar como otimizado empurra a próxima otimização e registra a atividade', async () => {
    popular()
    renderizar(<DashboardPage />)

    const otimizacoes = painel('Próximas otimizações')
    expect(await otimizacoes.findByText('Black Friday')).toBeInTheDocument()
    expect(otimizacoes.queryByText('Institucional')).not.toBeInTheDocument()

    fireEvent.click(otimizacoes.getByRole('button', { name: 'Marcar como otimizado' }))

    expect(await screen.findByText('Otimização registrada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaigns[0].proxima_otimizacao).toBe(somarDias(HOJE, 2))
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'otimizacao_registrada', entidade_id: 'g1' }),
      ),
    )
  })

  it('avisa e desfaz quando o banco recusa a otimização', async () => {
    popular()
    renderizar(<DashboardPage />)
    const otimizacoes = painel('Próximas otimizações')
    await otimizacoes.findByText('Black Friday')
    bancoFalso().erroEscrita = { message: 'negado' }

    fireEvent.click(otimizacoes.getByRole('button', { name: 'Marcar como otimizado' }))

    expect(await screen.findByText('Não foi possível registrar a otimização.')).toBeInTheDocument()
    expect(otimizacoes.getByText('Black Friday')).toBeInTheDocument()
  })

  it('a seção Hoje junta os eventos e as entregas do dia', async () => {
    popular()
    renderizar(<DashboardPage />)
    const hojePainel = painel('Hoje')
    expect(await hojePainel.findByRole('link', { name: 'Reunião de pauta' })).toHaveAttribute(
      'href',
      `/app/calendario?dia=${HOJE}`,
    )
    expect(hojePainel.getByText('14:00')).toBeInTheDocument()
    expect(hojePainel.getByRole('link', { name: 'Aprovar criativos' })).toHaveAttribute(
      'href',
      '/app/demandas?abrir=t4',
    )
    expect(hojePainel.queryByText('Evento de outro dia')).not.toBeInTheDocument()
    expect(hojePainel.queryByText('Relatório mensal')).not.toBeInTheDocument()
  })

  it('sem nada para hoje, a seção diz isso', async () => {
    bancoFalso().reiniciar()
    renderizar(<DashboardPage />)
    expect(await painel('Hoje').findByText('Nada marcado para hoje.')).toBeInTheDocument()
  })

  it('não mostra nada do financeiro para quem não é liderança', async () => {
    popular()
    renderizar(<DashboardPage />, { cargo: 'Designer' })
    expect(await screen.findByText('Clientes ativos')).toBeInTheDocument()
    expect(screen.queryByText('MRR total')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /MRR/ })).not.toBeInTheDocument()
  })

  it('a liderança vê MRR, ARR, leads no pipeline e conversão', async () => {
    popular()
    const agora = new Date().toISOString()
    bancoFalso().tabelas.leads = [
      { id: 'l1', nome: 'A', etapa: 'leads', etapa_desde: agora, posicao: 1, convertido_em: null, created_at: agora },
      { id: 'l2', nome: 'B', etapa: 'reuniao', etapa_desde: agora, posicao: 1, convertido_em: null, created_at: agora },
      { id: 'l3', nome: 'C', etapa: 'fechamento', etapa_desde: agora, posicao: 1, convertido_em: agora, created_at: agora },
      { id: 'l4', nome: 'D', etapa: 'leads', etapa_desde: agora, posicao: 2, convertido_em: null, created_at: agora },
    ]
    renderizar(<DashboardPage />)
    const valorDe = (rotulo: string) => screen.getByText(rotulo).parentElement
    await waitFor(() => expect(valorDe('MRR total')).toHaveTextContent('R$ 4.000,50'))
    expect(valorDe('ARR')).toHaveTextContent('R$ 48.006,00')
    expect(valorDe('Leads no pipeline')).toHaveTextContent('3')
    expect(valorDe('Conversão em 30 dias')).toHaveTextContent('25%')
  })

  it('quem não é liderança não vê valores nem consulta leads', async () => {
    popular()
    renderizar(<DashboardPage />, { cargo: 'Designer' })
    expect(await screen.findByText('Clientes ativos')).toBeInTheDocument()
    expect(screen.queryByText('MRR total')).not.toBeInTheDocument()
    expect(screen.queryByText('Leads no pipeline')).not.toBeInTheDocument()
  })

  it('sem leads criados nos últimos 30 dias, a conversão mostra um traço', async () => {
    popular()
    bancoFalso().tabelas.leads = []
    renderizar(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Conversão em 30 dias').parentElement).toHaveTextContent('—'))
  })

  it('desenha uma rosca por quadro, com os cards contados pela coluna', async () => {
    popular()
    const tabelas = bancoFalso().tabelas
    // O status antigo gravado no card não conta mais
    tabelas.tasks[0].situacao = 'travado'
    tabelas.board_columns = [
      { id: 'b1', quadro: 'demandas', chave: 'a_fazer', titulo: 'Fila', posicao: 1 },
      { id: 'b2', quadro: 'demandas', chave: 'em_andamento', titulo: 'Em Andamento', posicao: 2 },
      { id: 'b3', quadro: 'demandas', chave: 'aguardando_aprovacao', titulo: 'Aguardando Aprovação', posicao: 3 },
      { id: 'b4', quadro: 'demandas', chave: 'concluido', titulo: 'Concluído', posicao: 4 },
    ]
    renderizar(<DashboardPage />)

    const status = painel('Status dos cards')
    const demandas = await status.findByRole('img', { name: /^Demandas por coluna/ })
    expect(demandas).toHaveAccessibleName(
      'Demandas por coluna: Fila 1, Em Andamento 1, Aguardando Aprovação 1, Concluído 1',
    )
    expect(status.getByRole('img', { name: /^Conteúdo por coluna/ })).toHaveAccessibleName(
      'Conteúdo por coluna: Captar Material 0, Editar 1, Aguardando Aprovação 1, Publicado 0',
    )
    expect(status.getByRole('heading', { name: 'Demandas' })).toBeInTheDocument()
    expect(status.getByRole('heading', { name: 'Conteúdo' })).toBeInTheDocument()
    expect(screen.queryByText('Cards travados')).not.toBeInTheDocument()
  })

  it('sem cards nos quadros, a rosca dá lugar ao estado vazio', async () => {
    bancoFalso().reiniciar()
    renderizar(<DashboardPage />)
    expect(await painel('Status dos cards').findByText('Nenhum card nos quadros.')).toBeInTheDocument()
  })

  it('mostra a atividade recente com o nome de quem fez', async () => {
    popular()
    renderizar(<DashboardPage />)
    const atividade = painel('Atividade recente')
    expect(await atividade.findByText(/criou a demanda "Roteiro de reels"/)).toBeInTheDocument()
    expect(atividade.getByText('Luan Uliana')).toBeInTheDocument()
    expect(atividade.getByText('agora')).toBeInTheDocument()
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    bancoFalso().reiniciar()
    bancoFalso().erroLeitura = { message: 'sem rede' }
    renderizar(<DashboardPage />)

    const alertas = await screen.findAllByRole('alert')
    expect(alertas.length).toBeGreaterThan(0)

    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getAllByRole('button', { name: 'Tentar novamente' })[0])
    expect(await screen.findByText('Nenhuma entrega nos próximos 7 dias.')).toBeInTheDocument()
  })
})
