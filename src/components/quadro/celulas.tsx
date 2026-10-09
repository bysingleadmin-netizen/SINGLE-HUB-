import { Avatar } from '@/components/ui/Avatar'
import { Pill } from '@/components/ui/Pill'
import { formatarData } from '@/lib/formato'
import type { SituacaoDoPrazo } from '@/lib/regras'
import { PRIORIDADES, opcao } from '@/lib/rotulos'
import type { Client, Profile } from '@/types/database'
import styles from './lista.module.css'

// Células compartilhadas pelas listas de Demandas, Conteúdo e Anúncios.

export function CelulaTitulo({ children }: { children: string }) {
  return <span className={styles.celulaTitulo}>{children}</span>
}

export function CelulaCliente({ cliente }: { cliente: Client | undefined }) {
  if (!cliente) return <span className={styles.celulaMuda}>Sem cliente</span>
  return (
    <span className={styles.celulaPessoa}>
      <Avatar nome={cliente.nome} url={cliente.logo_url} tamanho={24} />
      {cliente.nome}
    </span>
  )
}

/** Nome com o cargo como legenda, como no card. */
export function CelulaPessoa({ perfil }: { perfil: Profile | undefined }) {
  if (!perfil) return <span className={styles.celulaMuda}>Sem responsável</span>
  return (
    <span className={styles.celulaPessoa}>
      <Avatar nome={perfil.nome} url={perfil.avatar_url} tamanho={24} />
      <span className={styles.celulaPessoaTexto}>
        {perfil.nome}
        <span className={styles.celulaLegenda}>{perfil.cargo}</span>
      </span>
    </span>
  )
}

export function CelulaPrazo({ data, prazo }: { data: string | null; prazo: SituacaoDoPrazo | null }) {
  if (!data) return <span className={styles.celulaMuda}>Sem data</span>
  return (
    <span className={styles.celulaPrazo} data-prazo={prazo ?? undefined}>
      {formatarData(data)}
    </span>
  )
}

export function CelulaPrioridade({ prioridade }: { prioridade: string | null | undefined }) {
  const nivel = opcao(PRIORIDADES, (prioridade ?? 'media') as (typeof PRIORIDADES)[number]['valor'])
  return <Pill tom={nivel.tom}>{nivel.rotulo}</Pill>
}
