import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import styles from './ui.module.css'

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string
  erro?: string
}

export function Campo({ rotulo, erro, id, className, ...resto }: CampoProps) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idErro = `${idCampo}-erro`
  return (
    <div className={[styles.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={idCampo} className={styles.campoRotulo}>
        {rotulo}
      </label>
      <input
        id={idCampo}
        className={styles.campoInput}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        {...resto}
      />
      {erro && (
        <p id={idErro} className={styles.campoErro}>
          {erro}
        </p>
      )}
    </div>
  )
}
