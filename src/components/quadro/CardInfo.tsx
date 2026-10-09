import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { formatarData } from '@/lib/formato'
import type { SituacaoDoPrazo } from '@/lib/regras'
import type { Client, Profile } from '@/types/database'
import styles from './quadro.module.css'

interface CardInfoProps {
  titulo: string
  /** Pill com o tipo da demanda ou do conteúdo */
  etiqueta: ReactNode
  cliente: Client | undefined
  responsavel: Profile | undefined
  dataEntrega: string | null
  /** Define a cor do indicador de prazo; null deixa neutro */
  prazo: SituacaoDoPrazo | null
}

/** Miolo dos cards de Demandas e de Conteúdo. */
export function CardInfo({
  titulo,
  etiqueta,
  cliente,
  responsavel,
  dataEntrega,
  prazo,
}: CardInfoProps) {
  return (
    <span className={styles.info}>
      <span className={styles.infoTopo}>{etiqueta}</span>
      <span className={styles.infoTitulo}>{titulo}</span>
      <span className={styles.infoCliente}>
        <Avatar nome={cliente?.nome ?? null} url={cliente?.logo_url} tamanho={18} />
        <span className={styles.infoTexto}>{cliente?.nome ?? 'Sem cliente'}</span>
      </span>
      <span className={styles.infoLinha}>
        <Avatar nome={responsavel?.nome ?? null} url={responsavel?.avatar_url} tamanho={22} />
        <span className={styles.infoTexto}>{responsavel?.nome ?? 'Sem responsável'}</span>
        <span className={styles.infoPrazo} data-prazo={prazo ?? undefined}>
          {dataEntrega ? formatarData(dataEntrega) : 'Sem data'}
        </span>
      </span>
    </span>
  )
}
