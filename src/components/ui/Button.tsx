import type { ButtonHTMLAttributes } from 'react'
import styles from './ui.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'fantasma'
  carregando?: boolean
}

export function Button({
  variante = 'primario',
  carregando = false,
  disabled,
  className,
  children,
  type = 'button',
  ...resto
}: ButtonProps) {
  const classes = [styles.botao, styles[`botao_${variante}`], className].filter(Boolean).join(' ')
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  )
}
