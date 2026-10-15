import { useState } from 'react'
import { arcosDaRosca } from './statusDosCards'
import type { FatiaDeStatus } from './statusDosCards'
import styles from './dashboard.module.css'

const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

// Círculo com perímetro 100: cada arco é um trecho do traço, em porcentagem da volta
const RAIO = 100 / (2 * Math.PI)
// Espaço entre fatias, para que cores vizinhas não se fundam
const VAO = 0.6

/**
 * Rosca com os cards de um quadro por coluna. Passar o mouse numa fatia ou na legenda
 * mostra no centro a contagem daquela coluna; fora disso, o centro mostra o total.
 */
export function GraficoStatus({
  titulo,
  fatias,
  unidade = ['card', 'cards'],
}: {
  titulo: string
  fatias: FatiaDeStatus[]
  /** O que o total do centro conta, no singular e no plural */
  unidade?: [string, string]
}) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const arcos = arcosDaRosca(fatias)
  const total = fatias.reduce((soma, fatia) => soma + fatia.total, 0)
  const destacado = arcos.find((arco) => arco.valor === ativo)
  const descricao = fatias.map((fatia) => `${fatia.rotulo} ${fatia.total}`).join(', ')
  const vao = arcos.length > 1 ? VAO : 0

  return (
    <div className={styles.rosca}>
      <div className={styles.roscaDesenho}>
        <svg viewBox="0 0 40 40" role="img" aria-label={`${titulo}: ${descricao}`}>
          <circle className={styles.roscaTrilho} cx="20" cy="20" r={RAIO} />
          {arcos.map((arco, i) => (
            <circle
              key={arco.valor}
              className={styles.roscaArco}
              data-apagado={(ativo != null && ativo !== arco.valor) || undefined}
              cx="20"
              cy="20"
              r={RAIO}
              strokeDasharray={`${Math.max(arco.fracao * 100 - vao, 0.01)} ${100}`}
              strokeDashoffset={-arco.inicio * 100}
              // Pelo style, a cor pode ser uma variável do tema (var(--serie-1))
              style={{ stroke: arco.cor, animationDelay: `${0.1 + i * 0.08}s` }}
              onMouseEnter={() => setAtivo(arco.valor)}
              onMouseLeave={() => setAtivo(null)}
            />
          ))}
        </svg>
        <div className={styles.roscaCentro} aria-hidden="true">
          <strong>{destacado ? destacado.total : total}</strong>
          <span>{destacado ? destacado.rotulo : total === 1 ? unidade[0] : unidade[1]}</span>
        </div>
      </div>

      <ul className={styles.roscaLegenda}>
        {fatias.map((fatia) => (
          <li
            key={fatia.valor}
            data-vazio={fatia.total === 0 || undefined}
            data-ativo={fatia.valor === ativo || undefined}
            onMouseEnter={() => fatia.total > 0 && setAtivo(fatia.valor)}
            onMouseLeave={() => setAtivo(null)}
          >
            <span className={styles.roscaCor} style={{ background: fatia.cor }} />
            <span className={styles.roscaNome}>{fatia.rotulo}</span>
            <span className={styles.roscaTotal}>{fatia.total}</span>
            <span className={styles.roscaPercentual}>
              {total > 0 ? percentual.format(fatia.total / total) : '0%'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
