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
  }) => (
    <div>
      {props.colunas.map((c) => <h2 key={c.id}>{c.titulo}</h2>)}
      {props.itens.map((item) => (
        <div key={item.id}>
          {props.renderCard(item)}
          {props.renderRodape?.(item)}
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
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Leads', 'Reunião', 'Fechamento de contrato', 'Cliente'])
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
})
