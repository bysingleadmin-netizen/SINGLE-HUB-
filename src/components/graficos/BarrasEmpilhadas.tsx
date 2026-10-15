import styles from './graficos.module.css'

export interface SerieEmpilhada {
  chave: string
  rotulo: string
  cor: string
}

export interface LinhaEmpilhada {
  chave: string
  rotulo: string
  /** Valor de cada série, pela chave dela */
  valores: Record<string, number>
}

interface BarrasEmpilhadasProps {
  titulo: string
  series: SerieEmpilhada[]
  linhas: LinhaEmpilhada[]
}

/**
 * Barras horizontais empilhadas: uma linha por grupo, um trecho por série. A legenda fica
 * acima, com o total de cada série, e o total da linha fica escrito ao lado dela; a cor nunca
 * é a única pista.
 */
export function BarrasEmpilhadas({ titulo, series, linhas }: BarrasEmpilhadasProps) {
  const totalDa = (linha: LinhaEmpilhada) => series.reduce((soma, s) => soma + (linha.valores[s.chave] ?? 0), 0)
  const maior = Math.max(...linhas.map(totalDa), 0) || 1

  return (
    <figure className={styles.empilhadas} aria-label={titulo}>
      <ul className={styles.legenda}>
        {series.map((serie) => (
          <li key={serie.chave}>
            <span className={styles.legendaCor} style={{ background: serie.cor }} aria-hidden="true" />
            {serie.rotulo}{' '}
            <strong>{linhas.reduce((soma, linha) => soma + (linha.valores[serie.chave] ?? 0), 0)}</strong>
          </li>
        ))}
      </ul>
      <ul className={styles.barras}>
        {linhas.map((linha) => {
          const total = totalDa(linha)
          const descricao = series.map((s) => `${s.rotulo} ${linha.valores[s.chave] ?? 0}`).join(', ')
          return (
            <li key={linha.chave} className={styles.barra} aria-label={`${linha.rotulo}: ${descricao}`}>
              <span className={styles.barraRotulo}>{linha.rotulo}</span>
              <span className={styles.barraTrilho} aria-hidden="true">
                <span className={styles.pilha} style={{ width: `${(total / maior) * 100}%` }}>
                  {series.map((serie) => {
                    const valor = linha.valores[serie.chave] ?? 0
                    return valor > 0 ? (
                      <span
                        key={serie.chave}
                        className={styles.trecho}
                        style={{ flexGrow: valor, background: serie.cor }}
                        title={`${linha.rotulo}, ${serie.rotulo}: ${valor}`}
                      />
                    ) : null
                  })}
                </span>
              </span>
              <span className={styles.barraNumero} aria-hidden="true">
                {total}
              </span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
