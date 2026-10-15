import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icone } from './Icone'
import styles from './ui.module.css'

type TipoToast = 'sucesso' | 'erro'

interface ToastItem {
  id: number
  tipo: TipoToast
  mensagem: string
}

interface ToastApi {
  sucesso: (mensagem: string) => void
  erro: (mensagem: string) => void
}

const DURACAO_MS = 3000

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return api
}

function Aviso({ toast, onFechar }: { toast: ToastItem; onFechar: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onFechar(toast.id), DURACAO_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onFechar])

  return (
    // Entra subindo de baixo e sai esmaecendo; com menos movimento pedido, só o esmaecer
    <motion.div
      layout
      role="status"
      className={`${styles.toast} ${styles[`toast_${toast.tipo}`]}`}
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <span className={styles.toastMarca} aria-hidden="true" />
      <p className={styles.toastTexto}>{toast.mensagem}</p>
      <button
        type="button"
        className={styles.toastFechar}
        aria-label="Fechar aviso"
        onClick={() => onFechar(toast.id)}
      >
        <Icone nome="fechar" tamanho={16} />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const proximoId = useRef(1)

  const fechar = useCallback((id: number) => {
    setToasts((atuais) => atuais.filter((t) => t.id !== id))
  }, [])

  const mostrar = useCallback((tipo: TipoToast, mensagem: string) => {
    const id = proximoId.current++
    // Mensagem idêntica ainda visível não é repetida
    setToasts((atuais) =>
      atuais.some((t) => t.tipo === tipo && t.mensagem === mensagem)
        ? atuais
        : [...atuais, { id, tipo, mensagem }],
    )
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      sucesso: (mensagem) => mostrar('sucesso', mensagem),
      erro: (mensagem) => mostrar('erro', mensagem),
    }),
    [mostrar],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toastRegiao} aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <Aviso key={toast.id} toast={toast} onFechar={fechar} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
