import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { formatarData } from '@/lib/formato'
import type { Client, Profile } from '@/types/database'
import styles from './quadro.module.css'

interface CardInfoProps {
  titulo: string
  /** Pill com o tipo da demanda ou do conteúdo */
  etiqueta: ReactNode
  cliente: Client | undefined
  responsavel: Profile | undefined
  dataEntrega: string | null
  atrasado?: boolean
}

/** Miolo dos cards de Demandas e de Conteúdo. */
export function CardInfo({
  titulo,
  etiqueta,
  cliente,
  responsavel,
  dataEntrega,
  atrasado = false,
}: CardInfoProps) {
  return (
    <span className={styles.info}>
      <span className={styles.infoTopo}>{etiqueta}</span>
      <span className={styles.infoTitulo}>{titulo}</span>
      <span className={styles.infoLinha}>
        <Avatar nome={cliente?.nome ?? null} url={cliente?.logo_url} tamanho={20} />
        <span className={styles.infoTexto}>{cliente?.nome ?? 'Sem cliente'}</span>
      </span>
      <span className={styles.infoLinha}>
        <Avatar nome={responsavel?.nome ?? null} url={responsavel?.avatar_url} tamanho={20} />
        <span className={styles.infoTexto}>{responsavel?.nome ?? 'Sem responsável'}</span>
        <span className={styles.infoData} data-atrasado={atrasado || undefined}>
          {dataEntrega ? formatarData(dataEntrega) : 'Sem data'}
        </span>
      </span>
    </span>
  )
}
