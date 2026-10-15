import type { Profile } from '@/types/database'

/** Opções de seleção de colaborador, com o cargo ao lado do nome: "João Silva · Designer". */
export function opcoesDePessoas(perfis: Pick<Profile, 'id' | 'nome' | 'cargo'>[]) {
  return perfis.map((perfil) => ({ valor: perfil.id, rotulo: `${perfil.nome} · ${perfil.cargo}` }))
}

type ComResponsaveis = { responsavel_id: string | null; responsaveis?: string[] | null }

/**
 * Todos os responsáveis de um card, o principal primeiro. Antes da migration 0009 (ou num card
 * que ainda não ganhou a lista), vale só o responsavel_id.
 */
export function responsaveisDe(item: ComResponsaveis): string[] {
  if (item.responsaveis && item.responsaveis.length > 0) return item.responsaveis
  return item.responsavel_id ? [item.responsavel_id] : []
}

/**
 * O que gravar ao trocar os responsáveis: a lista (com a migration 0009) e, sempre, o primeiro
 * como responsavel_id, que avisos, filtros e a carga da equipe também leem.
 */
export function valoresDeResponsaveis(ids: string[], multiplo: boolean) {
  return multiplo ? { responsaveis: ids, responsavel_id: ids[0] ?? null } : { responsavel_id: ids[0] ?? null }
}
