import styles from './ui.module.css'

// Traçado do logotipo, tirado do arquivo da marca (SINGLE - CONCLUIDA.svg).
// As duas partes usam a mesma faixa vertical do desenho original, então ficam alinhadas.
const TOPO = 262.7
const ALTURA = 56.7
const INICIAL = { x: 76.6, largura: 48.9 }
const RESTANTE = { x: 131.65, largura: 224.41 }
const VAO = RESTANTE.x - (INICIAL.x + INICIAL.largura)

interface LogotipoProps {
  /** Altura das letras, em pixels */
  altura?: number
  /** Classe aplicada a "INGLE", para a sidebar recolhida mostrar só a inicial */
  classeDoRestante?: string
}

export function Logotipo({ altura = 16, classeDoRestante }: LogotipoProps) {
  const escala = altura / ALTURA
  return (
    <span role="img" aria-label="SINGLE" className={styles.logotipo}>
      <svg
        width={INICIAL.largura * escala}
        height={altura}
        viewBox={`${INICIAL.x} ${TOPO} ${INICIAL.largura} ${ALTURA}`}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M85.39,291.15c2.39,1.24,5.1,2.17,8.14,2.81l13.34,2.33c3.42.69,5.89,1.61,7.4,2.76,1.52,1.15,2.28,2.99,2.28,5.53,0,1.78-.45,3.27-1.34,4.45-.9,1.18-2.37,2.04-4.43,2.59-2.06.55-4.83.82-8.3.82-4.01,0-7.16-.39-9.44-1.17-2.28-.78-3.91-1.93-4.88-3.45-.98-1.52-1.46-3.44-1.46-5.74v-1.38h-8.79v.52c0,4.03.92,7.53,2.77,10.49,1.84,2.97,4.6,5.25,8.26,6.86.56.25,1.15.47,1.75.68h23.36c.53-.2,1.05-.41,1.54-.64,3.36-1.58,5.83-3.67,7.4-6.26,1.57-2.59,2.36-5.35,2.36-8.29s-.6-5.3-1.79-7.43c-1.19-2.13-3-3.89-5.41-5.27-2.41-1.38-5.44-2.42-9.07-3.11l-13.26-2.42c-2.12-.52-3.85-1.08-5.21-1.68-1.36-.6-2.36-1.42-3.01-2.46-.65-1.04-.98-2.36-.98-3.97,0-1.78.46-3.24,1.38-4.36.92-1.12,2.4-1.97,4.43-2.55,2.03-.57,4.71-.86,8.01-.86,3.8,0,6.81.39,9.03,1.17,2.22.78,3.82,1.96,4.8,3.54.98,1.58,1.46,3.55,1.46,5.91v1.12h8.71v-.52c0-3.8-.83-7.18-2.48-10.15-1.66-2.96-4.19-5.31-7.61-7.04-.63-.32-1.29-.59-1.98-.85h-22.9c-2.54.91-4.64,2.09-6.28,3.53-1.84,1.61-3.2,3.43-4.07,5.44-.87,2.02-1.3,4.06-1.3,6.13,0,3.17.66,5.8,1.99,7.9,1.33,2.1,3.19,3.77,5.57,5.01Z" />
      </svg>
      <span
        className={[styles.logotipoRestante, classeDoRestante].filter(Boolean).join(' ')}
        style={{ marginLeft: VAO * escala }}
      >
        <svg
          width={RESTANTE.largura * escala}
          height={altura}
          viewBox={`${RESTANTE.x} ${TOPO} ${RESTANTE.largura} ${ALTURA}`}
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="131.65" y="263.23" width="9.13" height="56.1" />
          <rect x="147.31" y="263.14" width="8.62" height="56.1" />
          <polygon points="189.57 263.14 180.95 263.14 155.92 319.24 164.54 319.24 189.57 263.14" />
          <rect x="189.57" y="263.14" width="8.62" height="56.1" />
          <path d="M230.58,262.79c-3.59,0-7.16.79-10.39,2.46-6.72,3.48-11.86,9.82-13.97,17.52-.58,2.56-.89,5.27-.89,8.08,0,2.02.16,3.98.46,5.88,2.65,12.68,13.38,22.16,26.23,22.16h24.01v-27.28h-8.55v17.56h-17.09c-9.44,0-17.09-8.3-17.09-18.55,0-9.47,6.55-17.28,15-18.41.69-.09,1.39-.14,2.1-.14h25.64v-9.29h-25.45Z" />
          <polygon points="272.12 263.14 262.99 263.14 262.99 311.83 269.78 319.24 271.69 319.24 272.12 319.24 304.3 319.24 304.3 310.11 272.12 310.11 272.12 263.14" />
          <polygon points="319.66 263.14 319.26 263.14 317.51 263.14 311.26 263.14 311.26 270.54 311.26 271.43 311.26 311.83 311.26 319.24 317.51 319.24 319.26 319.24 319.66 319.24 320.89 319.24 356.06 319.24 356.06 310.11 319.66 310.11 319.66 295.76 348.86 295.76 348.86 286.62 319.66 286.62 319.66 272.27 356.06 272.27 356.06 263.14 320.06 263.14 319.66 263.14" />
        </svg>
      </span>
    </span>
  )
}
