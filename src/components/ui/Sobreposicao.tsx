import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icone } from './Icone'
import styles from './ui.module.css'

// Camadas abertas, da mais antiga para a mais nova. Escape fecha só a última.
const pilha: string[] = []

/** Tempo da animação de saída (ui.module.css: .fundo[data-saindo]) */
const SAIDA_MS: Record<'modal' | 'drawer', number> = { modal: 150, drawer: 280 }

function animacaoLigada(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

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
  const [saindo, setSaindo] = useState(false)
  const avisar = useRef(onFechar)
  avisar.current = onFechar
  // Fechar toca a animação de saída e só então avisa quem abriu; sem animação, avisa na hora
  const fechar = useRef(() => {})
  fechar.current = () => {
    if (saindo) return
    if (!animacaoLigada()) {
      avisar.current()
      return
    }
    setSaindo(true)
    window.setTimeout(() => avisar.current(), SAIDA_MS[variante])
  }
  const pedirFechar = useCallback(() => fechar.current(), [])
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
      data-saindo={saindo || undefined}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) pedirFechar()
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
          <button type="button" className={styles.botaoIcone} aria-label="Fechar" onClick={pedirFechar}>
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
