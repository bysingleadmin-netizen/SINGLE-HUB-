import { fireEvent, render, screen } from '@testing-library/react'
import { AreaTexto } from './AreaTexto'
import { Drawer } from './Drawer'
import { EstadoErro, EstadoVazio } from './Estado'
import { KpiCard } from './KpiCard'
import { Modal } from './Modal'
import { Painel } from './Painel'
import { Pill } from './Pill'
import { Selecao } from './Selecao'

describe('Modal', () => {
  it('não aparece fechado', () => {
    render(
      <Modal aberto={false} titulo="Novo cliente" onFechar={() => {}}>
        conteúdo
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('aberto é um diálogo com o título como nome', () => {
    render(
      <Modal aberto titulo="Novo cliente" onFechar={() => {}}>
        conteúdo
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Novo cliente' })).toHaveTextContent('conteúdo')
  })

  it('fecha com Escape, no botão e ao clicar fora, mas não ao clicar dentro', () => {
    const onFechar = vi.fn()
    render(
      <Modal aberto titulo="Novo cliente" onFechar={onFechar}>
        <p>conteúdo</p>
      </Modal>,
    )
    fireEvent.click(screen.getByText('conteúdo'))
    expect(onFechar).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.mouseDown(screen.getByTestId('sobreposicao-fundo'))
    expect(onFechar).toHaveBeenCalledTimes(3)
  })

  it('leva o foco para o diálogo ao abrir, sem tirar do campo que pediu foco', () => {
    const { unmount } = render(
      <Modal aberto titulo="Aviso" onFechar={() => {}}>
        texto
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveFocus()
    unmount()

    render(
      <Modal aberto titulo="Novo cliente" onFechar={() => {}}>
        <input aria-label="Nome" autoFocus />
      </Modal>,
    )
    expect(screen.getByLabelText('Nome')).toHaveFocus()
  })

  it('Escape fecha só a camada de cima quando há um modal sobre um drawer', () => {
    const fecharDrawer = vi.fn()
    const fecharModal = vi.fn()
    render(
      <>
        <Drawer aberto titulo="Cliente" onFechar={fecharDrawer}>
          detalhe
        </Drawer>
        <Modal aberto titulo="Editar" onFechar={fecharModal}>
          formulário
        </Modal>
      </>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(fecharModal).toHaveBeenCalledTimes(1)
    expect(fecharDrawer).not.toHaveBeenCalled()
  })
})

describe('Drawer', () => {
  it('é um diálogo com o título como nome', () => {
    render(
      <Drawer aberto titulo="Padaria Sol" onFechar={() => {}}>
        detalhe
      </Drawer>,
    )
    expect(screen.getByRole('dialog', { name: 'Padaria Sol' })).toHaveTextContent('detalhe')
  })
})

describe('Estado', () => {
  it('erro oferece tentar de novo', () => {
    const onTentar = vi.fn()
    render(<EstadoErro onTentar={onTentar} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os dados.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onTentar).toHaveBeenCalledTimes(1)
  })

  it('vazio mostra título, texto e a ação', () => {
    render(
      <EstadoVazio
        titulo="Nenhum cliente ainda"
        texto="Cadastre o primeiro."
        acao={<button>Novo cliente</button>}
      />,
    )
    expect(screen.getByText('Nenhum cliente ainda')).toBeInTheDocument()
    expect(screen.getByTestId('ilustracao')).toBeInTheDocument()
    expect(screen.getByText('Cadastre o primeiro.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo cliente' })).toBeInTheDocument()
  })
})

describe('campos', () => {
  const OPCOES = [
    { valor: 'ativo', rotulo: 'Ativo' },
    { valor: 'pausado', rotulo: 'Pausado' },
  ]

  it('Selecao liga o rótulo ao campo e avisa a troca', () => {
    const onChange = vi.fn()
    render(<Selecao rotulo="Status" opcoes={OPCOES} value="ativo" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pausado' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('Selecao aceita uma opção vazia', () => {
    render(<Selecao rotulo="Cliente" opcoes={OPCOES} vazio="Sem cliente" value="" onChange={() => {}} />)
    expect(screen.getByRole('option', { name: 'Sem cliente' })).toHaveValue('')
  })

  it('AreaTexto liga o rótulo ao campo', () => {
    render(<AreaTexto rotulo="Observações" defaultValue="Prefere WhatsApp" />)
    expect(screen.getByLabelText('Observações')).toHaveValue('Prefere WhatsApp')
  })
})

describe('KpiCard, Pill e Painel', () => {
  it('KpiCard mostra rótulo e valor formatado', () => {
    render(<KpiCard rotulo="MRR total" valor={4000.5} formatar={(n) => `R$ ${n.toFixed(2)}`} />)
    expect(screen.getByText('MRR total')).toBeInTheDocument()
    expect(screen.getByText('R$ 4000.50')).toBeInTheDocument()
  })

  it('KpiCard não mostra número enquanto carrega', () => {
    render(<KpiCard rotulo="Clientes ativos" valor={0} carregando />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('Pill carrega o tom', () => {
    render(<Pill tom="verde">Ativo</Pill>)
    expect(screen.getByText('Ativo')).toHaveAttribute('data-tom', 'verde')
  })

  it('Painel é uma região com o título como nome', () => {
    render(
      <Painel titulo="Atividade recente" acao={<button>Ver tudo</button>}>
        lista
      </Painel>,
    )
    expect(screen.getByRole('region', { name: 'Atividade recente' })).toHaveTextContent('lista')
    expect(screen.getByRole('button', { name: 'Ver tudo' })).toBeInTheDocument()
  })
})
