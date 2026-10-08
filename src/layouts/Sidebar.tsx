import { NavLink } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Icone } from '@/components/ui/Icone'
import { useAuth } from '@/features/auth/AuthContext'
import { itensVisiveis } from './navegacao'
import styles from './layout.module.css'

interface SidebarProps {
  colapsada: boolean
  onAlternar: () => void
  abertaMobile: boolean
  onFecharMobile: () => void
}

export function Sidebar({ colapsada, onAlternar, abertaMobile, onFecharMobile }: SidebarProps) {
  const { perfil, sair } = useAuth()
  const itens = itensVisiveis(perfil?.cargo)

  return (
    <aside
      className={styles.sidebar}
      data-colapsada={colapsada || undefined}
      data-aberta={abertaMobile || undefined}
    >
      <div className={styles.topo}>
        <span className={styles.logo} aria-label="SINGLE">
          <span className={styles.logoLetra}>S</span>
          <span className={styles.rotulo}>INGLE</span>
        </span>
        <button
          type="button"
          className={styles.botaoIcone}
          data-alternar
          aria-label={colapsada ? 'Expandir menu' : 'Recolher menu'}
          onClick={onAlternar}
        >
          <Icone nome={colapsada ? 'expandir' : 'recolher'} tamanho={18} />
        </button>
      </div>

      <nav className={`${styles.nav} stagger`} aria-label="Principal">
        {itens.map((item) => (
          <NavLink
            key={item.rota}
            to={item.rota}
            className={({ isActive }) =>
              isActive ? `${styles.item} ${styles.itemAtivo}` : styles.item
            }
            title={colapsada ? item.rotulo : undefined}
            onClick={onFecharMobile}
          >
            <Icone nome={item.icone} />
            <span className={styles.rotulo}>{item.rotulo}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.rodape}>
        <Avatar nome={perfil?.nome ?? null} url={perfil?.avatar_url} tamanho={36} />
        <div className={`${styles.usuario} ${styles.rotulo}`}>
          <span className={styles.usuarioNome}>{perfil?.nome}</span>
          <span className={styles.usuarioCargo}>{perfil?.cargo}</span>
        </div>
        <button
          type="button"
          className={`${styles.botaoIcone} ${styles.botaoSair}`}
          aria-label="Sair"
          title="Sair"
          onClick={() => void sair()}
        >
          <Icone nome="sair" tamanho={18} />
        </button>
      </div>
    </aside>
  )
}
