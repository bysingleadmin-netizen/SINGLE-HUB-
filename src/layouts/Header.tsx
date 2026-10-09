import { useLocation } from 'react-router-dom'
import { Icone } from '@/components/ui/Icone'
import { BotaoCriar } from '@/features/criar/BotaoCriar'
import { BuscaGlobal } from './BuscaGlobal'
import { tituloDaRota } from './navegacao'
import { Sino } from './Sino'
import styles from './layout.module.css'

interface HeaderProps {
  onAbrirMenu: () => void
}

export function Header({ onAbrirMenu }: HeaderProps) {
  const { pathname } = useLocation()

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={`${styles.botaoIcone} ${styles.botaoMenu}`}
        aria-label="Abrir menu"
        onClick={onAbrirMenu}
      >
        <Icone nome="menu" />
      </button>
      <h1 className={styles.tituloPagina}>{tituloDaRota(pathname)}</h1>
      <div className={styles.headerAcoes}>
        <BuscaGlobal />
        <BotaoCriar />
        <Sino />
      </div>
    </header>
  )
}
