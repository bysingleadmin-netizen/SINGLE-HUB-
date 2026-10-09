import { Avatar } from '@/components/ui/Avatar'
import type { CargaDaPessoa } from '@/lib/regras'
import type { Profile } from '@/types/database'
import styles from './dashboard.module.css'

const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

interface CargaProps {
  carga: CargaDaPessoa[]
  perfilPorId: Map<string, Profile>
}

/** Barras com o que cada pessoa tem em aberto. A maior barra é a referência de largura. */
export function Carga({ carga, perfilPorId }: CargaProps) {
  const maior = Math.max(...carga.map((item) => item.total), 1)
  return (
    <ul className={`${styles.carga} stagger`}>
      {carga.map((item) => {
        const perfil = perfilPorId.get(item.id)
        return (
          <li
            key={item.id}
            className={styles.cargaLinha}
            title={`${percentual.format(item.fatia)} do que está em aberto na equipe`}
          >
            <Avatar nome={perfil?.nome ?? null} url={perfil?.avatar_url} tamanho={30} />
            <div className={styles.cargaTexto}>
              <span className={styles.cargaTopo}>
                <span className={styles.cargaNome}>{perfil?.nome ?? 'Pessoa removida'}</span>
                <span className={styles.cargaCargo}>{perfil?.cargo}</span>
                <strong className={styles.cargaTotal}>{item.total}</strong>
                <span className={styles.cargaFatia}>{percentual.format(item.fatia)}</span>
              </span>
              <span className={styles.cargaBarra} aria-hidden="true">
                <span style={{ width: `${(item.total / maior) * 100}%` }} />
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
