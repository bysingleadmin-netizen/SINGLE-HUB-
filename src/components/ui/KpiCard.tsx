import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Sparkline } from '@/components/graficos/Sparkline'
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
  /** Null quando o número não existe, como a conversão sem leads no período: mostra um traço */
  valor: number | null
  formatar?: (valor: number) => string
  carregando?: boolean
  /** Como o número estava nas últimas semanas, do mais antigo ao atual: vira uma linha de tendência */
  tendencia?: number[]
  /** Linhas curtas abaixo do número, como a variação e a base do cálculo */
  legenda?: ReactNode
}

function Valor({ valor, formatar }: { valor: number; formatar?: (valor: number) => string }) {
  const atual = useContagem(valor)
  // Pelo valor final, para o tamanho não mudar enquanto o número conta. Valor formatado
  // (dinheiro, porcentagem) diminui junto com o card, para os vizinhos ficarem do mesmo tamanho
  const longo = Boolean(formatar) || String(valor).length > 6
  return (
    <strong className={styles.kpiValor} data-longo={longo || undefined}>
      {formatar ? formatar(atual) : String(Math.round(atual))}
    </strong>
  )
}

export function KpiCard({ rotulo, valor, formatar, carregando = false, tendencia, legenda }: KpiCardProps) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiRotulo}>{rotulo}</span>
      {carregando ? (
        <Skeleton largura="60%" altura="32px" />
      ) : valor == null ? (
        <strong className={styles.kpiValor}>—</strong>
      ) : (
        <Valor valor={valor} formatar={formatar} />
      )}
      {!carregando && legenda && <div className={styles.kpiLegenda}>{legenda}</div>}
      {!carregando && tendencia && (
        <Sparkline valores={tendencia} periodo={`${rotulo} nas últimas ${tendencia.length} semanas`} />
      )}
    </div>
  )
}
