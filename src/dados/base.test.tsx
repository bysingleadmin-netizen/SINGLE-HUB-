vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { bancoFalso, criarEnvolucro } from '@/test/renderizar'
import type { Task } from '@/types/database'
import { useRegistrarAtividade } from './atividade'
import { porId, useAtualizarOtimista, useLista, useRemover, useSalvar } from './base'

const TAREFA = { id: 't1', titulo: 'Roteiro', status: 'a_fazer', created_at: '2026-10-01T00:00:00Z' }

beforeEach(() => {
  bancoFalso().reiniciar({ tasks: [TAREFA] })
})

describe('useLista', () => {
  it('devolve as linhas da tabela', async () => {
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useLista<Task>('tasks'), { wrapper: Envolucro })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data?.[0].titulo).toBe('Roteiro')
  })

  it('fica em erro quando a leitura falha', async () => {
    bancoFalso().erroLeitura = { message: 'sem rede' }
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useLista<Task>('tasks'), { wrapper: Envolucro })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('não consulta quando desativada', async () => {
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useLista<Task>('tasks', { ativo: false }), {
      wrapper: Envolucro,
    })
    await new Promise((resolver) => setTimeout(resolver, 20))
    expect(result.current.data).toBeUndefined()
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useSalvar', () => {
  it('cria sem id e atualiza com id', async () => {
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useSalvar<Task>('tasks'), { wrapper: Envolucro })

    let criada: Task | undefined
    await act(async () => {
      criada = await result.current.mutateAsync({ valores: { titulo: 'Nova' } })
    })
    expect(criada?.id).toBeTruthy()
    expect(bancoFalso().tabelas.tasks).toHaveLength(2)

    await act(async () => {
      await result.current.mutateAsync({ id: 't1', valores: { titulo: 'Roteiro final' } })
    })
    expect(bancoFalso().tabelas.tasks[0].titulo).toBe('Roteiro final')
  })

  it('rejeita quando o banco recusa', async () => {
    bancoFalso().erroEscrita = { message: 'negado' }
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useSalvar<Task>('tasks'), { wrapper: Envolucro })
    await expect(
      act(() => result.current.mutateAsync({ valores: { titulo: 'Nova' } })),
    ).rejects.toMatchObject({ message: 'negado' })
  })
})

describe('useAtualizarOtimista', () => {
  function montar() {
    const { Envolucro } = criarEnvolucro()
    return renderHook(
      () => ({ lista: useLista<Task>('tasks'), mover: useAtualizarOtimista<Task>('tasks') }),
      { wrapper: Envolucro },
    )
  }

  it('grava a mudança', async () => {
    const { result } = montar()
    await waitFor(() => expect(result.current.lista.data).toHaveLength(1))

    act(() => result.current.mover.mutate({ id: 't1', valores: { status: 'concluido' } }))
    await waitFor(() => expect(result.current.mover.isSuccess).toBe(true))
    expect(bancoFalso().tabelas.tasks[0].status).toBe('concluido')
    await waitFor(() => expect(result.current.lista.data?.[0].status).toBe('concluido'))
  })

  it('volta ao estado anterior quando o banco recusa', async () => {
    const { result } = montar()
    await waitFor(() => expect(result.current.lista.data).toHaveLength(1))
    bancoFalso().erroEscrita = { message: 'negado' }

    act(() => result.current.mover.mutate({ id: 't1', valores: { status: 'concluido' } }))
    await waitFor(() => expect(result.current.mover.isError).toBe(true))
    expect(result.current.lista.data?.[0].status).toBe('a_fazer')
  })
})

describe('useRemover', () => {
  it('apaga a linha', async () => {
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useRemover('tasks'), { wrapper: Envolucro })
    await act(async () => {
      await result.current.mutateAsync('t1')
    })
    expect(bancoFalso().tabelas.tasks).toHaveLength(0)
  })
})

describe('porId', () => {
  it('indexa por id e aceita lista ausente', () => {
    expect(porId([{ id: 'a' }, { id: 'b' }]).get('b')).toEqual({ id: 'b' })
    expect(porId(undefined).size).toBe(0)
  })
})

describe('useRegistrarAtividade', () => {
  const REGISTRO = {
    acao: 'demanda_criada',
    descricao: 'criou a demanda "Roteiro"',
    entidade: 'tasks',
    entidadeId: 't1',
  } as const

  it('grava em nome do usuário logado', async () => {
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useRegistrarAtividade(), { wrapper: Envolucro })
    await act(() => result.current(REGISTRO))
    expect(bancoFalso().tabelas.activity_log[0]).toMatchObject({
      user_id: 'u1',
      acao: 'demanda_criada',
      entidade_id: 't1',
    })
  })

  it('não lança quando o registro falha', async () => {
    bancoFalso().erroEscrita = { message: 'negado' }
    const { Envolucro } = criarEnvolucro()
    const { result } = renderHook(() => useRegistrarAtividade(), { wrapper: Envolucro })
    await expect(act(() => result.current(REGISTRO))).resolves.toBeUndefined()
  })
})
