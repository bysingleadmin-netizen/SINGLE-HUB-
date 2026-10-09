import { Icone } from '@/components/ui/Icone'
import { useAuth } from '@/features/auth/AuthContext'
import { isLideranca } from '@/lib/permissoes'
import styles from './lista.module.css'

/**
 * Aviso para a liderança de que parte do quadro está desligada porque o banco ainda não
 * recebeu a migration 0003. Sem ele, os recursos simplesmente não aparecem e ninguém sabe por quê.
 */
export function AvisoDeMigracao() {
  const { perfil } = useAuth()
  if (!isLideranca(perfil?.cargo)) return null
  return (
    <p className={styles.aviso} role="note">
      <Icone nome="alerta" tamanho={16} />
      <span>
        Renomear e criar colunas, marcar cards como Travado ou Em andamento e anexar arquivos ficam
        disponíveis depois de rodar o arquivo <strong>supabase/migrations/0003_revisao.sql</strong>{' '}
        no SQL Editor do Supabase.
      </span>
    </p>
  )
}
