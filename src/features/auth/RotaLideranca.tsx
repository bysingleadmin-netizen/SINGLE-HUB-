import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { podeAcessar } from '@/lib/permissoes'
import type { Area } from '@/lib/permissoes'
import { useAuth } from './AuthContext'

/**
 * Só deixa entrar quem tem o cargo que vê a área (src/lib/permissoes.ts); os outros voltam
 * para o Dashboard. Usar dentro de RotaProtegida: aqui o perfil já existe.
 */
export function RotaDaArea({ area }: { area: Area }) {
  const { perfil } = useAuth()
  const toast = useToast()
  const autorizado = podeAcessar(perfil?.cargo, area)

  useEffect(() => {
    if (!autorizado) toast.erro('Acesso não autorizado.')
  }, [autorizado, toast])

  if (!autorizado) return <Navigate to="/app/dashboard" replace />

  return <Outlet />
}

/** Financeiro e o que só a liderança vê */
export function RotaLideranca() {
  return <RotaDaArea area="financeiro" />
}
