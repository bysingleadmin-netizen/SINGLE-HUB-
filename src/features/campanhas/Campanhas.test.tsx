vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { hojeISO, somarDias } from '@/lib/datas'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { CampanhaPage } from './CampanhaPage'
import { CampanhasPage } from './CampanhasPage'

const HOJE = hojeISO()
const CLIENTE = { id: 'c1', nome: 'Padaria Sol', status: 'ativo', mrr: 1500, created_at: '2026-01-01' }

const BLACK_FRIDAY = {
  id: 'g1',
  nome: 'Black Friday',
  client_id: 'c1',
  status: 'em_execucao',
  data_inicio: '2026-11-01',
  data_fim: '2026-11-30',
  orcamento: 3000,
  estrategia: 'Remarketing para quem visitou o site',
  proxima_otimizacao: somarDias(HOJE, -1),
  created_at: '2026-10-01T00:00:00Z',
}

function popular() {
  bancoFalso().reiniciar({
    profiles: [
      perfilDeTeste(),
      { ...perfilDeTeste('Copywriter'), id: 'u2', nome: 'Bia Souza', email: 'bia@single.com' },
    ],
    clients: [CLIENTE],
    campaigns: [
      BLACK_FRIDAY,
      {
        ...BLACK_FRIDAY,
        id: 'g2',
        nome: 'Institucional',
        status: 'planejamento',
        proxima_otimizacao: null,
        created_at: '2026-10-02T00:00:00Z',
      },
    ],
    campaign_tasks: [
      {
        id: 'x1',
        campaign_id: 'g1',
        funcao: 'copy',
        titulo: 'Escrever anúncios',
        status: 'pendente',
        responsavel_id: 'u2',
        created_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'x2',
        campaign_id: 'g2',
        funcao: 'copy',
        titulo: 'De outra campanha',
        status: 'pendente',
        responsavel_id: 'apagado',
        created_at: '2026-10-01T00:00:00Z',
      },
    ],
  })
}

describe('CampanhasPage', () => {
  it('sem campanhas mostra o estado vazio com a ação de criar', async () => {
    bancoFalso().reiniciar({ clients: [CLIENTE] })
    renderizar(<CampanhasPage />)
    expect(await screen.findByText('Nenhuma campanha ainda.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Nova campanha' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lista com cliente, status, período, orçamento e alerta de otimização', async () => {
    popular()
    renderizar(<CampanhasPage />)

    const linha = within((await screen.findByRole('link', { name: 'Black Friday' })).closest('li')!)
    expect(screen.getByRole('link', { name: 'Black Friday' })).toHaveAttribute(
      'href',
      '/app/campanhas/g1',
    )
    expect(linha.getByText(/Padaria Sol/)).toBeInTheDocument()
    expect(linha.getByText('Em execução')).toBeInTheDocument()
    expect(linha.getByText(/01\/11\/2026 a 30\/11\/2026/)).toBeInTheDocument()
    expect(linha.getByText(/3\.000,00/)).toBeInTheDocument()
    expect(linha.getByText('Otimização pendente')).toBeInTheDocument()

    const outra = within(screen.getByRole('link', { name: 'Institucional' }).closest('li')!)
    expect(outra.queryByText('Otimização pendente')).not.toBeInTheDocument()
  })

  it('filtra por status', async () => {
    popular()
    renderizar(<CampanhasPage />)
    await screen.findByRole('link', { name: 'Black Friday' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'planejamento' } })
    expect(screen.queryByRole('link', { name: 'Black Friday' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Institucional' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'finalizada' } })
    expect(screen.getByText('Nenhuma campanha com esse status.')).toBeInTheDocument()
  })

  it('cria a campanha, aceita orçamento com vírgula e registra a atividade', async () => {
    bancoFalso().reiniciar({ clients: [CLIENTE] })
    renderizar(<CampanhasPage />)
    await screen.findByText('Nenhuma campanha ainda.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Nova campanha' })[0])

    const modal = within(screen.getByRole('dialog', { name: 'Nova campanha' }))
    fireEvent.change(modal.getByLabelText('Nome'), { target: { value: 'Dia das Mães' } })
    fireEvent.change(modal.getByLabelText('Cliente'), { target: { value: 'c1' } })
    fireEvent.change(modal.getByLabelText('Orçamento'), { target: { value: '2.500,50' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Campanha criada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaigns[0]).toMatchObject({
      nome: 'Dia das Mães',
      client_id: 'c1',
      orcamento: 2500.5,
      status: 'planejamento',
    })
    expect(await screen.findByRole('link', { name: 'Dia das Mães' })).toBeInTheDocument()
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'campanha_criada' }),
      ),
    )
  })

  it('sem clientes, o formulário manda cadastrar um antes', async () => {
    bancoFalso().reiniciar()
    renderizar(<CampanhasPage />)
    await screen.findByText('Nenhuma campanha ainda.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Nova campanha' })[0])

    const modal = within(screen.getByRole('dialog', { name: 'Nova campanha' }))
    expect(modal.getByText('Cadastre um cliente antes de criar uma campanha.')).toBeInTheDocument()
    expect(modal.getByRole('link', { name: 'Ir para Clientes' })).toHaveAttribute(
      'href',
      '/app/clientes',
    )
    expect(modal.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    bancoFalso().reiniciar()
    bancoFalso().erroLeitura = { message: 'sem rede' }
    renderizar(<CampanhasPage />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhuma campanha ainda.')).toBeInTheDocument()
  })
})

describe('CampanhaPage', () => {
  function abrir(id = 'g1') {
    return renderizar(
      <Routes>
        <Route path="/app/campanhas/:id" element={<CampanhaPage />} />
      </Routes>,
      { rota: `/app/campanhas/${id}` },
    )
  }

  it('mostra os dados da campanha e o alerta de otimização pendente', async () => {
    popular()
    abrir()
    expect(await screen.findByRole('heading', { name: 'Black Friday' })).toBeInTheDocument()
    expect(screen.getByText(/Padaria Sol/)).toBeInTheDocument()
    expect(screen.getByText(/3\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/Otimização pendente desde/)).toBeInTheDocument()
    expect(screen.getByLabelText('Estratégia da campanha')).toHaveValue('Remarketing para quem visitou o site')
  })

  it('campanha sem otimização pendente não mostra o alerta', async () => {
    popular()
    abrir('g2')
    await screen.findByRole('heading', { name: 'Institucional' })
    expect(screen.queryByText(/Otimização pendente desde/)).not.toBeInTheDocument()
  })

  it('registrar otimização empurra a data, tira o alerta e registra a atividade', async () => {
    popular()
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar otimização' }))

    expect(await screen.findByText('Otimização registrada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaigns[0].proxima_otimizacao).toBe(somarDias(HOJE, 2))
    await waitFor(() =>
      expect(screen.queryByText(/Otimização pendente desde/)).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'otimizacao_registrada', entidade_id: 'g1' }),
      ),
    )
  })

  it('salva a estratégia ao sair do campo', async () => {
    popular()
    abrir()
    const campo = await screen.findByLabelText('Estratégia da campanha')
    fireEvent.change(campo, { target: { value: 'Foco em público frio' } })
    fireEvent.blur(campo)
    expect(await screen.findByText('Estratégia salva.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaigns[0].estrategia).toBe('Foco em público frio')
  })

  it('agrupa as tarefas por função e mostra só as desta campanha', async () => {
    popular()
    abrir()
    await screen.findByRole('heading', { name: 'Black Friday' })
    for (const funcao of ['Copy', 'Criativos', 'Captação de Material', 'Tráfego', 'Estratégia']) {
      expect(screen.getByRole('region', { name: funcao })).toBeInTheDocument()
    }
    const copy = within(screen.getByRole('region', { name: 'Copy' }))
    expect(copy.getByText('Escrever anúncios')).toBeInTheDocument()
    expect(copy.getByLabelText('Responsável por Escrever anúncios')).toHaveValue('u2')
    expect(screen.queryByText('De outra campanha')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Criativos' })).getByText('Nenhuma tarefa.'),
    ).toBeInTheDocument()
  })

  it('tarefa com responsável que não existe mais aparece sem responsável', async () => {
    popular()
    abrir('g2')
    await screen.findByRole('heading', { name: 'Institucional' })
    expect(screen.getByLabelText('Responsável por De outra campanha')).toHaveValue('')
  })

  it('adiciona tarefa em uma função', async () => {
    popular()
    abrir()
    await screen.findByRole('heading', { name: 'Black Friday' })
    const trafego = within(screen.getByRole('region', { name: 'Tráfego' }))
    fireEvent.change(trafego.getByLabelText('Nova tarefa de Tráfego'), {
      target: { value: 'Subir conjuntos' },
    })
    fireEvent.click(trafego.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('Tarefa adicionada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaign_tasks[2]).toMatchObject({
      campaign_id: 'g1',
      funcao: 'trafego',
      titulo: 'Subir conjuntos',
      status: 'pendente',
    })
    expect(await trafego.findByText('Subir conjuntos')).toBeInTheDocument()
  })

  it('não adiciona tarefa sem título', async () => {
    popular()
    abrir()
    await screen.findByRole('heading', { name: 'Black Friday' })
    const trafego = within(screen.getByRole('region', { name: 'Tráfego' }))
    fireEvent.click(trafego.getByRole('button', { name: 'Adicionar' }))
    expect(bancoFalso().tabelas.campaign_tasks).toHaveLength(2)
  })

  it('troca status e responsável da tarefa', async () => {
    popular()
    abrir()
    await screen.findByText('Escrever anúncios')
    fireEvent.change(screen.getByLabelText('Status de Escrever anúncios'), {
      target: { value: 'concluido' },
    })
    expect(await screen.findByText('Tarefa atualizada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaign_tasks[0].status).toBe('concluido')

    fireEvent.change(screen.getByLabelText('Responsável por Escrever anúncios'), {
      target: { value: '' },
    })
    await waitFor(() => expect(bancoFalso().tabelas.campaign_tasks[0].responsavel_id).toBeNull())
  })

  it('desfaz e avisa quando o banco recusa a troca de status', async () => {
    popular()
    abrir()
    await screen.findByText('Escrever anúncios')
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.change(screen.getByLabelText('Status de Escrever anúncios'), {
      target: { value: 'concluido' },
    })
    expect(await screen.findByText('Não foi possível atualizar a tarefa.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByLabelText('Status de Escrever anúncios')).toHaveValue('pendente'),
    )
  })

  it('remove a tarefa', async () => {
    popular()
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Remover Escrever anúncios' }))
    expect(await screen.findByText('Tarefa removida.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Escrever anúncios')).not.toBeInTheDocument())
  })

  it('edita os dados da campanha', async () => {
    popular()
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const modal = within(screen.getByRole('dialog', { name: 'Editar campanha' }))
    expect(modal.getByLabelText('Orçamento')).toHaveValue('3000,00')
    fireEvent.change(modal.getByLabelText('Status'), { target: { value: 'pausada' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Campanha atualizada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaigns[0].status).toBe('pausada')
  })

  it('avisa quando a campanha não existe', async () => {
    popular()
    abrir('nao-existe')
    expect(await screen.findByText('Campanha não encontrada.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para Campanhas' })).toHaveAttribute(
      'href',
      '/app/campanhas',
    )
  })
})
