import { useId } from 'react'
import type { ReactNode } from 'react'
import styles from './ui.module.css'

interface PainelProps {
  titulo: string
  /** Botão ou link à direita do título */
  acao?: ReactNode
  children: ReactNode
}

export function Painel({ titulo, acao, children }: PainelProps) {
  const id = useId()
  return (
    <section className={styles.painel} aria-labelledby={id}>
      <header className={styles.painelTopo}>
        <h2 id={id} className={styles.painelTitulo}>
          {titulo}
        </h2>
        {acao}
      </header>
      {children}
    </section>
  )
}
