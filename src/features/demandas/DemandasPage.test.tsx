vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { hojeISO, somarDias } from '@/lib/datas'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { DemandasPage } from './DemandasPage'

const HOJE = hojeISO()

function tarefa(parcial: Record<string, unknown>) {
  return {
    descricao: null,
    client_id: null,
    responsavel_id: null,
    tipo: 'conteudo',
    status: 'a_fazer',
    data_entrega: null,
    posicao: 1,
    created_by: 'u1',
    created_at: '2026-10-01T00:00:00Z',
    ...parcial,
  }
}

function popular() {
  bancoFalso().reiniciar({
    profiles: [
      perfilDeTeste(),
      { ...perfilDeTeste('Designer'), id: 'u2', nome: 'Bia Souza', email: 'bia@single.com' },
    ],
    clients: [{ id: 'c1', nome: 'Padaria Sol', status: 'ativo', mrr: 1500, created_at: '2026-01-01' }],
    tasks: [
      tarefa({
        id: 't1',
        titulo: 'Roteiro de reels',
        client_id: 'c1',
        responsavel_id: 'u1',
        data_entrega: somarDias(HOJE, -2),
      }),
      tarefa({
        id: 't2',
        titulo: 'Subir campanha',
        tipo: 'trafego',
        status: 'em_andamento',
        client_id: 'apagado',
        responsavel_id: 'u2',
      }),
      tarefa({ id: 't3', titulo: 'Antiga', status: 'arquivado' }),
    ],
  })
}

function coluna(nome: string) {
  return within(screen.getByRole('region', { name: nome }))
}

describe('DemandasPage', () => {
  it('sem demandas mostra o quadro vazio com as quatro colunas e a ação de criar', async () => {
    bancoFalso().reiniciar()
    renderizar(<DemandasPage />)

    expect(await screen.findByText('Nenhuma demanda ainda.')).toBeInTheDocument()
    for (const nome of ['A Fazer', 'Em Andamento', 'Aguardando Aprovação', 'Concluído']) {
      expect(screen.getByRole('region', { name: nome })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'Arquivado' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar em A Fazer' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('distribui os cards, esconde os arquivados e usa nomes de reserva', async () => {
    popular()
    renderizar(<DemandasPage />)

    await screen.findByText('Roteiro de reels')
    const aFazer = coluna('A Fazer')
    expect(aFazer.getByText('Roteiro de reels')).toBeInTheDocument()
    expect(aFazer.getByText('Padaria Sol')).toBeInTheDocument()
    expect(aFazer.getByText('Conteúdo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir Roteiro de reels' }).parentElement).toHaveAttribute(
      'data-atrasado',
    )

    const emAndamento = coluna('Em Andamento')
    expect(emAndamento.getByText('Subir campanha')).toBeInTheDocument()
    expect(emAndamento.getByText('Sem cliente')).toBeInTheDocument()
    expect(screen.queryByText('Antiga')).not.toBeInTheDocument()
    expect(emAndamento.getByText('Sem data')).toBeInTheDocument()
    expect(emAndamento.getByText('Bia Souza')).toBeInTheDocument()
  })

  it('cria a demanda na coluna escolhida e registra a atividade', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar em Em Andamento' }))

    const modal = within(screen.getByRole('dialog', { name: 'Nova tarefa' }))
    expect(modal.getByLabelText('Status')).toHaveValue('em_andamento')
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Relatório mensal' } })
    fireEvent.change(modal.getByLabelText('Cliente'), { target: { value: 'c1' } })
    fireEvent.change(modal.getByLabelText('Tipo'), { target: { value: 'estrategia' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Demanda criada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[3]).toMatchObject({
      titulo: 'Relatório mensal',
      status: 'em_andamento',
      tipo: 'estrategia',
      client_id: 'c1',
      created_by: 'u1',
      posicao: 2,
    })
    expect(await coluna('Em Andamento').findByText('Relatório mensal')).toBeInTheDocument()
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'demanda_criada' }),
      ),
    )
  })

  it('avisa o responsável quando a demanda nasce atribuída a outra pessoa', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar em A Fazer' }))
    const modal = within(screen.getByRole('dialog', { name: 'Nova tarefa' }))
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Banner da campanha' } })
    fireEvent.change(modal.getByLabelText('Responsável'), { target: { value: 'u2' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Demanda criada.')
    const criada = bancoFalso().tabelas.tasks[3]
    await waitFor(() =>
      expect(bancoFalso().tabelas.notifications).toEqual([
        expect.objectContaining({
          user_id: 'u2',
          tipo: 'tarefa',
          lida: false,
          link: `/app/demandas?abrir=${criada.id}`,
        }),
      ]),
    )
  })

  it('não gera aviso quando a pessoa atribui a demanda a si mesma', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar em A Fazer' }))
    const modal = within(screen.getByRole('dialog', { name: 'Nova tarefa' }))
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Minha tarefa' } })
    fireEvent.change(modal.getByLabelText('Responsável'), { target: { value: 'u1' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Demanda criada.')
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'demanda_criada' }),
      ),
    )
    expect(bancoFalso().tabelas.notifications ?? []).toHaveLength(0)
  })

  it('não salva sem título', async () => {
    bancoFalso().reiniciar()
    renderizar(<DemandasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar em A Fazer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Informe o título da demanda.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks ?? []).toHaveLength(0)
  })

  it('filtra por tipo e por responsável', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'trafego' } })
    expect(screen.queryByText('Roteiro de reels')).not.toBeInTheDocument()
    expect(screen.getByText('Subir campanha')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'u1' } })
    expect(screen.queryByText('Subir campanha')).not.toBeInTheDocument()
    expect(screen.getByText('Nenhuma demanda com esses filtros.')).toBeInTheDocument()
  })

  it('arquiva pelo card e some do quadro', async () => {
    popular()
    renderizar(<DemandasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar Roteiro de reels' }))

    expect(await screen.findByText('Demanda arquivada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0].status).toBe('arquivado')
    await waitFor(() => expect(screen.queryByText('Roteiro de reels')).not.toBeInTheDocument())
  })

  it('se o banco recusa o arquivamento, avisa e o card volta', async () => {
    popular()
    renderizar(<DemandasPage />)
    const botao = await screen.findByRole('button', { name: 'Arquivar Roteiro de reels' })
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.click(botao)

    expect(await screen.findByText('Não foi possível mover a demanda.')).toBeInTheDocument()
    expect(await coluna('A Fazer').findByText('Roteiro de reels')).toBeInTheDocument()
  })

  async function abrirCard() {
    popular()
    renderizar(<DemandasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Roteiro de reels' }))
    return within(await screen.findByRole('dialog', { name: 'Roteiro de reels' }))
  }

  it('clicar no card abre o painel lateral com os dados, sem botão de salvar', async () => {
    const painel = await abrirCard()
    expect(painel.getByLabelText('Título')).toHaveValue('Roteiro de reels')
    expect(painel.getByLabelText('Cliente')).toHaveValue('c1')
    expect(painel.getByLabelText('Responsável')).toHaveValue('u1')
    expect(painel.getByLabelText('Status')).toHaveValue('a_fazer')
    expect(painel.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('salva o título ao sair do campo', async () => {
    const painel = await abrirCard()
    const titulo = painel.getByLabelText('Título')
    fireEvent.change(titulo, { target: { value: 'Roteiro final' } })
    fireEvent.blur(titulo)
    expect(await screen.findByText('Demanda atualizada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0].titulo).toBe('Roteiro final')
  })

  it('não aceita título em branco e devolve o anterior', async () => {
    const painel = await abrirCard()
    const titulo = painel.getByLabelText('Título')
    fireEvent.change(titulo, { target: { value: '  ' } })
    fireEvent.blur(titulo)
    expect(await painel.findByText('Informe o título da demanda.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0].titulo).toBe('Roteiro de reels')
  })

  it('seleções e data salvam na hora', async () => {
    const painel = await abrirCard()
    fireEvent.change(painel.getByLabelText('Tipo'), { target: { value: 'audiovisual' } })
    await waitFor(() => expect(bancoFalso().tabelas.tasks[0].tipo).toBe('audiovisual'))
    fireEvent.change(painel.getByLabelText('Responsável'), { target: { value: '' } })
    await waitFor(() => expect(bancoFalso().tabelas.tasks[0].responsavel_id).toBeNull())
    fireEvent.change(painel.getByLabelText('Data de entrega'), { target: { value: '2026-12-01' } })
    await waitFor(() => expect(bancoFalso().tabelas.tasks[0].data_entrega).toBe('2026-12-01'))
  })

  it('trocar o status pelo painel move o card e registra a atividade', async () => {
    const painel = await abrirCard()
    fireEvent.change(painel.getByLabelText('Status'), { target: { value: 'concluido' } })

    expect(await screen.findByText('Demanda movida para Concluído.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0].status).toBe('concluido')
    expect(await coluna('Concluído').findByText('Roteiro de reels')).toBeInTheDocument()
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'demanda_movida', entidade_id: 't1' }),
      ),
    )
  })

  it('desfaz e avisa quando o banco recusa uma edição', async () => {
    const painel = await abrirCard()
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.change(painel.getByLabelText('Tipo'), { target: { value: 'audiovisual' } })
    expect(await screen.findByText('Não foi possível salvar a demanda.')).toBeInTheDocument()
    await waitFor(() => expect(painel.getByLabelText('Tipo')).toHaveValue('conteudo'))
  })

  it('abre direto a demanda pedida pelo endereço', async () => {
    popular()
    renderizar(<DemandasPage />, { rota: '/app/demandas?abrir=t2' })
    expect(await screen.findByRole('dialog', { name: 'Subir campanha' })).toBeInTheDocument()
  })

  it('o card mostra o prazo em vermelho, amarelo ou verde', async () => {
    bancoFalso().reiniciar({
      tasks: [
        tarefa({ id: 'a', titulo: 'Vencida', data_entrega: somarDias(HOJE, -1) }),
        tarefa({ id: 'b', titulo: 'Para amanhã', data_entrega: somarDias(HOJE, 1), posicao: 2 }),
        tarefa({ id: 'c', titulo: 'Com folga', data_entrega: somarDias(HOJE, 10), posicao: 3 }),
      ],
    })
    renderizar(<DemandasPage />)
    await screen.findByText('Vencida')
    const prazo = (titulo: string) =>
      screen.getByRole('button', { name: `Abrir ${titulo}` }).querySelector('[data-prazo]')
    expect(prazo('Vencida')).toHaveAttribute('data-prazo', 'atrasado')
    expect(prazo('Para amanhã')).toHaveAttribute('data-prazo', 'proximo')
    expect(prazo('Com folga')).toHaveAttribute('data-prazo', 'folgado')
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    bancoFalso().reiniciar()
    bancoFalso().erroLeitura = { message: 'sem rede' }
    renderizar(<DemandasPage />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhuma demanda ainda.')).toBeInTheDocument()
  })
})
