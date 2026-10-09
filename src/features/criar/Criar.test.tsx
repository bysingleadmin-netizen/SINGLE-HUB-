vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
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
    expect(modal.getByLabelText('Categoria')).toHaveValue('demanda')
    expect(modal.getByText('Vai para o menu Demandas.')).toBeInTheDocument()
    expect(modal.getByLabelText('Status')).toHaveValue('a_fazer')
  })

  it('cria uma demanda, que entra no fim da coluna e avisa o responsável', async () => {
    popular()
    const modal = await abrir()
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Banner da campanha' } })
    fireEvent.change(modal.getByLabelText('Tipo'), { target: { value: 'trafego' } })
    fireEvent.change(modal.getByLabelText('Responsável'), { target: { value: 'u2' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Demanda criada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[1]).toMatchObject({
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
    fireEvent.change(modal.getByLabelText('Categoria'), { target: { value: 'conteudo' } })
    expect(modal.getByText('Vai para o menu Conteúdo.')).toBeInTheDocument()
    expect(modal.queryByLabelText('Status')).not.toBeInTheDocument()
    expect(modal.getByLabelText('Etapa')).toHaveValue('captar_material')

    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Reels de bastidores' } })
    fireEvent.change(modal.getByLabelText('Tipo de conteúdo'), { target: { value: 'reels' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Conteúdo criado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards[0]).toMatchObject({
      titulo: 'Reels de bastidores',
      tipo_conteudo: 'reels',
      etapa: 'captar_material',
    })
    expect(bancoFalso().tabelas.tasks).toHaveLength(1)
  })

  it('categoria Campanha grava a tarefa na campanha e na função escolhidas', async () => {
    popular()
    const modal = await abrir()
    fireEvent.change(modal.getByLabelText('Categoria'), { target: { value: 'campanha' } })
    expect(modal.getByText('Vai para a campanha escolhida, no menu Campanhas.')).toBeInTheDocument()

    await modal.findByRole('option', { name: 'Black Friday' })
    fireEvent.change(modal.getByLabelText('Campanha'), { target: { value: 'g1' } })
    fireEvent.change(modal.getByLabelText('Função'), { target: { value: 'criativos' } })
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Três criativos estáticos' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Tarefa adicionada à campanha.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaign_tasks[0]).toMatchObject({
      campaign_id: 'g1',
      funcao: 'criativos',
      titulo: 'Três criativos estáticos',
      status: 'pendente',
    })
  })

  it('categoria Campanha exige campanha e título', async () => {
    popular()
    const modal = await abrir()
    fireEvent.change(modal.getByLabelText('Categoria'), { target: { value: 'campanha' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))
    expect(await modal.findByText('Escolha a campanha.')).toBeInTheDocument()
    expect(modal.getByText('Informe o título da tarefa.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.campaign_tasks).toHaveLength(0)
  })

  it('sem campanhas cadastradas, manda criar uma antes', async () => {
    popular(false)
    const modal = await abrir()
    fireEvent.change(modal.getByLabelText('Categoria'), { target: { value: 'campanha' } })
    expect(
      await modal.findByText('Crie uma campanha antes de adicionar tarefas a ela.'),
    ).toBeInTheDocument()
    expect(modal.getByRole('link', { name: 'Ir para Campanhas' })).toHaveAttribute(
      'href',
      '/app/campanhas',
    )
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
    expect(modal.getByLabelText('Categoria')).toHaveValue('conteudo')
    expect(modal.getByLabelText('Etapa')).toHaveValue('editar')
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
