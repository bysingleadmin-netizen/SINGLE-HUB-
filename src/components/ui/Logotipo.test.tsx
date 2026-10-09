import { render, screen } from '@testing-library/react'
import { Logotipo } from './Logotipo'

describe('Logotipo', () => {
  it('é uma imagem vetorial chamada SINGLE, sem depender de texto', () => {
    render(<Logotipo />)
    const logo = screen.getByRole('img', { name: 'SINGLE' })
    expect(logo.querySelectorAll('svg')).toHaveLength(2)
    expect(logo).toHaveTextContent('')
  })

  it('tem uma cor só: nenhuma letra recebe destaque próprio', () => {
    render(<Logotipo />)
    for (const parte of screen.getByRole('img', { name: 'SINGLE' }).querySelectorAll('svg')) {
      expect(parte).not.toHaveAttribute('class')
      expect(parte).toHaveAttribute('fill', 'currentColor')
    }
  })

  it('usa a altura pedida nas duas partes', () => {
    render(<Logotipo altura={24} />)
    const partes = screen.getByRole('img', { name: 'SINGLE' }).querySelectorAll('svg')
    expect(partes[0]).toHaveAttribute('height', '24')
    expect(partes[1]).toHaveAttribute('height', '24')
  })

  it('deixa quem usa esconder o restante do nome, mantendo a inicial', () => {
    render(<Logotipo classeDoRestante="some-quando-recolhe" />)
    const logo = screen.getByRole('img', { name: 'SINGLE' })
    const escondivel = logo.querySelector('.some-quando-recolhe')
    expect(escondivel?.querySelector('svg')).not.toBeNull()
    expect(logo.querySelector('svg')?.closest('.some-quando-recolhe')).toBeNull()
  })
})
