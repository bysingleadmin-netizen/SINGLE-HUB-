import { useId } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import styles from './ui.module.css'

interface AbasProps<T extends string> {
  /** Nome do conjunto para leitores de tela, como "Seções do cliente" */
  rotulo: string
  abas: readonly { id: T; rotulo: string }[]
  ativa: T
  onMudar: (id: T) => void
  /** Conteúdo da aba ativa */
  children: ReactNode
}

/** Abas com o painel da aba ativa. Setas esquerda e direita trocam de aba. */
export function Abas<T extends string>({ rotulo, abas, ativa, onMudar, children }: AbasProps<T>) {
  const base = useId()

  function aoTeclar(evento: KeyboardEvent) {
    const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0
    if (passo === 0) return
    evento.preventDefault()
    const atual = abas.findIndex((aba) => aba.id === ativa)
    const proxima = abas[(atual + passo + abas.length) % abas.length]
    onMudar(proxima.id)
    document.getElementById(`${base}-aba-${proxima.id}`)?.focus()
  }

  return (
    <>
      <div role="tablist" aria-label={rotulo} className={styles.abas} onKeyDown={aoTeclar}>
        {abas.map((aba) => (
          <button
            key={aba.id}
            type="button"
            role="tab"
            id={`${base}-aba-${aba.id}`}
            aria-selected={aba.id === ativa}
            aria-controls={`${base}-painel`}
            tabIndex={aba.id === ativa ? 0 : -1}
            className={styles.aba}
            onClick={() => onMudar(aba.id)}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${base}-painel`}
        aria-labelledby={`${base}-aba-${ativa}`}
        className={`${styles.abaPainel} fade-up`}
        key={ativa}
      >
        {children}
      </div>
    </>
  )
}
