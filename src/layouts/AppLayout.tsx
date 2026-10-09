import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAvisarPrazosDeAmanha } from '@/dados/notificacoes'
import { CriacaoProvider } from '@/features/criar/CriacaoProvider'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import styles from './layout.module.css'

const CHAVE_COLAPSADA = 'single:sidebar-colapsada'

function lerColapsada(): boolean {
  try {
    return localStorage.getItem(CHAVE_COLAPSADA) === '1'
  } catch {
    return false
  }
}

export function AppLayout() {
  const { pathname } = useLocation()
  const [colapsada, setColapsada] = useState(lerColapsada)
  const [menuAberto, setMenuAberto] = useState(false)
  useAvisarPrazosDeAmanha()

  const alternar = useCallback(() => {
    setColapsada((atual) => {
      const nova = !atual
      try {
        localStorage.setItem(CHAVE_COLAPSADA, nova ? '1' : '0')
      } catch {
        // preferência não salva; o menu continua funcionando
      }
      return nova
    })
  }, [])

  const fecharMenu = useCallback(() => setMenuAberto(false), [])

  useEffect(() => {
    if (!menuAberto) return
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setMenuAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [menuAberto])

  return (
    <CriacaoProvider>
      <div className={styles.shell} data-colapsada={colapsada || undefined}>
        <Sidebar
          colapsada={colapsada}
          onAlternar={alternar}
          abertaMobile={menuAberto}
          onFecharMobile={fecharMenu}
        />
        {menuAberto && <div className={styles.fundo} onClick={fecharMenu} aria-hidden="true" />}
        <div className={styles.conteudo}>
          <Header onAbrirMenu={() => setMenuAberto(true)} />
          {/* key reinicia a animação de entrada a cada troca de tela, mas não de aba ou subrota */}
          <main
            key={pathname.split('/').slice(0, 3).join('/')}
            className={`${styles.principal} fade-up`}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </CriacaoProvider>
  )
}
