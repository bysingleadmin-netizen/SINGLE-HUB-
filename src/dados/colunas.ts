import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import type { BoardColumn, QuadroId } from '@/types/database'

// Colunas dos quadros Kanban.
//
// Cada quadro nasce com as colunas fixas do código (COLUNAS_TAREFA, COLUNAS_CONTEUDO). A equipe
// pode renomear, criar e reordenar; isso fica na tabela `board_columns` (migration 0003).
// A chave da coluna é o valor gravado no card (tasks.status ou content_cards.etapa), então
// renomear não toca em nenhum card. As chaves fixas continuam com o significado que o resto
// do sistema usa ('concluido', 'publicado', 'aguardando_aprovacao'); uma coluna criada pela
// equipe é só mais uma etapa em aberto.
//
// Sem a tabela (migration ainda não rodada), o quadro mostra as colunas fixas e não oferece edição.

export interface ColunaDoQuadro {
  id: string
  titulo: string
  /** Criada pela equipe; pode ser removida quando estiver vazia */
  personalizada?: boolean
}

// Códigos da API e do Postgres para "tabela não existe"
const TABELA_AUSENTE = new Set(['PGRST205', '42P01'])

/** Junta as colunas fixas com o que a equipe salvou: a ordem e os nomes salvos valem. */
export function montarColunas(
  padrao: readonly ColunaDoQuadro[],
  salvas: Pick<BoardColumn, 'chave' | 'titulo' | 'posicao'>[],
): ColunaDoQuadro[] {
  if (salvas.length === 0) return [...padrao]
  const fixas = new Set(padrao.map((coluna) => coluna.id))
  const ordenadas = [...salvas]
    .sort((a, b) => a.posicao - b.posicao)
    .map((linha) => ({
      id: linha.chave,
      titulo: linha.titulo,
      ...(fixas.has(linha.chave) ? {} : { personalizada: true }),
    }))
  const presentes = new Set(ordenadas.map((coluna) => coluna.id))
  // Coluna fixa que não foi salva (o código ganhou uma depois) entra no fim
  return [...ordenadas, ...padrao.filter((coluna) => !presentes.has(coluna.id))]
}

export function useColunasDoQuadro(quadro: QuadroId, padrao: readonly ColunaDoQuadro[]) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const consulta = useQuery({
    queryKey: ['board_columns'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('board_columns')
        .select('*')
        .order('posicao', { ascending: true })
      if (error) {
        if (TABELA_AUSENTE.has(error.code ?? '')) return null
        throw error
      }
      return (data ?? []) as BoardColumn[]
    },
  })

  const salvas = (consulta.data ?? []).filter((linha) => linha.quadro === quadro)
  const colunas = montarColunas(padrao, salvas)
  const titulo = (id: string) => colunas.find((coluna) => coluna.id === id)?.titulo ?? id

  /** Na primeira edição, as colunas atuais vão para o banco, e a mudança é feita sobre elas. */
  async function semear() {
    if (salvas.length > 0) return
    const { error } = await supabase.from('board_columns').insert(
      colunas.map((coluna, i) => ({
        quadro,
        chave: coluna.id,
        titulo: coluna.titulo,
        posicao: i + 1,
      })),
    )
    if (error) throw error
  }

  async function executar(acao: () => Promise<void>, sucesso: string) {
    try {
      await semear()
      await acao()
      toast.sucesso(sucesso)
    } catch {
      toast.erro('Não foi possível salvar as colunas do quadro.')
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['board_columns'] })
    }
  }

  return {
    colunas,
    titulo,
    carregando: consulta.isLoading,
    /** A edição só existe com a tabela no banco; sem ela o quadro fica como sempre foi */
    edicao:
      consulta.data == null
        ? undefined
        : {
            renomear: (id: string, novo: string) =>
              void executar(async () => {
                const { error } = await supabase
                  .from('board_columns')
                  .update({ titulo: novo })
                  .eq('quadro', quadro)
                  .eq('chave', id)
                if (error) throw error
              }, 'Coluna renomeada.'),
            criar: (novo: string) =>
              void executar(async () => {
                const { error } = await supabase.from('board_columns').insert({
                  quadro,
                  chave: `personalizada_${Date.now().toString(36)}`,
                  titulo: novo,
                  posicao: colunas.length + 1,
                })
                if (error) throw error
              }, 'Coluna criada.'),
            reordenar: (ids: string[]) => {
              // A ordem nova aparece na hora; se o banco recusar, a lista volta ao que estava
              queryClient.setQueryData<BoardColumn[] | null>(['board_columns'], (linhas) =>
                linhas?.map((linha) =>
                  linha.quadro === quadro && ids.includes(linha.chave)
                    ? { ...linha, posicao: ids.indexOf(linha.chave) + 1 }
                    : linha,
                ),
              )
              void executar(async () => {
                for (const [i, id] of ids.entries()) {
                  const { error } = await supabase
                    .from('board_columns')
                    .update({ posicao: i + 1 })
                    .eq('quadro', quadro)
                    .eq('chave', id)
                  if (error) throw error
                }
              }, 'Colunas reordenadas.')
            },
            remover: (id: string) =>
              void executar(async () => {
                const { error } = await supabase
                  .from('board_columns')
                  .delete()
                  .eq('quadro', quadro)
                  .eq('chave', id)
                if (error) throw error
              }, 'Coluna removida.'),
          },
  }
}
