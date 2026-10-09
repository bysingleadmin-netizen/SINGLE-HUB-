import { useEffect } from 'react'

/**
 * Publica a posição do cursor em `--mouse-x` e `--mouse-y` no body.
 * O brilho que segue o mouse é desenhado pelo CSS a partir dessas variáveis.
 */
export function useRastroDoMouse() {
  useEffect(() => {
    // Quem pediu menos movimento fica com o fundo parado
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    let quadro = 0
    let x = 0
    let y = 0

    function aoMover(evento: MouseEvent) {
      x = evento.clientX
      y = evento.clientY
      // No máximo uma escrita de estilo por quadro
      if (quadro) return
      quadro = requestAnimationFrame(() => {
        quadro = 0
        document.body.style.setProperty('--mouse-x', `${x}px`)
        document.body.style.setProperty('--mouse-y', `${y}px`)
      })
    }

    document.addEventListener('mousemove', aoMover, { passive: true })
    return () => {
      document.removeEventListener('mousemove', aoMover)
      cancelAnimationFrame(quadro)
    }
  }, [])
}
