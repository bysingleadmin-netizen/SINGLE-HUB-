import { Navigate, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from './AuthContext'
import styles from './auth.module.css'

export function RotaProtegida() {
  const { sessao, perfil, carregando, sair } = useAuth()

  if (carregando) {
    return (
      <div className={styles.tela} aria-busy="true" aria-label="Carregando">
        <div className={styles.carregando}>
          <Skeleton largura="140px" altura="28px" />
          <Skeleton altura="14px" />
          <Skeleton largura="70%" altura="14px" />
        </div>
      </div>
    )
  }

  if (!sessao) return <Navigate to="/login" replace />

  if (!perfil) {
    return (
      <div className={styles.tela}>
        <div className={`${styles.cartao} fade-up`}>
          <h1 className={styles.titulo}>Não encontramos seu perfil</h1>
          <p className={styles.texto}>
            Sua conta existe, mas o perfil não pôde ser carregado. Tente entrar de novo. Se o
            problema continuar, peça para a liderança verificar seu cadastro.
          </p>
          <Button variante="secundario" onClick={() => void sair()}>
            Sair
          </Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
