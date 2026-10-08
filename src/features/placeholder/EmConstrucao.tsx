import styles from '@/layouts/layout.module.css'

interface EmConstrucaoProps {
  tela: string
  etapa: 2 | 3
}

/** Ocupa o lugar das telas que chegam nas próximas etapas. */
export function EmConstrucao({ tela, etapa }: EmConstrucaoProps) {
  return (
    <section className={styles.vazio}>
      <h2 className={styles.vazioTitulo}>{tela} em construção</h2>
      <p className={styles.vazioTexto}>Esta tela entra na etapa {etapa} do projeto.</p>
    </section>
  )
}
