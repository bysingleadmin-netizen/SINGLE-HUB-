import { useEffect, useRef, useState } from 'react'
import { Skeleton } from './Skeleton'
import styles from './ui.module.css'

const DURACAO_MS = 700

function podeAnimar(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Conta do valor anterior até `alvo`. Sem animação quando o usuário pede menos movimento. */
function useContagem(alvo: number): number {
  const [atual, setAtual] = useState(() => (podeAnimar() ? 0 : alvo))
  const mostrado = useRef(atual)

  useEffect(() => {
    if (!podeAnimar()) {
      mostrado.current = alvo
      setAtual(alvo)
      return
    }
    const origem = mostrado.current
    const inicio = performance.now()
    let quadro = requestAnimationFrame(function passo(agora) {
      const progresso = Math.min(1, (agora - inicio) / DURACAO_MS)
      const suavizado = 1 - (1 - progresso) ** 3
      mostrado.current = origem + (alvo - origem) * suavizado
      setAtual(mostrado.current)
      if (progresso < 1) quadro = requestAnimationFrame(passo)
    })
    return () => cancelAnimationFrame(quadro)
  }, [alvo])

  return atual
}

interface KpiCardProps {
  rotulo: string
  valor: number
  formatar?: (valor: number) => string
  carregando?: boolean
}

function Valor({ valor, formatar }: Pick<KpiCardProps, 'valor' | 'formatar'>) {
  const atual = useContagem(valor)
  return (
    <strong className={styles.kpiValor}>
      {formatar ? formatar(atual) : String(Math.round(atual))}
    </strong>
  )
}

export function KpiCard({ rotulo, valor, formatar, carregando = false }: KpiCardProps) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiRotulo}>{rotulo}</span>
      {carregando ? (
        <Skeleton largura="60%" altura="32px" />
      ) : (
        <Valor valor={valor} formatar={formatar} />
      )}
    </div>
  )
}
