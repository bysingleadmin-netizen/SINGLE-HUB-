import type { ReactNode } from 'react'
import type { Tom } from '@/lib/rotulos'
import styles from './ui.module.css'

export function Pill({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <span className={styles.pill} data-tom={tom}>
      {children}
    </span>
  )
}
