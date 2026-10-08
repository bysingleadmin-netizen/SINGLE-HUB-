import { useState } from 'react'
import { iniciais } from '@/lib/formato'
import styles from './ui.module.css'

interface AvatarProps {
  nome: string | null
  url?: string | null
  tamanho?: number
}

export function Avatar({ nome, url, tamanho = 36 }: AvatarProps) {
  const [falhou, setFalhou] = useState(false)
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) }

  if (url && !falhou) {
    return (
      <img
        src={url}
        alt={nome ?? ''}
        className={styles.avatar}
        style={estilo}
        onError={() => setFalhou(true)}
      />
    )
  }

  return (
    <span className={styles.avatar} style={estilo} aria-hidden="true">
      {iniciais(nome)}
    </span>
  )
}
