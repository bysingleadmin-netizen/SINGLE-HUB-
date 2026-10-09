import { useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import styles from './ui.module.css'

interface AreaTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rotulo: string
}

export function AreaTexto({ rotulo, id, className, rows = 4, ...resto }: AreaTextoProps) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  return (
    <div className={[styles.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={idCampo} className={styles.campoRotulo}>
        {rotulo}
      </label>
      <textarea
        id={idCampo}
        rows={rows}
        className={`${styles.campoInput} ${styles.campoArea}`}
        {...resto}
      />
    </div>
  )
}
