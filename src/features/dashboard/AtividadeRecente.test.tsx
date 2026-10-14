vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, within } from '@testing-library/react'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import type { ActivityLog } from '@/types/database'
import { AtividadeRecente } from './AtividadeRecente'
import { CHAVE_EXPANDIDA } from './atividadeRecolhivel'

const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const registro = (n: number, horas: number): ActivityLog =>
  ({
    id: `a${n}`,
    user_id: 'u1',
    acao: 'demanda_criada',
    descricao: `criou a demanda "D${n}"`,
    entidade: 'tasks',
    entidade_id: `t${n}`,
    created_at: horasAtras(horas),
  }) as ActivityLog
// 6 nas últimas 24 horas e 2 mais antigos
const REGISTROS = [1, 2, 3, 4, 5, 6].map((n) => registro(n, n)).concat([registro(7, 30), registro(8, 50)])
const perfis = new Map([['u1', perfilDeTeste()]])

describe('AtividadeRecente', () => {
  beforeEach(() => {
    localStorage.clear()
    bancoFalso().reiniciar({ activity_log: REGISTROS })
  })

  it('começa recolhida com as 4 últimas e expande para as últimas 24 horas', () => {
    renderizar(<AtividadeRecente registros={REGISTROS} perfilPorId={perfis} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: 'Ver mais' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.queryByText(/"D7"/)).not.toBeInTheDocument()
    expect(localStorage.getItem(CHAVE_EXPANDIDA)).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: 'Recolher' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('lembra que estava expandida', () => {
    localStorage.setItem(CHAVE_EXPANDIDA, '1')
    renderizar(<AtividadeRecente registros={REGISTROS} perfilPorId={perfis} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })

  it('o histórico completo mostra também o que tem mais de 24 horas', async () => {
    renderizar(<AtividadeRecente registros={REGISTROS} perfilPorId={perfis} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver histórico completo' }))
    const modal = within(screen.getByRole('dialog', { name: 'Histórico de atividade' }))
    expect(await modal.findByText(/"D8"/)).toBeInTheDocument()
    expect(modal.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })
})
