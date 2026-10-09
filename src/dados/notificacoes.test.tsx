vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { hojeISO, somarDias } from '@/lib/datas'
import { bancoFalso, criarEnvolucro } from '@/test/renderizar'
import type { Task } from '@/types/database'
import {
  linkDoPrazo,
  tarefasComPrazoAmanha,
  useAvisarPrazosDeAmanha,
  useNotificacoes,
  useNotificar,
} from './notificacoes'

const HOJE = hojeISO()
const AMANHA = somarDias(HOJE, 1)

const AVISO = {
  tipo: 'tarefa',
  titulo: 'Nova demanda para você',
  mensagem: 'Luan atribuiu a demanda "Roteiro" a você.',
  link: '/app/demandas?abrir=t1',
} as const

beforeEach(() => {
  bancoFalso().reiniciar()
})

describe('useNotificar', () => {
  function montar() {
    const { Envolucro } = criarEnvolucro()
    return renderHook(() => useNotificar(), { wrapper: Envolucro })
  }

  it('grava uma notificação não lida para cada destinatário', async () => {
    const { result } = montar()
    await act(() => result.current(['u2', 'u3'], AVISO))
    expect(bancoFalso().tabelas.notifications).toEqual([
      expect.objectContaining({ user_id: 'u2', lida: false, ...AVISO }),
      expect.objectContaining({ user_id: 'u3', lida: false, ...AVISO }),
    ])
  })

  it('não avisa a própria pessoa, nem repete destinatário, nem aceita vazio', async () => {
    const { result } = montar()
    await act(() => result.current(['u1', 'u2', 'u2', null, undefined], AVISO))
    expect(bancoFalso().tabelas.notifications).toHaveLength(1)
    expect(bancoFalso().tabelas.notifications[0].user_id).toBe('u2')
  })

  it('não toca no banco quando não sobra ninguém para avisar', async () => {
    const { result } = montar()
    await act(() => result.current(['u1'], AVISO))
    expect(bancoFalso().tabelas.notifications ?? []).toHaveLength(0)
  })

  it('não lança quando o banco recusa', async () => {
    bancoFalso().erroEscrita = { message: 'negado' }
    const { result } = montar()
    await expect(act(() => result.current(['u2'], AVISO))).resolves.toBeUndefined()
  })
})

describe('useNotificacoes', () => {
  it('traz só as do usuário, da mais nova para a mais antiga, no máximo 20', async () => {
    bancoFalso().reiniciar({
      notifications: [
        ...Array.from({ length: 22 }, (_, i) => ({
          id: `n${i}`,
          user_id: 'u1',
          titulo: `Aviso ${i}`,
          lida: false,
          created_at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        })),
        { id: 'outro', user_id: 'u2', titulo: 'De outra pessoa', lida: false, created_at: '2026-12-01' },
      ],
    })
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useNotificacoes(), { wrapper: Envolucro })
    await waitFor(() => expect(result.current.data).toHaveLength(20))
    expect(result.current.data?.[0].id).toBe('n21')
    expect(result.current.data?.some((n) => n.id === 'outro')).toBe(false)
  })
})

describe('prazo de amanhã', () => {
  const tarefa = (parcial: Partial<Task>) =>
    ({ id: 't', titulo: 'T', status: 'a_fazer', responsavel_id: 'u1', data_entrega: AMANHA, ...parcial }) as Task

  it('seleciona as tarefas abertas da pessoa que vencem amanhã', () => {
    const lista = tarefasComPrazoAmanha(
      [
        tarefa({ id: 'minha' }),
        tarefa({ id: 'de-outro', responsavel_id: 'u2' }),
        tarefa({ id: 'hoje', data_entrega: HOJE }),
        tarefa({ id: 'feita', status: 'concluido' }),
        tarefa({ id: 'sem-data', data_entrega: null }),
      ],
      'u1',
      HOJE,
    )
    expect(lista.map((t) => t.id)).toEqual(['minha'])
  })

  it('o link leva a data, para um mesmo prazo avisar uma vez só', () => {
    expect(linkDoPrazo({ id: 't1', data_entrega: '2026-10-09' })).toBe(
      '/app/demandas?abrir=t1&prazo=2026-10-09',
    )
  })

  it('avisa uma vez e não repete quando o app é aberto de novo', async () => {
    bancoFalso().reiniciar({
      tasks: [
        { ...tarefa({ id: 't1', titulo: 'Roteiro' }), created_at: '2026-10-01' },
        { ...tarefa({ id: 't2', titulo: 'De outro', responsavel_id: 'u2' }), created_at: '2026-10-02' },
      ],
    })
    const primeira = criarEnvolucro()
    const a = renderHook(() => useAvisarPrazosDeAmanha(), { wrapper: primeira.Envolucro })
    await waitFor(() => expect(bancoFalso().tabelas.notifications).toHaveLength(1))
    expect(bancoFalso().tabelas.notifications[0]).toMatchObject({
      user_id: 'u1',
      tipo: 'prazo',
      link: `/app/demandas?abrir=t1&prazo=${AMANHA}`,
      lida: false,
    })
    a.unmount()

    const segunda = criarEnvolucro()
    renderHook(() => useAvisarPrazosDeAmanha(), { wrapper: segunda.Envolucro })
    await new Promise((resolver) => setTimeout(resolver, 60))
    expect(bancoFalso().tabelas.notifications).toHaveLength(1)
  })
})
