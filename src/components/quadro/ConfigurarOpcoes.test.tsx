import { fireEvent, render, screen, within } from '@testing-library/react'
import { ConfigurarOpcoes } from './ConfigurarOpcoes'
import type { EdicaoDeOpcoes, OpcaoDeCampo } from '@/dados/opcoes'

const AREAS: OpcaoDeCampo[] = [
  { valor: 'trafego', rotulo: 'Tráfego', tom: 'vermelho' },
  { valor: 'personalizada_1', rotulo: 'Social Media', tom: 'cinza', personalizada: true },
]

function abrir(edicao: Partial<EdicaoDeOpcoes>, emUso = (valor: string) => (valor === 'trafego' ? 3 : 0)) {
  const completa: EdicaoDeOpcoes = { renomear: vi.fn(), criar: vi.fn(), remover: vi.fn(), ...edicao }
  render(
    <ConfigurarOpcoes campo="áreas" opcoes={AREAS} edicao={completa} emUso={emUso} unidade={['demanda', 'demandas']} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Configurar áreas' }))
  return { edicao: completa, modal: within(screen.getByRole('dialog', { name: 'Configurar áreas' })) }
}

describe('ConfigurarOpcoes', () => {
  it('área em uso pede confirmação antes de remover', () => {
    const { edicao, modal } = abrir({ ocultar: true })
    fireEvent.click(modal.getByRole('button', { name: 'Remover Tráfego' }))
    expect(edicao.remover).not.toHaveBeenCalled()
    expect(modal.getByRole('alert')).toHaveTextContent('3 demandas usam Tráfego')
    fireEvent.click(modal.getByRole('button', { name: 'Remover mesmo assim' }))
    expect(edicao.remover).toHaveBeenCalledWith('trafego')
  })

  it('área sem uso sai direto', () => {
    const { edicao, modal } = abrir({ ocultar: true })
    fireEvent.click(modal.getByRole('button', { name: 'Remover Social Media' }))
    expect(edicao.remover).toHaveBeenCalledWith('personalizada_1')
  })

  it('sem ocultar no banco, as de fábrica não podem sair', () => {
    const { modal } = abrir({})
    expect(modal.queryByRole('button', { name: 'Remover Tráfego' })).not.toBeInTheDocument()
    expect(modal.getByRole('button', { name: 'Remover Social Media' })).toBeInTheDocument()
  })

  it('cria e renomeia', () => {
    const { edicao, modal } = abrir({ ocultar: true })
    fireEvent.change(modal.getByLabelText('Nome da nova opção'), { target: { value: 'Design' } })
    fireEvent.click(modal.getByRole('button', { name: 'Criar' }))
    expect(edicao.criar).toHaveBeenCalledWith('Design')
    const nome = modal.getByLabelText('Nome de Tráfego')
    fireEvent.change(nome, { target: { value: 'Mídia paga' } })
    fireEvent.blur(nome)
    expect(edicao.renomear).toHaveBeenCalledWith('trafego', 'Mídia paga')
  })
})
