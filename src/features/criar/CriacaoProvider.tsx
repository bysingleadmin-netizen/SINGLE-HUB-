import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { CriacaoContext } from './CriacaoContext'
import type { PedidoDeCriacao } from './CriacaoContext'
import { CriarModal } from './CriarModal'

/** Mantém o formulário único de criação e o entrega às telas por `useCriar()`. */
export function CriacaoProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<PedidoDeCriacao | null>(null)
  const abrir = useCallback((novo: PedidoDeCriacao = {}) => setPedido(novo), [])

  return (
    <CriacaoContext.Provider value={abrir}>
      {children}
      {pedido && <CriarModal pedido={pedido} onFechar={() => setPedido(null)} />}
    </CriacaoContext.Provider>
  )
}
