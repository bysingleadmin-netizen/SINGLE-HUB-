import { Selecao } from '@/components/ui/Selecao'
import { SeletorDePessoas } from '@/components/ui/SeletorDePessoas'
import { opcoesDePessoas } from '@/lib/pessoas'
import type { Profile } from '@/types/database'

interface CampoDeResponsaveisProps {
  perfis: Profile[]
  /** ids escolhidos, o principal primeiro */
  ids: string[]
  /** O banco já guarda a lista (migration 0009); sem ela, um responsável só */
  multiplo: boolean
  onMudar: (ids: string[]) => void
}

/** Responsáveis de uma demanda ou de um conteúdo: vários com a migration 0009, um antes dela. */
export function CampoDeResponsaveis({ perfis, ids, multiplo, onMudar }: CampoDeResponsaveisProps) {
  if (multiplo) {
    return <SeletorDePessoas rotulo="Responsáveis" pessoas={perfis} escolhidas={ids} onMudar={onMudar} />
  }
  return (
    <Selecao
      rotulo="Responsável"
      vazio="Sem responsável"
      opcoes={opcoesDePessoas(perfis)}
      value={ids[0] ?? ''}
      onChange={(evento) => onMudar(evento.target.value ? [evento.target.value] : [])}
    />
  )
}
