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
    expect(screen.getByRole('link', { name: 'Criar campanha' })).toHaveAttribute(
      'href',
      '/app/campanhas',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calcula os quatro indicadores', async () => {
    popular()
    renderizar(<DashboardPage />)

    expect(await screen.findByText(/4\.000,50/)).toBeInTheDocument()
    const valorDe = (rotulo: string) => screen.getByText(rotulo).parentElement
    expect(valorDe('Clientes ativos')).toHaveTextContent('2')
    expect(valorDe('Tarefas abertas')).toHaveTextContent('2')
    expect(valorDe('Conteúdos aguardando aprovação')).toHaveTextContent('1')
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
