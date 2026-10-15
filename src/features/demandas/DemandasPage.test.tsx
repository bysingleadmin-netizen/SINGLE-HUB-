vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { hojeISO, somarDias } from '@/lib/datas'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { escolher } from '@/test/escolher'
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
    escolher(modal.getByLabelText('Área'), 'estrategia')
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

    escolher(screen.getByLabelText('Área'), 'trafego')
    expect(screen.queryByText('Roteiro de reels')).not.toBeInTheDocument()
    expect(screen.getByText('Subir campanha')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Luan Uliana, CEO' }))
    expect(screen.queryByText('Subir campanha')).not.toBeInTheDocument()
    expect(screen.getByText('Nenhuma demanda com esses filtros.')).toBeInTheDocument()
  })

  it('o filtro por colaborador aceita mais de uma pessoa e pode ser limpo', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')

    const bia = screen.getByRole('button', { name: 'Bia Souza, Designer' })
    fireEvent.click(bia)
    expect(bia).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Roteiro de reels')).not.toBeInTheDocument()
    expect(screen.getByText('Subir campanha')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Luan Uliana, CEO' }))
    expect(screen.getByText('Roteiro de reels')).toBeInTheDocument()
    expect(screen.getByText('Subir campanha')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(bia).toHaveAttribute('aria-pressed', 'false')
  })

  it('o card mostra a empresa, o colaborador e o cargo dele', async () => {
    popular()
    renderizar(<DemandasPage />)
    const card = within(await screen.findByRole('button', { name: 'Abrir Roteiro de reels' }))
    expect(card.getByText('Padaria Sol')).toBeInTheDocument()
    expect(card.getByText('Luan Uliana')).toBeInTheDocument()
    expect(card.getByText('CEO')).toBeInTheDocument()
  })

  it('a visão em lista mostra status, responsável, entrega e cliente, e abre a demanda', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }))

    const tabela = within(screen.getByRole('table', { name: 'Lista de demandas' }))
    expect(tabela.getAllByRole('row')).toHaveLength(3)
    const linha = within(tabela.getByRole('row', { name: /Roteiro de reels/ }))
    expect(linha.getByText('A Fazer')).toBeInTheDocument()
    expect(linha.getByText('Padaria Sol')).toBeInTheDocument()
    expect(linha.getByText('CEO')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'A Fazer' })).not.toBeInTheDocument()

    fireEvent.click(linha.getByRole('button', { name: 'Abrir Roteiro de reels' }))
    expect(await screen.findByRole('dialog', { name: 'Roteiro de reels' })).toBeInTheDocument()
  })

  it('na lista, o menu da linha edita (abre o painel) e exclui sem abrir a linha', async () => {
    popular()
    renderizar(<DemandasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Lista' }))
    const tabela = within(screen.getByRole('table', { name: 'Lista de demandas' }))
    fireEvent.click(tabela.getByRole('button', { name: 'Ações de Roteiro de reels' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Demanda excluída.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks.some((t) => t.id === 't1')).toBe(false)

    fireEvent.click(tabela.getByRole('button', { name: 'Ações de Subir campanha' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    expect(await screen.findByRole('dialog', { name: 'Subir campanha' })).toBeInTheDocument()
  })

  it('renomeia uma coluna com dois cliques e guarda o nome no banco', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')

    fireEvent.doubleClick(screen.getByRole('heading', { name: 'A Fazer' }))
    const campo = screen.getByLabelText('Nome da coluna A Fazer')
    fireEvent.change(campo, { target: { value: 'Backlog' } })
    fireEvent.keyDown(campo, { key: 'Enter' })

    expect(await screen.findByText('Coluna renomeada.')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Backlog' })).toBeInTheDocument()
    // Na primeira edição as quatro colunas vão para o banco; o card continua na mesma chave
    expect(bancoFalso().tabelas.board_columns).toHaveLength(4)
    expect(bancoFalso().tabelas.board_columns).toContainEqual(
      expect.objectContaining({ quadro: 'demandas', chave: 'a_fazer', titulo: 'Backlog' }),
    )
    expect(coluna('Backlog').getByText('Roteiro de reels')).toBeInTheDocument()
  })

  it('cria uma coluna nova e remove enquanto está vazia', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')

    fireEvent.click(screen.getByRole('button', { name: 'Nova coluna' }))
    const campo = screen.getByLabelText('Nome da nova coluna')
    fireEvent.change(campo, { target: { value: 'Revisão interna' } })
    fireEvent.submit(campo.closest('form') as HTMLFormElement)

    expect(await screen.findByText('Coluna criada.')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Revisão interna' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remover a coluna Revisão interna' }))
    expect(await screen.findByText('Coluna removida.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Revisão interna' })).not.toBeInTheDocument(),
    )
  })

  it('sem a tabela de colunas no banco, o quadro fica com as colunas fixas e sem edição', async () => {
    popular()
    bancoFalso().tabelasAusentes = ['board_columns']
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
    expect(screen.getByRole('region', { name: 'A Fazer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova coluna' })).not.toBeInTheDocument()
  })

  it('arquiva pelo card e some do quadro', async () => {
    popular()
    renderizar(<DemandasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de Roteiro de reels' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Arquivar' }))

    expect(await screen.findByText('Demanda arquivada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0].status).toBe('arquivado')
    await waitFor(() => expect(screen.queryByText('Roteiro de reels')).not.toBeInTheDocument())
  })

  it('se o banco recusa o arquivamento, avisa e o card volta', async () => {
    popular()
    renderizar(<DemandasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de Roteiro de reels' }))
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.click(screen.getByRole('menuitem', { name: 'Arquivar' }))

    expect(await screen.findByText('Não foi possível mover a demanda.')).toBeInTheDocument()
    expect(await coluna('A Fazer').findByText('Roteiro de reels')).toBeInTheDocument()
  })

  async function excluirPeloMenu(titulo: string) {
    fireEvent.click(await screen.findByRole('button', { name: `Ações de ${titulo}` }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
  }

  it('exclui de vez pelo menu do card, levando as subtarefas e os anexos dele', async () => {
    popular()
    bancoFalso().tabelas.card_subtarefas = [
      { id: 's1', quadro: 'demandas', card_id: 't1', titulo: 'Gravar', feita: false, posicao: 1 },
      { id: 's2', quadro: 'demandas', card_id: 't2', titulo: 'Outra', feita: false, posicao: 1 },
    ]
    bancoFalso().tabelas.card_attachments = [
      { id: 'a1', quadro: 'demandas', card_id: 't1', tipo: 'link', url: 'https://figma.com', nome: 'figma.com' },
    ]
    renderizar(<DemandasPage />)
    await excluirPeloMenu('Roteiro de reels')

    expect(await screen.findByText('Demanda excluída.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Roteiro de reels')).not.toBeInTheDocument())
    expect(bancoFalso().tabelas.tasks.map((t) => t.id)).toEqual(['t2', 't3'])
    expect(bancoFalso().tabelas.card_subtarefas.map((s) => s.id)).toEqual(['s2'])
    expect(bancoFalso().tabelas.card_attachments).toEqual([])
  })

  it('se o banco recusa a exclusão, avisa e o card fica', async () => {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
    bancoFalso().erroEscrita = { message: 'negado' }
    await excluirPeloMenu('Roteiro de reels')

    expect(await screen.findByText('Não foi possível excluir a demanda.')).toBeInTheDocument()
    expect(coluna('A Fazer').getByText('Roteiro de reels')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks).toHaveLength(3)
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
    escolher(painel.getByLabelText('Área'), 'audiovisual')
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
        expect.objectContaining({ acao: 'demanda_concluida', entidade_id: 't1' }),
      ),
    )
  })

  it('desfaz e avisa quando o banco recusa uma edição', async () => {
    const painel = await abrirCard()
    bancoFalso().erroEscrita = { message: 'negado' }
    escolher(painel.getByLabelText('Área'), 'audiovisual')
    expect(await screen.findByText('Não foi possível salvar a demanda.')).toBeInTheDocument()
    await waitFor(() => expect(painel.getByLabelText('Área')).toHaveAttribute('data-valor', 'conteudo'))
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

describe('quadro de Tarefas', () => {
  function popularQuadros() {
    bancoFalso().reiniciar({
      profiles: [perfilDeTeste()],
      clients: [],
      tasks: [
        { id: 't1', titulo: 'Demanda do cliente', status: 'a_fazer', tipo: 'conteudo', quadro: 'demandas', posicao: 1, created_at: '2026-01-01' },
        { id: 't2', titulo: 'Organizar o drive', status: 'a_fazer', tipo: null, quadro: 'tarefas', posicao: 1, created_at: '2026-01-02' },
      ],
    })
  }

  it('Tarefas mostra só as tarefas internas, sem o filtro de área', async () => {
    popularQuadros()
    renderizar(<DemandasPage quadro="tarefas" />)
    expect(await screen.findByRole('button', { name: 'Abrir Organizar o drive' })).toBeInTheDocument()
    expect(screen.queryByText('Demanda do cliente')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Área')).not.toBeInTheDocument()
  })

  it('Demandas não mostra as tarefas internas', async () => {
    popularQuadros()
    renderizar(<DemandasPage />)
    expect(await screen.findByRole('button', { name: 'Abrir Demanda do cliente' })).toBeInTheDocument()
    expect(screen.queryByText('Organizar o drive')).not.toBeInTheDocument()
  })

  it('o painel de uma tarefa interna não tem área', async () => {
    popularQuadros()
    renderizar(<DemandasPage quadro="tarefas" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Organizar o drive' }))
    const painel = within(await screen.findByRole('dialog', { name: 'Organizar o drive' }))
    expect(painel.getByLabelText('Título')).toHaveValue('Organizar o drive')
    expect(painel.queryByLabelText('Área')).not.toBeInTheDocument()
  })

  it('subtarefa e anexo criados no painel de uma tarefa interna ficam no quadro de Tarefas', async () => {
    popularQuadros()
    bancoFalso().tabelas.card_subtarefas = []
    bancoFalso().tabelas.card_attachments = []
    renderizar(<DemandasPage quadro="tarefas" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Organizar o drive' }))
    const painel = within(await screen.findByRole('dialog', { name: 'Organizar o drive' }))

    fireEvent.change(await painel.findByLabelText('Nova subtarefa'), { target: { value: 'Separar pastas' } })
    fireEvent.click(painel.getByRole('button', { name: 'Adicionar' }))
    expect(await painel.findByText('Separar pastas')).toBeInTheDocument()
    expect(bancoFalso().tabelas.card_subtarefas[0]).toMatchObject({ quadro: 'tarefas', card_id: 't2' })

    fireEvent.change(painel.getByLabelText('Link'), { target: { value: 'drive.google.com/pasta' } })
    fireEvent.click(painel.getByRole('button', { name: 'Anexar link' }))
    await waitFor(() =>
      expect(bancoFalso().tabelas.card_attachments[0]).toMatchObject({ quadro: 'tarefas', card_id: 't2' }),
    )
  })

  it('sem a coluna quadro no banco, Tarefas avisa que falta a migration', async () => {
    popularQuadros()
    bancoFalso().colunasAusentes = ['tasks.quadro']
    renderizar(<DemandasPage quadro="tarefas" />)
    expect(await screen.findByText('O quadro de Tarefas liga depois da migration 0004.')).toBeInTheDocument()
  })
})

describe('status do card', () => {
  async function abrirQuadro() {
    popular()
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
  }

  const menu = (titulo: string) => screen.getByLabelText(`Status de ${titulo}`)

  it('marcar como Travado grava no banco e pinta o selo do card', async () => {
    await abrirQuadro()
    expect(menu('Roteiro de reels')).toHaveAttribute('data-valor', '')
    escolher(menu('Roteiro de reels'), 'travado')

    expect(await screen.findByText('Status atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0]).toMatchObject({ situacao: 'travado', status: 'a_fazer' })
    await waitFor(() => expect(menu('Roteiro de reels')).toHaveAttribute('data-valor', 'travado'))
    expect(coluna('A Fazer').getByText('Roteiro de reels')).toBeInTheDocument()
  })

  it('Feito leva o card para a coluna seguinte, onde ele chega sem status', async () => {
    await abrirQuadro()
    escolher(menu('Roteiro de reels'), 'em_andamento')
    await screen.findByText('Status atualizado.')

    escolher(menu('Roteiro de reels'), 'feito')
    expect(await screen.findByText('Demanda movida para Em Andamento.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0]).toMatchObject({ status: 'em_andamento', situacao: null })
    expect(await coluna('Em Andamento').findByText('Roteiro de reels')).toBeInTheDocument()
    expect(menu('Roteiro de reels')).toHaveAttribute('data-valor', '')
  })

  it('na última coluna não há para onde andar: o card fica marcado como Feito', async () => {
    bancoFalso().reiniciar({
      profiles: [perfilDeTeste()],
      tasks: [tarefa({ id: 't9', titulo: 'Entregue', status: 'concluido' })],
    })
    renderizar(<DemandasPage />)
    await screen.findByText('Entregue')
    escolher(menu('Entregue'), 'feito')

    expect(await screen.findByText('Status atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0]).toMatchObject({ status: 'concluido', situacao: 'feito' })
  })

  it('avisa e desfaz quando o banco recusa', async () => {
    await abrirQuadro()
    bancoFalso().erroEscrita = { message: 'negado' }
    escolher(menu('Roteiro de reels'), 'travado')
    expect(await screen.findByText('Não foi possível atualizar o status.')).toBeInTheDocument()
    await waitFor(() => expect(menu('Roteiro de reels')).toHaveAttribute('data-valor', ''))
  })

  it('sem a coluna no banco, só Feito funciona, e ele move o card do mesmo jeito', async () => {
    popular()
    bancoFalso().colunasAusentes = ['tasks.situacao']
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')

    fireEvent.click(menu('Roteiro de reels'))
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Travado' })).toHaveAttribute('aria-disabled', 'true'),
    )
    expect(screen.getByRole('option', { name: 'Feito' })).not.toHaveAttribute('aria-disabled')

    fireEvent.click(screen.getByRole('option', { name: 'Feito' }))
    expect(await screen.findByText('Demanda movida para Em Andamento.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0]).not.toHaveProperty('situacao')
  })
})

describe('anexos do card', () => {
  const ANEXOS = [
    { id: 'a1', quadro: 'demandas', card_id: 't1', tipo: 'link', url: 'https://www.figma.com/file/abc', nome: null, created_at: '2026-10-01T10:00:00Z' },
    { id: 'a2', quadro: 'demandas', card_id: 't1', tipo: 'imagem', url: 'https://falso.test/anexos/demandas/t1/ref.png', nome: 'ref.png', created_at: '2026-10-01T11:00:00Z' },
    // Mesmo id de card em outro quadro: não é desta demanda
    { id: 'a3', quadro: 'conteudo', card_id: 't1', tipo: 'link', url: 'https://outro.com', nome: null, created_at: '2026-10-01T12:00:00Z' },
  ]

  async function abrirQuadro(anexos: object[] = ANEXOS) {
    popular()
    bancoFalso().tabelas.card_attachments = structuredClone(anexos) as never
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
  }

  async function abrirAnexos(titulo = 'Roteiro de reels') {
    fireEvent.click(await screen.findByRole('button', { name: `Anexar em ${titulo}` }))
    return within(screen.getByRole('dialog', { name: `Anexos de ${titulo}` }))
  }

  it('mostra as miniaturas no rodapé do card, cada uma abrindo o anexo', async () => {
    await abrirQuadro()
    const link = await screen.findByRole('link', { name: 'Abrir anexo figma.com' })
    expect(link).toHaveAttribute('href', 'https://www.figma.com/file/abc')
    expect(link).toHaveAttribute('target', '_blank')
    const imagem = screen.getByRole('link', { name: 'Abrir anexo ref.png' })
    expect(imagem.querySelector('img')).toHaveAttribute('src', ANEXOS[1].url)
    expect(screen.queryByRole('link', { name: 'Abrir anexo outro.com' })).not.toBeInTheDocument()
  })

  it('anexa um link digitado, completando o https', async () => {
    await abrirQuadro([])
    const modal = await abrirAnexos()
    expect(modal.getByText('Nenhum anexo ainda.')).toBeInTheDocument()
    fireEvent.change(modal.getByLabelText('Link'), { target: { value: 'drive.google.com/pasta' } })
    fireEvent.click(modal.getByRole('button', { name: 'Anexar link' }))

    expect(await screen.findByText('Link anexado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.card_attachments).toEqual([
      expect.objectContaining({
        quadro: 'demandas',
        card_id: 't1',
        tipo: 'link',
        url: 'https://drive.google.com/pasta',
        created_by: 'u1',
      }),
    ])
    expect(await screen.findByRole('link', { name: 'Abrir anexo drive.google.com' })).toBeInTheDocument()
  })

  it('recusa o que não é link', async () => {
    await abrirQuadro([])
    const modal = await abrirAnexos()
    fireEvent.change(modal.getByLabelText('Link'), { target: { value: 'não é link' } })
    fireEvent.click(modal.getByRole('button', { name: 'Anexar link' }))
    expect(await modal.findByText('Informe um link válido.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.card_attachments).toHaveLength(0)
  })

  it('envia a imagem para o Storage, na pasta do card, e guarda a URL', async () => {
    await abrirQuadro([])
    const modal = await abrirAnexos()
    const imagem = new File(['x'], 'layout.png', { type: 'image/png' })
    fireEvent.change(modal.getByLabelText('Enviar imagem'), { target: { files: [imagem] } })

    expect(await screen.findByText('Imagem anexada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.card_attachments[0]).toMatchObject({ tipo: 'imagem', nome: 'layout.png' })
    expect(bancoFalso().tabelas.card_attachments[0].url).toMatch(
      /^https:\/\/falso\.test\/anexos\/demandas\/t1\//,
    )
  })

  it('recusa arquivo que não é imagem ou é grande demais', async () => {
    await abrirQuadro([])
    const modal = await abrirAnexos()
    const pdf = new File(['x'], 'contrato.pdf', { type: 'application/pdf' })
    fireEvent.change(modal.getByLabelText('Enviar imagem'), { target: { files: [pdf] } })
    expect(await screen.findByText('Envie uma imagem PNG, JPG, WEBP ou SVG.')).toBeInTheDocument()

    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' })
    fireEvent.change(modal.getByLabelText('Enviar imagem'), { target: { files: [grande] } })
    expect(await screen.findByText('A imagem deve ter no máximo 5 MB.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.card_attachments).toHaveLength(0)
  })

  it('remove um anexo', async () => {
    await abrirQuadro()
    const modal = await abrirAnexos()
    fireEvent.click(modal.getByRole('button', { name: 'Remover anexo figma.com' }))
    expect(await screen.findByText('Anexo removido.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.card_attachments.map((a) => a.id)).toEqual(['a2', 'a3'])
  })

  it('o painel da demanda também mostra e recebe anexos', async () => {
    await abrirQuadro()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Roteiro de reels' }))
    const painel = within(await screen.findByRole('dialog', { name: 'Roteiro de reels' }))
    const anexos = within(painel.getByRole('region', { name: 'Anexos' }))
    expect(anexos.getByText('figma.com')).toBeInTheDocument()
    expect(anexos.getByText('ref.png')).toBeInTheDocument()
  })

  it('sem as tabelas da migration, não oferece anexos e avisa a liderança do que falta', async () => {
    popular()
    bancoFalso().tabelasAusentes = ['board_columns', 'card_attachments']
    renderizar(<DemandasPage />)
    await screen.findByText('Roteiro de reels')
    expect(await screen.findByRole('note')).toHaveTextContent('0003_revisao.sql')
    expect(screen.queryByRole('button', { name: /^Anexar em/ })).not.toBeInTheDocument()
  })

  it('quem não é da liderança não vê o aviso da migration', async () => {
    popular()
    bancoFalso().tabelasAusentes = ['board_columns', 'card_attachments']
    renderizar(<DemandasPage />, { cargo: 'Designer' })
    await screen.findByText('Roteiro de reels')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
