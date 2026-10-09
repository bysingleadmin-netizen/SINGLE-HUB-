import { Avatar } from '@/components/ui/Avatar'
import type { Profile } from '@/types/database'
import styles from './lista.module.css'

interface FiltroDeColaboradoresProps {
  perfis: Profile[]
  /** ids marcados; vazio mostra todo mundo */
  selecionados: string[]
  onMudar: (ids: string[]) => void
}

/** Avatares clicáveis que filtram o quadro por responsável. Dá para marcar mais de um. */
export function FiltroDeColaboradores({ perfis, selecionados, onMudar }: FiltroDeColaboradoresProps) {
  function alternar(id: string) {
    onMudar(
      selecionados.includes(id) ? selecionados.filter((outro) => outro !== id) : [...selecionados, id],
    )
  }

  return (
    <div className={styles.colaboradores} role="group" aria-label="Filtrar por colaborador">
      {perfis.map((perfil) => (
        <button
          key={perfil.id}
          type="button"
          className={styles.colaborador}
          aria-pressed={selecionados.includes(perfil.id)}
          aria-label={`${perfil.nome}, ${perfil.cargo}`}
          title={`${perfil.nome} · ${perfil.cargo}`}
          onClick={() => alternar(perfil.id)}
        >
          <Avatar nome={perfil.nome} url={perfil.avatar_url} tamanho={30} />
        </button>
      ))}
      {selecionados.length > 0 && (
        <button type="button" className={styles.limpar} onClick={() => onMudar([])}>
          Limpar
        </button>
      )}
    </div>
  )
}
