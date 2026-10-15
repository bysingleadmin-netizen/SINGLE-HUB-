vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { escolher, escolherPessoa } from '@/test/escolher'
import { BotaoCriar } from './BotaoCriar'
import { useCriar } from './CriacaoContext'

function popular(comCampanha = true) {
  bancoFalso().reiniciar({
    profiles: [
      perfilDeTeste(),
      { ...perfilDeTeste('Designer'), id: 'u2', nome: 'Bia Souza', email: 'bia@single.com' },
    ],
    clients: [{ id: 'c1', nome: 'Padaria Sol', status: 'ativo', mrr: 1500, created_at: '2026-01-01' }],
    tasks: [{ id: 't1', titulo: 'Antiga', status: 'a_fazer', tipo: 'conteudo', posicao: 3, created_at: '2026-01-01' }],
    content_cards: [],
    campaigns: comCampanha
      ? [{ id: 'g1', nome: 'Black Friday', client_id: 'c1', status: 'em_execucao', created_at: '2026-01-01' }]
      : [],
    campaign_tasks: [],
  })
}

async function abrir() {
  renderizar(<BotaoCriar />)
  fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }))
  const modal = within(screen.getByRole('dialog', { name: 'Nova tarefa' }))
  // Espera as listas carregarem para as seleções terem opções
  await modal.findByRole('option', { name: 'Padaria Sol' })
  return modal
}

describe('criação central de tarefas', () => {
  it('abre em Demanda e explica para qual menu a tarefa vai', async () => {
    popular()
    const modal = await abrir()
    expect(modal.getByLabelText('Tipo')).toHaveAttribute('data-valor', 'demanda')
    expect(modal.getByText('Pedido de cliente ou trabalho interno. Vai para o menu Demandas.')).toBeInTheDocument()
    expect(modal.getByLabelText('Status')).toHaveValue('a_fazer')
  })

  it('cria uma demanda, que entra no fim da coluna e avisa o responsável', async () => {
    popular()
    const modal = await abrir()
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Banner da campanha' } })
    escolher(modal.getByLabelText('Área'), 'trafego')
    escolherPessoa(screen.getByRole('dialog', { name: 'Nova tarefa' }), 'Bia Souza')
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Demanda criada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[1]).toMatchObject({
      responsavel_id: 'u2',
      responsaveis: ['u2'],
      titulo: 'Banner da campanha',
      tipo: 'trafego',
      status: 'a_fazer',
      posicao: 4,
      created_by: 'u1',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(bancoFalso().tabelas.notifications).toContainEqual(
        expect.objectContaining({ user_id: 'u2', tipo: 'tarefa' }),
      ),
    )
  })

  it('trocar para Conteúdo muda os campos e grava no pipeline de conteúdo', async () => {
    popular()
    const modal = await abrir()
    escolher(modal.getByLabelText('Tipo'), 'conteudo')
    expect(modal.getByText('Vai para o menu Conteúdo.')).toBeInTheDocument()
    expect(modal.queryByLabelText('Status')).not.toBeInTheDocument()
    expect(modal.getByLabelText('Etapa')).toHaveValue('captar_material')

    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Reels de bastidores' } })
    escolher(modal.getByLabelText('Tipo de conteúdo'), 'reels')
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Conteúdo criado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards[0]).toMatchObject({
      titulo: 'Reels de bastidores',
      tipo_conteudo: 'reels',
      etapa: 'captar_material',
    })
    expect(bancoFalso().tabelas.tasks).toHaveLength(1)
  })

  it('categoria Anúncio grava a demanda na campanha e na função escolhidas', async () => {
    popular()
    const modal = await abrir()
    escolher(modal.getByLabelText('Tipo'), 'campanha')
    expect(modal.getByText('Demanda de anúncio, com ou sem campanha. Vai para o menu Anúncios.')).toBeInTheDocument()

    await modal.findByRole('option', { name: 'Black Friday' })
    fireEvent.change(modal.getByLabelText('Campanha'), { target: { value: 'g1' } })
    // Com campanha, o cliente vem dela
    expect(modal.queryByLabelText('Cliente')).not.toBeInTheDocument()
    fireEvent.change(modal.getByLabelText('Função'), { target: { value: 'criativos' } })
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Três criativos estáticos' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Demanda de anúncio criada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaign_tasks[0]).toMatchObject({
      campaign_id: 'g1',
      client_id: null,
      funcao: 'criativos',
      titulo: 'Três criativos estáticos',
      status: 'pendente',
    })
  })

  it('a campanha é opcional: sem ela, a demanda guarda o cliente', async () => {
    popular(false)
    const modal = await abrir()
    escolher(modal.getByLabelText('Tipo'), 'campanha')
    fireEvent.change(await modal.findByLabelText('Cliente'), { target: { value: 'c1' } })
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Pausar campanha antiga' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Demanda de anúncio criada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaign_tasks[0]).toMatchObject({
      campaign_id: null,
      client_id: 'c1',
      titulo: 'Pausar campanha antiga',
    })
  })

  it('exige o título', async () => {
    popular()
    const modal = await abrir()
    escolher(modal.getByLabelText('Tipo'), 'campanha')
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await modal.findByText('Informe o título da demanda.')).toBeInTheDocument()
    expect(modal.queryByText('Escolha a campanha.')).not.toBeInTheDocument()
    expect(bancoFalso().tabelas.campaign_tasks).toHaveLength(0)
  })

  it('sem a migration 0008 a campanha continua obrigatória', async () => {
    popular()
    bancoFalso().colunasAusentes = ['campaign_tasks.client_id']
    const modal = await abrir()
    escolher(modal.getByLabelText('Tipo'), 'campanha')
    await waitFor(() => expect(modal.queryByLabelText('Cliente')).not.toBeInTheDocument())
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Algo' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await modal.findByText('Escolha a campanha.')).toBeInTheDocument()
  })

  it('sem a migration 0008 e sem campanhas, manda criar uma antes', async () => {
    popular(false)
    bancoFalso().colunasAusentes = ['campaign_tasks.client_id']
    const modal = await abrir()
    escolher(modal.getByLabelText('Tipo'), 'campanha')
    expect(await modal.findByText('Crie uma campanha antes de adicionar demandas a ela.')).toBeInTheDocument()
    expect(modal.getByRole('link', { name: 'Ir para Anúncios' })).toHaveAttribute('href', '/app/anuncios')
    expect(modal.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('uma tela pode abrir o formulário já na categoria e na coluna certas', async () => {
    popular()
    function Coluna() {
      const criar = useCriar()
      return <button onClick={() => criar({ categoria: 'conteudo', etapa: 'editar' })}>mais</button>
    }
    renderizar(<Coluna />)
    fireEvent.click(screen.getByText('mais'))
    const modal = within(screen.getByRole('dialog', { name: 'Nova tarefa' }))
    expect(modal.getByLabelText('Tipo')).toHaveAttribute('data-valor', 'conteudo')
    expect(modal.getByLabelText('Etapa')).toHaveValue('editar')
  })

  it('oferece os três tipos', async () => {
    popular()
    const modal = await abrir()
    fireEvent.click(modal.getByLabelText('Tipo'))
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Conteúdo',
      'Demanda',
      'Anúncio',
    ])
  })

  it('avisa e mantém o formulário quando o banco recusa', async () => {
    popular()
    const modal = await abrir()
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Qualquer' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Não foi possível salvar a demanda.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nova tarefa' })).toBeInTheDocument()
  })
})
