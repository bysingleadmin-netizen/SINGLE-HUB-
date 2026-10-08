import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { isLideranca } from '@/lib/permissoes'
import { useAuth } from './AuthContext'

/** Usar dentro de RotaProtegida: aqui o perfil já existe. */
export function RotaLideranca() {
  const { perfil } = useAuth()
  const toast = useToast()
  const autorizado = isLideranca(perfil?.cargo)

  useEffect(() => {
    if (!autorizado) toast.erro('Acesso não autorizado.')
  }, [autorizado, toast])

  if (!autorizado) return <Navigate to="/app/dashboard" replace />

  return <Outlet />
}
