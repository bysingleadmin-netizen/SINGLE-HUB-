vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { hojeISO } from '@/lib/datas'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { CalendarioPage } from './CalendarioPage'
import { mesDe, mesVizinho, nomeDoDia, nomeDoMes } from './calendario'

const HOJE = hojeISO()
const MES = mesDe(HOJE)
/** Um dia fixo do mês corrente, para os testes não dependerem de que dia é hoje */
const DIA_10 = `${HOJE.slice(0, 8)}10`
const DIA_11 = `${HOJE.slice(0, 8)}11`
const DIA_12 = `${HOJE.slice(0, 8)}12`

function local(iso: string, hora: number, minuto = 0): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString()
}

function popular() {
  bancoFalso().reiniciar({
    profiles: [
      perfilDeTeste(),
      { ...perfilDeTeste('Designer'), id: 'u2', nome: 'Bia Souza', email: 'bia@single.com' },
      { ...perfilDeTeste('Copywriter'), id: 'u3', nome: 'Caio Lima', email: 'caio@single.com' },
    ],
    clients: [{ id: 'c1', nome: 'Padaria Sol', status: 'ativo', mrr: 1500, created_at: '2026-01-01' }],
    calendar_events: [
      {
        id: 'e1',
        titulo: 'Reunião de pauta',
        descricao: null,
        tipo: 'reuniao',
        data_inicio: local(DIA_10, 14),
        data_fim: local(DIA_10, 15),
        dia_inteiro: false,
        client_id: 'c1',
        created_by: 'u1',
        created_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'e2',
        titulo: 'Gravação externa',
        descricao: null,
        tipo: 'gravacao',
        data_inicio: local(DIA_10, 0),
        data_fim: local(DIA_11, 23, 59),
        dia_inteiro: true,
        client_id: null,
        created_by: 'u1',
        created_at: '2026-10-02T00:00:00Z',
      },
    ],
    event_participants: [{ event_id: 'e1', profile_id: 'u2' }],
    tasks: [
      { id: 't1', titulo: 'Entregar roteiro', status: 'em_andamento', tipo: 'conteudo', client_id: 'c1', responsavel_id: null, data_entrega: DIA_12, posicao: 1, created_at: '2026-10-01' },
      { id: 't2', titulo: 'Demanda arquivada', status: 'arquivado', tipo: 'conteudo', client_id: null, responsavel_id: null, data_entrega: DIA_12, posicao: 1, created_at: '2026-10-02' },
      { id: 't3', titulo: 'Demanda sem data', status: 'a_fazer', tipo: 'conteudo', client_id: null, responsavel_id: null, data_entrega: null, posicao: 2, created_at: '2026-10-03' },
    ],
    content_cards: [
      { id: 'k1', titulo: 'Publicar carrossel', tipo_conteudo: 'carrossel', etapa: 'publicado', client_id: null, responsavel_id: null, data_entrega: DIA_12, posicao: 1, created_at: '2026-10-01' },
    ],
  })
}

function dia(iso: string) {
  return screen.getByRole('button', { name: new RegExp(`^${nomeDoDia(iso)}`) })
}

describe('CalendarioPage', () => {
  it('sem eventos mostra o mês atual, os dias da semana e o aviso de vazio', async () => {
    bancoFalso().reiniciar()
    renderizar(<CalendarioPage />)

    expect(await screen.findByText('Nada marcado neste mês.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: nomeDoMes(MES.ano, MES.mes) })).toBeInTheDocument()
    for (const nome of ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']) {
      expect(screen.getByText(nome)).toBeInTheDocument()
    }
    expect(dia(HOJE)).toHaveAttribute('aria-current', 'date')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mostra os eventos como chips nos dias, e o de vários dias em todos eles', async () => {
    popular()
    renderizar(<CalendarioPage />)
    await screen.findAllByText('Gravação externa')

    expect(dia(DIA_10)).toHaveAccessibleName(`${nomeDoDia(DIA_10)}, 2 itens`)
    expect(within(dia(DIA_10)).getByText('Reunião de pauta')).toHaveAttribute('data-tom', 'azul')
    expect(within(dia(DIA_10)).getByText('Gravação externa')).toHaveAttribute('data-tom', 'roxo')
    expect(dia(DIA_11)).toHaveAccessibleName(`${nomeDoDia(DIA_11)}, 1 item`)
    expect(within(dia(DIA_11)).getByText('Gravação externa')).toBeInTheDocument()
  })

  it('clicar no dia abre o painel com horário, cliente e participantes', async () => {
    popular()
    renderizar(<CalendarioPage />)
    await screen.findAllByText('Gravação externa')
    fireEvent.click(dia(DIA_10))

    const painel = within(screen.getByRole('dialog', { name: nomeDoDia(DIA_10) }))
    expect(painel.getByText('14:00 às 15:00')).toBeInTheDocument()
    expect(painel.getByText('Dia inteiro')).toBeInTheDocument()
    expect(painel.getByText(/Padaria Sol/)).toBeInTheDocument()
    expect(painel.getByText(/Bia Souza/)).toBeInTheDocument()
    expect(painel.getByText('Reunião')).toBeInTheDocument()
  })

  it('demandas e conteúdos com data de entrega aparecem sozinhos no dia', async () => {
    popular()
    renderizar(<CalendarioPage />)
    await screen.findAllByText('Gravação externa')

    expect(dia(DIA_12)).toHaveAccessibleName(`${nomeDoDia(DIA_12)}, 2 itens`)
    expect(within(dia(DIA_12)).getByText('Entregar roteiro')).toHaveAttribute('data-tom', 'vermelho')
    expect(within(dia(DIA_12)).getByText('Publicar carrossel')).toHaveAttribute('data-concluido')
    expect(screen.queryByText('Demanda arquivada')).not.toBeInTheDocument()
    expect(screen.queryByText('Demanda sem data')).not.toBeInTheDocument()
    // Nada foi copiado para a tabela de eventos
    expect(bancoFalso().tabelas.calendar_events).toHaveLength(2)
  })

  it('no painel do dia, a entrega leva à demanda e não pode ser excluída por ali', async () => {
    popular()
    renderizar(<CalendarioPage />)
    await screen.findAllByText('Gravação externa')
    fireEvent.click(dia(DIA_12))

    const painel = within(screen.getByRole('dialog', { name: nomeDoDia(DIA_12) }))
    expect(painel.getByRole('link', { name: 'Entregar roteiro' })).toHaveAttribute(
      'href',
      '/app/demandas?abrir=t1',
    )
    expect(painel.getByRole('link', { name: 'Publicar carrossel' })).toHaveAttribute(
      'href',
      '/app/conteudo?abrir=k1',
    )
    expect(painel.getByText('Demanda')).toBeInTheDocument()
    expect(painel.getByText(/Padaria Sol/)).toBeInTheDocument()
    expect(painel.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument()
  })

  it('dia sem eventos abre o painel vazio com a ação de criar', async () => {
    popular()
    renderizar(<CalendarioPage />)
    await screen.findAllByText('Gravação externa')
    fireEvent.click(dia(`${HOJE.slice(0, 8)}20`))
    const painel = within(screen.getByRole('dialog'))
    expect(painel.getByText('Nada marcado neste dia.')).toBeInTheDocument()
    expect(painel.getByRole('button', { name: 'Novo evento neste dia' })).toBeInTheDocument()
  })

  it('cria evento com participantes escolhidos pelo nome e avisa cada um', async () => {
    popular()
    renderizar(<CalendarioPage />)
    await screen.findAllByText('Gravação externa')
    fireEvent.click(screen.getByRole('button', { name: 'Novo evento' }))

    const modal = within(screen.getByRole('dialog', { name: 'Novo evento' }))
    fireEvent.change(modal.getByLabelText('Título'), { target: { value: 'Alinhamento mensal' } })
    fireEvent.change(modal.getByLabelText('Tipo'), { target: { value: 'entrega' } })
    fireEvent.change(modal.getByLabelText('Data'), { target: { value: DIA_11 } })
    fireEvent.change(modal.getByLabelText('Início'), { target: { value: '10:00' } })
    fireEvent.change(modal.getByLabelText('Cliente'), { target: { value: 'c1' } })

    fireEvent.change(modal.getByLabelText('Participantes'), { target: { value: 'bia' } })
    expect(modal.queryByRole('option', { name: /Caio Lima/ })).not.toBeInTheDocument()
    fireEvent.click(modal.getByRole('option', { name: /Bia Souza/ }))
    fireEvent.change(modal.getByLabelText('Participantes'), { target: { value: 'caio' } })
    fireEvent.click(modal.getByRole('option', { name: /Caio Lima/ }))
    fireEvent.click(modal.getByRole('button', { name: 'Remover Caio Lima' }))
    fireEvent.click(modal.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Evento criado.')).toBeInTheDocument()
    const criado = bancoFalso().tabelas.calendar_events[2]
    expect(criado).toMatchObject({
      titulo: 'Alinhamento mensal',
      tipo: 'entrega',
      data_inicio: local(DIA_11, 10),
      dia_inteiro: false,
      client_id: 'c1',
      created_by: 'u1',
    })
    expect(bancoFalso().tabelas.event_participants).toContainEqual(
      expect.objectContaining({ event_id: criado.id, profile_id: 'u2' }),
    )
    expect(bancoFalso().tabelas.event_participants).toHaveLength(2)
    await waitFor(() =>
      expect(bancoFalso().tabelas.notifications).toEqual([
        expect.objectContaining({
          user_id: 'u2',
          tipo: 'evento',
          link: `/app/calendario?dia=${DIA_11}`,
        }),
      ]),
    )
    expect(await within(dia(DIA_11)).findByText('Alinhamento mensal')).toHaveAttribute(
      'data-tom',
      'vermelho',
    )
  })

  it('marcar dia inteiro troca os campos de hora pela data de fim', async () => {
    bancoFalso().reiniciar()
    renderizar(<CalendarioPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo evento' }))
    const modal = within(screen.getByRole('dialog', { name: 'Novo evento' }))
    expect(modal.getByLabelText('Início')).toBeInTheDocument()
    fireEvent.click(modal.getByLabelText('Dia inteiro'))
    expect(modal.queryByLabelText('Início')).not.toBeInTheDocument()
    expect(modal.getByLabelText('Até')).toBeInTheDocument()
  })

  it('não salva sem título', async () => {
    bancoFalso().reiniciar()
    renderizar(<CalendarioPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo evento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Informe o título do evento.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.calendar_events ?? []).toHaveLength(0)
  })

  it('avisa quando o banco recusa o evento', async () => {
    bancoFalso().reiniciar()
    renderizar(<CalendarioPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo evento' }))
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Reunião' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Não foi possível criar o evento.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo evento' })).toBeInTheDocument()
  })

  it('anda entre os meses e volta para hoje', async () => {
    bancoFalso().reiniciar()
    renderizar(<CalendarioPage />)
    await screen.findByText('Nada marcado neste mês.')
    const proximo = mesVizinho(MES, 1)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(
      screen.getByRole('heading', { name: nomeDoMes(proximo.ano, proximo.mes) }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(screen.getByRole('heading', { name: nomeDoMes(MES.ano, MES.mes) })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    const anterior = mesVizinho(MES, -1)
    expect(
      screen.getByRole('heading', { name: nomeDoMes(anterior.ano, anterior.mes) }),
    ).toBeInTheDocument()
  })

  it('abre direto no dia pedido pelo endereço', async () => {
    popular()
    renderizar(<CalendarioPage />, { rota: `/app/calendario?dia=${DIA_10}` })
    expect(await screen.findByRole('dialog', { name: nomeDoDia(DIA_10) })).toBeInTheDocument()
  })

  it('exclui um evento pelo painel do dia', async () => {
    popular()
    renderizar(<CalendarioPage />)
    await screen.findAllByText('Gravação externa')
    fireEvent.click(dia(DIA_10))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Reunião de pauta' }))
    expect(await screen.findByText('Evento excluído.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.calendar_events.map((e) => e.id)).toEqual(['e2'])
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    bancoFalso().reiniciar()
    bancoFalso().erroLeitura = { message: 'sem rede' }
    renderizar(<CalendarioPage />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nada marcado neste mês.')).toBeInTheDocument()
  })
})
