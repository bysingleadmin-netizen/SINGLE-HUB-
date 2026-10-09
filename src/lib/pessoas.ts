import type { Profile } from '@/types/database'

/** Opções de seleção de colaborador, com o cargo ao lado do nome: "João Silva · Designer". */
export function opcoesDePessoas(perfis: Pick<Profile, 'id' | 'nome' | 'cargo'>[]) {
  return perfis.map((perfil) => ({ valor: perfil.id, rotulo: `${perfil.nome} · ${perfil.cargo}` }))
}
