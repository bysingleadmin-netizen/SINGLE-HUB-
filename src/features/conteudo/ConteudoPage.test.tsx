vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { ConteudoPage } from './ConteudoPage'

function card(parcial: Record<string, unknown>) {
  return {
    tipo_conteudo: 'post',
    client_id: null,
    responsavel_id: null,
    etapa: 'captar_material',
    data_entrega: null,
    observacoes: null,
    posicao: 1,
    created_at: '2026-10-01T00:00:00Z',
    ...parcial,
  }
}

function popular() {
  bancoFalso().reiniciar({
    profiles: [perfilDeTeste()],
    clients: [{ id: 'c1', nome: 'Padaria Sol', status: 'ativo', mrr: 1500, created_at: '2026-01-01' }],
    content_cards: [
      card({ id: 'k1', titulo: 'Reels de lançamento', tipo_conteudo: 'reels', client_id: 'c1' }),
      card({ id: 'k2', titulo: 'Carrossel de dicas', tipo_conteudo: 'carrossel', etapa: 'editar' }),
      card({ id: 'k3', titulo: 'Post antigo', etapa: 'arquivado' }),
    ],
  })
}

function coluna(nome: string) {
  return within(screen.getByRole('region', { name: nome }))
}

describe('ConteudoPage', () => {
  it('sem conteúdos mostra o quadro vazio com as quatro etapas e a ação de criar', async () => {
    bancoFalso().reiniciar()
    renderizar(<ConteudoPage />)

    expect(await screen.findByText('Nenhum conteúdo ainda.')).toBeInTheDocument()
    for (const nome of ['Captar Material', 'Editar', 'Aguardando Aprovação', 'Publicado']) {
      expect(screen.getByRole('region', { name: nome })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'Arquivado' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar em Captar Material' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('distribui os cards por etapa e esconde os arquivados', async () => {
    popular()
    renderizar(<ConteudoPage />)
    await screen.findByText('Reels de lançamento')

    const captar = coluna('Captar Material')
    expect(captar.getByText('Reels')).toBeInTheDocument()
    expect(captar.getByText('Padaria Sol')).toBeInTheDocument()
    expect(captar.getByText('Sem responsável')).toBeInTheDocument()
    expect(coluna('Editar').getByText('Carrossel de dicas')).toBeInTheDocument()
    expect(coluna('Editar').getByText('Sem cliente')).toBeInTheDocument()
    expect(screen.queryByText('Post antigo')).not.toBeInTheDocument()
  })

  it('cria o conteúdo na etapa escolhida e registra a atividade', async () => {
    popular()
    renderizar(<ConteudoPage />)
    await screen.findByText('Reels de lançamento')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar em Editar' }))

    const modal = within(screen.getByRole('dialog', { name: 'Nova tarefa' }))
    expect(modal.getByLabelText('Etapa')).toHaveValue('editar')
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Stories de bastidores' } })
    fireEvent.change(modal.getByLabelText('Tipo de conteúdo'), { target: { value: 'stories' } })
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Conteúdo criado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards[3]).toMatchObject({
      titulo: 'Stories de bastidores',
      tipo_conteudo: 'stories',
      etapa: 'editar',
      posicao: 2,
    })
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'conteudo_criado' }),
      ),
    )
  })

  it('filtra por tipo de conteúdo e por responsável', async () => {
    popular()
    renderizar(<ConteudoPage />)
    await screen.findByText('Reels de lançamento')

    fireEvent.change(screen.getByLabelText('Tipo de conteúdo'), { target: { value: 'carrossel' } })
    expect(screen.queryByText('Reels de lançamento')).not.toBeInTheDocument()
    expect(screen.getByText('Carrossel de dicas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Luan Uliana, CEO' }))
    expect(screen.getByText('Nenhum conteúdo com esses filtros.')).toBeInTheDocument()
  })

  it('a tela não tem botão próprio de criar: só o + das etapas e o Criar do topo', async () => {
    popular()
    renderizar(<ConteudoPage />)
    await screen.findByText('Reels de lançamento')
    expect(screen.queryByRole('button', { name: 'Novo conteúdo' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Adicionar em/ })).toHaveLength(4)
  })

  it('não salva sem título', async () => {
    bancoFalso().reiniciar()
    renderizar(<ConteudoPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar em Captar Material' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Informe o título do conteúdo.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards ?? []).toHaveLength(0)
  })

  async function abrirCard() {
    popular()
    renderizar(<ConteudoPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Reels de lançamento' }))
    return within(await screen.findByRole('dialog', { name: 'Reels de lançamento' }))
  }

  it('clicar no card abre o painel lateral com os dados, sem botão de salvar', async () => {
    const painel = await abrirCard()
    expect(painel.getByLabelText('Título')).toHaveValue('Reels de lançamento')
    expect(painel.getByLabelText('Cliente')).toHaveValue('c1')
    expect(painel.getByLabelText('Tipo de conteúdo')).toHaveValue('reels')
    expect(painel.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('publicar pelo painel move o card e registra a publicação', async () => {
    const painel = await abrirCard()
    fireEvent.change(painel.getByLabelText('Etapa'), { target: { value: 'publicado' } })

    expect(await screen.findByText('Conteúdo publicado.')).toBeInTheDocument()
    expect(await coluna('Publicado').findByText('Reels de lançamento')).toBeInTheDocument()
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'conteudo_publicado', entidade_id: 'k1' }),
      ),
    )
  })

  it('salva observações ao sair do campo e seleções na hora', async () => {
    const painel = await abrirCard()
    const observacoes = painel.getByLabelText('Observações')
    fireEvent.change(observacoes, { target: { value: 'Usar a trilha nova' } })
    fireEvent.blur(observacoes)
    expect(await screen.findByText('Conteúdo atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards[0].observacoes).toBe('Usar a trilha nova')

    fireEvent.change(painel.getByLabelText('Tipo de conteúdo'), { target: { value: 'video' } })
    await waitFor(() => expect(bancoFalso().tabelas.content_cards[0].tipo_conteudo).toBe('video'))
  })

  it('não aceita título em branco', async () => {
    const painel = await abrirCard()
    const titulo = painel.getByLabelText('Título')
    fireEvent.change(titulo, { target: { value: '' } })
    fireEvent.blur(titulo)
    expect(await painel.findByText('Informe o título do conteúdo.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards[0].titulo).toBe('Reels de lançamento')
  })

  it('abre direto o conteúdo pedido pelo endereço', async () => {
    popular()
    renderizar(<ConteudoPage />, { rota: '/app/conteudo?abrir=k2' })
    expect(await screen.findByRole('dialog', { name: 'Carrossel de dicas' })).toBeInTheDocument()
  })

  it('arquiva pelo card e some do quadro', async () => {
    popular()
    renderizar(<ConteudoPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar Carrossel de dicas' }))

    expect(await screen.findByText('Conteúdo arquivado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards[1].etapa).toBe('arquivado')
    await waitFor(() => expect(screen.queryByText('Carrossel de dicas')).not.toBeInTheDocument())
  })

  it('se o banco recusa o arquivamento, avisa e o card volta', async () => {
    popular()
    renderizar(<ConteudoPage />)
    const botao = await screen.findByRole('button', { name: 'Arquivar Carrossel de dicas' })
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.click(botao)

    expect(await screen.findByText('Não foi possível mover o conteúdo.')).toBeInTheDocument()
    expect(await coluna('Editar').findByText('Carrossel de dicas')).toBeInTheDocument()
  })

  it('marcar Feito no painel leva o card para a etapa seguinte, sem status', async () => {
    const painel = await abrirCard()
    fireEvent.change(await painel.findByLabelText('Status do card'), { target: { value: 'feito' } })

    await waitFor(() =>
      expect(bancoFalso().tabelas.content_cards[0]).toMatchObject({ etapa: 'editar', situacao: null }),
    )
  })

  it('subtarefas: cria, marca e mostra o andamento no card, sem mover o card', async () => {
    const painel = await abrirCard()
    const bloco = within(await painel.findByRole('region', { name: 'Subtarefas' }))
    fireEvent.change(bloco.getByLabelText('Nova subtarefa'), { target: { value: 'Gravar cenas' } })
    fireEvent.click(bloco.getByRole('button', { name: 'Adicionar' }))
    fireEvent.click(await bloco.findByLabelText('Gravar cenas'))

    expect(await bloco.findByText('Todas as subtarefas concluídas')).toBeInTheDocument()
    expect(bancoFalso().tabelas.card_subtarefas[0]).toMatchObject({
      quadro: 'conteudo',
      card_id: 'k1',
      concluida: true,
    })
    expect(await screen.findByText('1/1')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards[0].etapa).toBe('captar_material')

    fireEvent.click(bloco.getByRole('button', { name: 'Remover subtarefa Gravar cenas' }))
    await waitFor(() => expect(bancoFalso().tabelas.card_subtarefas).toHaveLength(0))
  })

  it('renomeia e cria tipos de conteúdo pela engrenagem', async () => {
    const painel = await abrirCard()
    fireEvent.click(await painel.findByRole('button', { name: 'Configurar tipos de conteúdo' }))
    const modal = within(await screen.findByRole('dialog', { name: 'Configurar tipos de conteúdo' }))

    const nome = modal.getByLabelText('Nome de Reels')
    fireEvent.change(nome, { target: { value: 'Reel curto' } })
    fireEvent.blur(nome)
    expect(await screen.findByText('Opção renomeada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.card_options).toContainEqual(
      expect.objectContaining({ campo: 'tipo_conteudo', chave: 'reels', titulo: 'Reel curto' }),
    )
    // Renomear não toca no card: ele continua gravado com a chave
    expect(bancoFalso().tabelas.content_cards[0].tipo_conteudo).toBe('reels')

    fireEvent.change(modal.getByLabelText('Nome da nova opção'), { target: { value: 'Podcast' } })
    fireEvent.click(modal.getByRole('button', { name: 'Criar' }))
    expect(await screen.findByText('Opção criada.')).toBeInTheDocument()
    expect(await modal.findByLabelText('Nome de Podcast')).toBeInTheDocument()
    expect(modal.getByRole('button', { name: 'Remover Podcast' })).toBeInTheDocument()
  })

  it('escolhe a cor de um status pela engrenagem e o selo do card usa a cor', async () => {
    const painel = await abrirCard()
    fireEvent.click(await painel.findByRole('button', { name: 'Configurar status' }))
    const modal = within(await screen.findByRole('dialog', { name: 'Configurar status' }))
    fireEvent.change(await modal.findByLabelText('Cor de Travado'), { target: { value: '#123456' } })
    await waitFor(() =>
      expect(bancoFalso().tabelas.card_options).toContainEqual(
        expect.objectContaining({ campo: 'situacao', chave: 'travado', cor: '#123456' }),
      ),
    )
    // As outras opções vão para o banco com a cor de fábrica em branco
    expect(bancoFalso().tabelas.card_options).toContainEqual(
      expect.objectContaining({ campo: 'situacao', chave: 'feito', cor: null }),
    )
  })

  it('sem as tabelas novas, o painel abre sem subtarefas e sem engrenagens', async () => {
    popular()
    bancoFalso().tabelasAusentes = ['card_subtarefas', 'card_options']
    renderizar(<ConteudoPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Reels de lançamento' }))
    const painel = within(await screen.findByRole('dialog', { name: 'Reels de lançamento' }))

    expect(painel.getByLabelText('Tipo de conteúdo')).toHaveValue('reels')
    expect(painel.queryByRole('region', { name: 'Subtarefas' })).not.toBeInTheDocument()
    expect(painel.queryByRole('button', { name: /^Configurar/ })).not.toBeInTheDocument()
  })

  it('publicar grava a data de conclusão', async () => {
    const painel = await abrirCard()
    fireEvent.change(painel.getByLabelText('Etapa'), { target: { value: 'publicado' } })

    expect(await screen.findByText('Conteúdo publicado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.content_cards[0]).toMatchObject({
      etapa: 'publicado',
      concluded_at: expect.any(String),
      archived_at: null,
    })
  })

  it('publicado há mais de 7 dias sai do quadro e aparece em Arquivados, com o prazo de exclusão', async () => {
    popular()
    bancoFalso().tabelas.content_cards.push(
      card({
        id: 'k4',
        titulo: 'Campanha de inverno',
        etapa: 'publicado',
        concluded_at: new Date(Date.now() - 8 * 86_400_000).toISOString(),
      }),
    )
    renderizar(<ConteudoPage />)
    expect(await screen.findByText('Reels de lançamento')).toBeInTheDocument()
    expect(screen.queryByText('Campanha de inverno')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Mostrar arquivados/ }))
    const arquivados = within(screen.getByRole('region', { name: 'Arquivados' }))
    expect(arquivados.getByText('Campanha de inverno')).toBeInTheDocument()
    expect(arquivados.getByText('Em 29 dias')).toBeInTheDocument()
  })

  it('restaurar devolve o card arquivado para a primeira etapa', async () => {
    popular()
    renderizar(<ConteudoPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Mostrar arquivados/ }))
    const arquivados = within(screen.getByRole('region', { name: 'Arquivados' }))
    fireEvent.click(await arquivados.findByRole('button', { name: 'Restaurar Post antigo' }))

    await waitFor(() =>
      expect(bancoFalso().tabelas.content_cards[2]).toMatchObject({
        etapa: 'captar_material',
        archived_at: null,
      }),
    )
    expect(await coluna('Captar Material').findByText('Post antigo')).toBeInTheDocument()
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    bancoFalso().reiniciar()
    bancoFalso().erroLeitura = { message: 'sem rede' }
    renderizar(<ConteudoPage />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhum conteúdo ainda.')).toBeInTheDocument()
  })
})
