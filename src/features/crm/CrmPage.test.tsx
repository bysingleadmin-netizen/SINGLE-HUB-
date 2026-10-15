vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

// O Quadro de verdade usa arraste; aqui cada card ganha um botão por coluna de destino
vi.mock('@/components/quadro/Quadro', () => ({
  Quadro: (props: {
    colunas: { id: string; titulo: string }[]
    itens: { id: string }[]
    tituloDe: (item: unknown) => string
    renderCard: (item: unknown) => React.ReactNode
    renderRodape?: (item: unknown) => React.ReactNode
    onMover: (item: unknown, coluna: string) => void
    onAbrir: (item: unknown) => void
  }) => (
    <div>
      {props.colunas.map((c) => <h2 key={c.id}>{c.titulo}</h2>)}
      {props.itens.map((item) => (
        <div key={item.id}>
          {props.renderCard(item)}
          {props.renderRodape?.(item)}
          <button onClick={() => props.onAbrir(item)}>{`Abrir ${props.tituloDe(item)}`}</button>
          {props.colunas.map((c) => (
            <button key={c.id} onClick={() => props.onMover(item, c.id)}>
              {`Mover ${props.tituloDe(item)} para ${c.titulo}`}
            </button>
          ))}
        </div>
      ))}
    </div>
  ),
}))

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { escolher } from '@/test/escolher'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { CrmPage } from './CrmPage'

const LEAD = {
  id: 'l1', nome: 'Ana', empresa: 'Scofield', telefone: '(27) 99999-0000', origem: 'Instagram',
  etapa: 'fechamento', etapa_desde: new Date().toISOString(), posicao: 1, convertido_em: null,
  client_id: null, created_by: 'u1', created_at: new Date().toISOString(),
}

function popular() {
  bancoFalso().reiniciar({ profiles: [perfilDeTeste()], clients: [], leads: [LEAD], lead_historico: [] })
  bancoFalso().rpcs.converter_lead = (args, banco) => {
    banco.tabelas.clients.push({ id: 'novo-cliente', nome: args.p_nome, mrr: args.p_mrr, contrato_meses: args.p_meses })
    const lead = banco.tabelas.leads.find((l) => l.id === args.p_lead_id)!
    lead.convertido_em = new Date().toISOString()
    lead.client_id = 'novo-cliente'
    return 'novo-cliente'
  }
}

describe('CrmPage', () => {
  it('mostra as quatro colunas e o card com WhatsApp, origem e tempo na etapa', async () => {
    popular()
    renderizar(<CrmPage />)
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    const colunas = ['Leads', 'Reunião', 'Fechamento de contrato', 'Cliente']
    expect(screen.getAllByRole('heading').map((h) => h.textContent).filter((t) => colunas.includes(t ?? ''))).toEqual(colunas)
    expect(screen.getByRole('link', { name: 'WhatsApp de Ana' })).toHaveAttribute('href', 'https://wa.me/5527999990000')
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('Na etapa desde hoje')).toBeInTheDocument()
  })

  it('soltar em Cliente pede os dados antes; cancelar não muda nada', async () => {
    popular()
    renderizar(<CrmPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mover Ana para Cliente' }))
    const modal = within(screen.getByRole('dialog', { name: 'Converter em cliente' }))
    expect(modal.getByLabelText('Nome do cliente')).toHaveValue('Scofield')
    fireEvent.click(modal.getByRole('button', { name: 'Cancelar' }))
    expect(bancoFalso().tabelas.leads[0]).toMatchObject({ etapa: 'fechamento', convertido_em: null })
    expect(bancoFalso().tabelas.clients).toHaveLength(0)
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('não converte sem todos os campos; com eles, cria o cliente e tira o lead do quadro', async () => {
    popular()
    renderizar(<CrmPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mover Ana para Cliente' }))
    const modal = within(screen.getByRole('dialog', { name: 'Converter em cliente' }))
    fireEvent.click(modal.getByRole('button', { name: 'Converter' }))
    expect(await modal.findByText('Informe um valor como 1.500,00.')).toBeInTheDocument()
    expect(bancoFalso().funcoesChamadas).toHaveLength(0)

    fireEvent.change(modal.getByLabelText('Valor mensal (MRR)'), { target: { value: '2.870,00' } })
    fireEvent.change(modal.getByLabelText('Duração do contrato'), { target: { value: '12' } })
    fireEvent.click(modal.getByRole('button', { name: 'Converter' }))
    await waitFor(() => expect(bancoFalso().tabelas.clients[0]).toMatchObject({ nome: 'Scofield', mrr: 2870, contrato_meses: 12 }))
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument())
  })

  it('se a conversão falhar, o lead fica e a pessoa é avisada', async () => {
    popular()
    bancoFalso().erroDaFuncao = { message: 'falhou' }
    renderizar(<CrmPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mover Ana para Cliente' }))
    const modal = within(screen.getByRole('dialog', { name: 'Converter em cliente' }))
    fireEvent.change(modal.getByLabelText('Valor mensal (MRR)'), { target: { value: '2.870,00' } })
    fireEvent.change(modal.getByLabelText('Duração do contrato'), { target: { value: '12' } })
    fireEvent.click(modal.getByRole('button', { name: 'Converter' }))
    expect(await screen.findByText('Não foi possível converter o lead.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.leads[0].convertido_em).toBeNull()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('mover entre etapas grava a etapa, a data e o histórico', async () => {
    popular()
    renderizar(<CrmPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mover Ana para Reunião' }))
    await waitFor(() => expect(bancoFalso().tabelas.leads[0].etapa).toBe('reuniao'))
    expect(bancoFalso().tabelas.lead_historico[0]).toMatchObject({ lead_id: 'l1', etapa_de: 'fechamento', etapa_para: 'reuniao' })
  })

  it('sem a tabela de leads, avisa que falta a migration', async () => {
    popular()
    bancoFalso().tabelasAusentes = ['leads']
    renderizar(<CrmPage />)
    expect(await screen.findByText('O CRM liga depois da migration 0004.')).toBeInTheDocument()
  })

  it('clicar no lead abre o painel; cada campo do perfil salva sozinho', async () => {
    popular()
    renderizar(<CrmPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Ana' }))
    const painel = within(await screen.findByRole('dialog', { name: 'Ana' }))

    const segmento = await painel.findByLabelText('Segmento')
    fireEvent.change(segmento, { target: { value: 'Arquitetura' } })
    fireEvent.blur(segmento)
    await waitFor(() => expect(bancoFalso().tabelas.leads[0]).toMatchObject({ segmento: 'Arquitetura' }))

    escolher(painel.getByLabelText('Temperatura'), 'quente')
    await waitFor(() => expect(bancoFalso().tabelas.leads[0]).toMatchObject({ temperatura: 'quente' }))
    // O card do quadro mostra a temperatura quando não é fria
    expect(await screen.findAllByText('Quente')).not.toHaveLength(0)

    const observacoes = painel.getByLabelText('Observações')
    fireEvent.change(observacoes, { target: { value: 'Quer começar em janeiro' } })
    fireEvent.blur(observacoes)
    await waitFor(() => expect(bancoFalso().tabelas.leads[0]).toMatchObject({ observacoes: 'Quer começar em janeiro' }))
    for (const rotulo of ['Telefone', 'Instagram', 'Cidade', 'Faturamento médio', 'Tamanho da equipe']) {
      expect(painel.getByLabelText(rotulo)).toBeInTheDocument()
    }
  })

  it('o nome não fica em branco', async () => {
    popular()
    renderizar(<CrmPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Ana' }))
    const painel = within(await screen.findByRole('dialog', { name: 'Ana' }))
    const nome = painel.getByLabelText('Nome')
    fireEvent.change(nome, { target: { value: '  ' } })
    fireEvent.blur(nome)
    expect(await painel.findByText('Informe o nome do lead.')).toBeInTheDocument()
    expect(nome).toHaveValue('Ana')
    expect(bancoFalso().tabelas.leads[0].nome).toBe('Ana')
  })

  it('sem a migration 0008, o painel mostra só o que o banco tem', async () => {
    popular()
    bancoFalso().colunasAusentes = ['leads.temperatura']
    renderizar(<CrmPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Ana' }))
    const painel = within(await screen.findByRole('dialog', { name: 'Ana' }))
    expect(await painel.findByLabelText('Telefone')).toBeInTheDocument()
    expect(painel.queryByLabelText('Segmento')).not.toBeInTheDocument()
    expect(painel.queryByLabelText('Temperatura')).not.toBeInTheDocument()
  })

  it('acima do quadro, o funil por temperatura e a rosca de segmentos', async () => {
    popular()
    bancoFalso().tabelas.leads = [
      { ...LEAD, temperatura: 'quente', segmento: 'Arquitetura' },
      { ...LEAD, id: 'l2', nome: 'Bruno', etapa: 'leads', temperatura: 'frio', segmento: 'Arquitetura' },
      { ...LEAD, id: 'l3', nome: 'Carla', etapa: 'leads', temperatura: 'morno', segmento: null },
    ]
    renderizar(<CrmPage />)
    const funil = within(await screen.findByRole('figure', { name: 'Leads de cada etapa por temperatura' }))
    expect(funil.getByRole('listitem', { name: 'Leads: Quente 0, Morno 1, Frio 1' })).toBeInTheDocument()
    expect(funil.getByRole('listitem', { name: 'Fechamento de contrato: Quente 1, Morno 0, Frio 0' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Leads por segmento: Arquitetura 2, Outros 1' })).toBeInTheDocument()
  })

  it('sem a migration 0008, os gráficos não aparecem', async () => {
    popular()
    bancoFalso().colunasAusentes = ['leads.temperatura']
    renderizar(<CrmPage />)
    await screen.findByText('Ana')
    await waitFor(() => expect(screen.queryByRole('figure')).not.toBeInTheDocument())
    expect(screen.queryByRole('img', { name: /^Leads por segmento/ })).not.toBeInTheDocument()
  })
})
