import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject, SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'

interface FlutuanteProps {
  /** Elemento ao qual a caixa se prende, alinhada pela borda direita dele */
  ancora: RefObject<HTMLElement | null>
  onFechar: () => void
  className?: string
  children: ReactNode
}

// Dentro de um card arrastável, mexer na caixa não pode começar um arraste
const naoArrastar = (evento: SyntheticEvent) => evento.stopPropagation()

/**
 * Caixa presa a um botão (menu de ações, confirmação), desenhada fora da página (portal) para
 * a rolagem de tabelas e painéis não cortá-la. Fecha com clique fora e com Escape.
 */
export function Flutuante({ ancora, onFechar, className, children }: FlutuanteProps) {
  const caixa = useRef<HTMLDivElement>(null)
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  const [posicao, setPosicao] = useState<CSSProperties>({ visibility: 'hidden' })

  // Abaixo do botão, alinhada à direita dele; sem espaço embaixo, acima
  useLayoutEffect(() => {
    function posicionar() {
      const alvo = ancora.current?.getBoundingClientRect()
      if (!alvo) return
      const altura = caixa.current?.offsetHeight ?? 0
      const direita = Math.max(8, window.innerWidth - alvo.right)
      const cabeEmbaixo = window.innerHeight - alvo.bottom >= altura + 12
      setPosicao(
        cabeEmbaixo || alvo.top < altura + 12
          ? { top: alvo.bottom + 6, right: direita }
          : { bottom: window.innerHeight - alvo.top + 6, right: direita },
      )
    }
    posicionar()
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', posicionar, true)
    return () => {
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', posicionar, true)
    }
  }, [ancora])

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node
      if (!caixa.current?.contains(alvo) && !ancora.current?.contains(alvo)) fechar.current()
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar.current()
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [ancora])

  return createPortal(
    <div
      ref={caixa}
      className={className}
      style={{ position: 'fixed', zIndex: 200, ...posicao }}
      onMouseDown={naoArrastar}
      onTouchStart={naoArrastar}
      onPointerDown={naoArrastar}
      // O clique dentro da caixa não chega ao item embaixo dela (linha que abre a tarefa)
      onClick={naoArrastar}
    >
      {children}
    </div>,
    document.body,
  )
}
