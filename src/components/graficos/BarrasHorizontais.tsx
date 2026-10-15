import styles from './graficos.module.css'

export interface BarraDoGrafico {
  chave: string
  rotulo: string
  valor: number
}

interface BarrasHorizontaisProps {
  /** O que as barras medem, para leitores de tela: "Demandas em aberto por cliente" */
  titulo: string
  itens: BarraDoGrafico[]
  formatar?: (valor: number) => string
  /** Uma série só: a cor de destaque do sistema, a não ser que a tela peça outra */
  cor?: string
}

/**
 * Barras horizontais de uma série só, com o nome à esquerda e o valor escrito ao lado de cada
 * barra. Em HTML (não SVG) para os nomes longos quebrarem e a lista ser lida como lista.
 */
export function BarrasHorizontais({ titulo, itens, formatar = String, cor }: BarrasHorizontaisProps) {
  const maior = Math.max(...itens.map((item) => item.valor), 0) || 1
  return (
    <ul className={styles.barras} aria-label={titulo}>
      {itens.map((item) => (
        <li key={item.chave} className={styles.barra} title={`${item.rotulo}: ${formatar(item.valor)}`}>
          <span className={styles.barraRotulo}>{item.rotulo}</span>
          <span className={styles.barraTrilho} aria-hidden="true">
            <span
              className={styles.barraValor}
              style={{ width: `${(item.valor / maior) * 100}%`, ...(cor ? { background: cor } : {}) }}
            />
          </span>
          <span className={styles.barraNumero}>{formatar(item.valor)}</span>
        </li>
      ))}
    </ul>
  )
}
