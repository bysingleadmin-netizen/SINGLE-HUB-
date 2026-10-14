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
    expect(valorDe('Cards travados')).toHaveTextContent('0')
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

  it('não mostra nada do financeiro', async () => {
    popular()
    renderizar(<DashboardPage />)
    expect(await screen.findByText('Clientes ativos')).toBeInTheDocument()
    expect(screen.queryByText('MRR total')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /MRR/ })).not.toBeInTheDocument()
  })

  it('desenha a rosca com o status dos cards, incluindo os criados pela equipe', async () => {
    popular()
    const tabelas = bancoFalso().tabelas
    tabelas.tasks[0].situacao = 'travado'
    tabelas.tasks[1].situacao = 'personalizada_rev'
    tabelas.content_cards[0].situacao = 'em_andamento'
    tabelas.card_options = [
      { id: 'o1', campo: 'situacao', chave: 'travado', titulo: 'Travado', posicao: 1 },
      { id: 'o2', campo: 'situacao', chave: 'em_andamento', titulo: 'Em andamento', posicao: 2 },
      { id: 'o3', campo: 'situacao', chave: 'feito', titulo: 'Feito', posicao: 3 },
      { id: 'o4', campo: 'situacao', chave: 'personalizada_rev', titulo: 'Em revisão', posicao: 4 },
    ]
    renderizar(<DashboardPage />)

    const status = painel('Status dos cards')
    const rosca = await status.findByRole('img', { name: /^Status dos cards/ })
    // t1 travado, t2 em revisão, k1 em andamento; t3 e t4 sem status, k2 sem status
    expect(rosca).toHaveAccessibleName(
      'Status dos cards: Travado 1, Em andamento 1, Feito 0, Em revisão 1, Sem status 3',
    )
    expect(status.getByText('Em revisão')).toBeInTheDocument()
    expect(rosca.querySelectorAll('circle')).toHaveLength(5) // trilho e quatro fatias com card
    expect(await screen.findByText('Cards travados')).toBeInTheDocument()
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
