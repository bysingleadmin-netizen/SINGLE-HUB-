import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icone } from './Icone'
import styles from './ui.module.css'

// Camadas abertas, da mais antiga para a mais nova. Escape fecha só a última.
const pilha: string[] = []

export interface SobreposicaoProps {
  aberto: boolean
  titulo: string
  onFechar: () => void
  children: ReactNode
  /** Botões fixos no pé da camada */
  rodape?: ReactNode
}

/** Base do Modal e do Drawer: fundo escuro, foco, Escape e clique fora. */
export function Sobreposicao({
  aberto,
  titulo,
  onFechar,
  children,
  rodape,
  variante,
}: SobreposicaoProps & { variante: 'modal' | 'drawer' }) {
  const id = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  // Guardado ainda na renderização: depois dela, um campo com autoFocus já teria levado o foco
  const focoAnterior = useRef<Element | null>(null)
  if (aberto && !focoAnterior.current) focoAnterior.current = document.activeElement

  useEffect(() => {
    if (!aberto) return
    pilha.push(id)
    if (!caixa.current?.contains(document.activeElement)) caixa.current?.focus()

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && pilha[pilha.length - 1] === id) {
        evento.stopImmediatePropagation()
        fechar.current()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      pilha.splice(pilha.indexOf(id), 1)
      if (focoAnterior.current instanceof HTMLElement) focoAnterior.current.focus()
      focoAnterior.current = null
    }
  }, [aberto, id])

  if (!aberto) return null

  return createPortal(
    <div
      className={`${styles.fundo} ${styles[`fundo_${variante}`]}`}
      data-testid="sobreposicao-fundo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onFechar()
      }}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        tabIndex={-1}
        className={`${styles.camada} ${styles[`camada_${variante}`]}`}
      >
        <header className={styles.camadaTopo}>
          <h2 id={`${id}-titulo`} className={styles.camadaTitulo}>
            {titulo}
          </h2>
          <button type="button" className={styles.botaoIcone} aria-label="Fechar" onClick={onFechar}>
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>
        <div className={styles.camadaCorpo}>{children}</div>
        {rodape && <footer className={styles.camadaRodape}>{rodape}</footer>}
      </div>
    </div>,
    document.body,
  )
}
