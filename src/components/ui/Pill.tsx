import type { CSSProperties, ReactNode } from 'react'
import type { Tom } from '@/lib/rotulos'
import styles from './ui.module.css'

/** `cor` (#rrggbb) vence o tom: é a cor que a equipe escolheu para a opção. */
export function Pill({ tom, cor, children }: { tom: Tom; cor?: string; children: ReactNode }) {
  return (
    <span
      className={styles.pill}
      data-tom={tom}
      style={cor ? ({ '--tom': cor } as CSSProperties) : undefined}
    >
      {children}
    </span>
  )
}
