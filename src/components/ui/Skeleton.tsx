import styles from './ui.module.css'

interface SkeletonProps {
  largura?: string
  altura?: string
  raio?: string
}

export function Skeleton({ largura = '100%', altura = '16px', raio }: SkeletonProps) {
  return (
    <span
      className={styles.skeleton}
      style={{ width: largura, height: altura, borderRadius: raio }}
      aria-hidden="true"
    />
  )
}
