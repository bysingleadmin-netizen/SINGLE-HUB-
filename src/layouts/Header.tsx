import { useLocation } from 'react-router-dom'
import { Icone } from '@/components/ui/Icone'
import { tituloDaRota } from './navegacao'
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
    </header>
  )
}
