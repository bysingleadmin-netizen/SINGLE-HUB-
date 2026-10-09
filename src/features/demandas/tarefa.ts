import { doColaborador } from '@/components/quadro/colunas'
import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { COLUNAS_TAREFA } from '@/lib/rotulos'
import type { Prioridade, Task, TaskStatus, TaskTipo } from '@/types/database'

export function tituloDoStatus(status: string): string {
  return COLUNAS_TAREFA.find((coluna) => coluna.id === status)?.titulo ?? status
}

export interface FormTarefa {
  titulo: string
  descricao: string
  client_id: string
  responsavel_id: string
  tipo: TaskTipo
  status: TaskStatus
  data_entrega: string
  /** Fica fora dos valores validados: só é gravada quando o banco tem a coluna */
  prioridade: Prioridade
}

export type ValoresTarefa = Pick<
  Task,
  'titulo' | 'descricao' | 'client_id' | 'responsavel_id' | 'tipo' | 'status' | 'data_entrega'
>

export function formNovaTarefa(status: TaskStatus): FormTarefa {
  return {
    titulo: '',
    descricao: '',
    client_id: '',
    responsavel_id: '',
    tipo: 'conteudo',
    status,
    data_entrega: '',
    prioridade: 'media',
  }
}

export function validarTarefa(form: FormTarefa): Validacao<ValoresTarefa, FormTarefa> {
  const titulo = form.titulo.trim()
  if (titulo === '') {
    const erros: Erros<FormTarefa> = { titulo: 'Informe o título da demanda.' }
    return { erros }
  }
  return {
    valores: {
      titulo,
      descricao: textoOuNull(form.descricao),
      client_id: textoOuNull(form.client_id),
      responsavel_id: textoOuNull(form.responsavel_id),
      tipo: form.tipo,
      status: form.status,
      data_entrega: textoOuNull(form.data_entrega),
    },
  }
}

export interface FiltrosTarefa {
  /** '' mostra todos os tipos */
  tipo: TaskTipo | ''
  /** Vazio mostra todos os responsáveis; com ids, só as demandas deles */
  responsaveis: string[]
}

export function filtrarTarefas(tarefas: Task[], { tipo, responsaveis }: FiltrosTarefa): Task[] {
  return tarefas.filter(
    (tarefa) =>
      (tipo === '' || tarefa.tipo === tipo) &&
      doColaborador(tarefa.responsavel_id, responsaveis),
  )
}
