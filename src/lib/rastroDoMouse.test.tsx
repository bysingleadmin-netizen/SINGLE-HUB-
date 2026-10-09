import { fireEvent, render, waitFor } from '@testing-library/react'
import { useRastroDoMouse } from './rastroDoMouse'

function Tela() {
  useRastroDoMouse()
  return null
}

describe('useRastroDoMouse', () => {
  it('guarda a posição do cursor em variáveis de estilo do body', async () => {
    render(<Tela />)
    fireEvent.mouseMove(document, { clientX: 120, clientY: 340 })
    await waitFor(() => {
      expect(document.body.style.getPropertyValue('--mouse-x')).toBe('120px')
      expect(document.body.style.getPropertyValue('--mouse-y')).toBe('340px')
    })
  })

  it('não cria nenhum elemento na página: o efeito é só fundo do body', async () => {
    const antes = document.body.querySelectorAll('*').length
    render(<Tela />)
    fireEvent.mouseMove(document, { clientX: 50, clientY: 60 })
    await waitFor(() => expect(document.body.style.getPropertyValue('--mouse-x')).toBe('50px'))
    expect(document.body.querySelectorAll('*').length - antes).toBeLessThanOrEqual(1)
    expect(document.body.querySelector('canvas, [class*="glow"], [class*="rastro"]')).toBeNull()
  })

  it('para de acompanhar quando a tela sai', async () => {
    const { unmount } = render(<Tela />)
    fireEvent.mouseMove(document, { clientX: 10, clientY: 10 })
    await waitFor(() => expect(document.body.style.getPropertyValue('--mouse-x')).toBe('10px'))
    unmount()
    fireEvent.mouseMove(document, { clientX: 999, clientY: 999 })
    await new Promise((resolver) => setTimeout(resolver, 40))
    expect(document.body.style.getPropertyValue('--mouse-x')).toBe('10px')
  })
})
