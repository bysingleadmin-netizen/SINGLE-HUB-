import styles from './graficos.module.css'

interface SparklineProps {
  valores: number[]
  /** Como ler a série: "nas últimas 4 semanas" */
  periodo: string
}

const LARGURA = 100
const ALTURA = 28
const RESPIRO = 3

/** Linha mínima de tendência para os cards de indicador. O último ponto é o valor de hoje. */
export function Sparkline({ valores, periodo }: SparklineProps) {
  if (valores.length < 2) return null
  const maior = Math.max(...valores)
  const menor = Math.min(...valores)
  const faixa = maior - menor || 1
  const passo = (LARGURA - RESPIRO * 2) / (valores.length - 1)
  const pontos = valores.map((valor, i) => ({
    x: RESPIRO + passo * i,
    // Série reta fica no meio, e não encostada no chão
    y: maior === menor ? ALTURA / 2 : ALTURA - RESPIRO - ((valor - menor) / faixa) * (ALTURA - RESPIRO * 2),
    valor,
  }))
  const ultimo = pontos[pontos.length - 1]

  return (
    <span className={styles.sparkline}>
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="none" aria-hidden="true">
        <polyline points={pontos.map((p) => `${p.x},${p.y}`).join(' ')} />
      </svg>
      {/* O ponto fica fora do SVG esticado, para continuar redondo */}
      <span
        className={styles.sparklinePonto}
        style={{ left: `${ultimo.x}%`, top: `${(ultimo.y / ALTURA) * 100}%` }}
        aria-hidden="true"
      />
      <span className={styles.somenteLeitor}>
        {periodo}: {valores.join(', ')}
      </span>
    </span>
  )
}
