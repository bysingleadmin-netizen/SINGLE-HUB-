import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import type { Task, TaskStatus, TaskTipo } from '@/types/database'

export interface FormTarefa {
  titulo: string
  descricao: string
  client_id: string
  responsavel_id: string
  tipo: TaskTipo
  status: TaskStatus
  data_entrega: string
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
  }
}

export function formDaTarefa(tarefa: Task): FormTarefa {
  return {
    titulo: tarefa.titulo,
    descricao: tarefa.descricao ?? '',
    client_id: tarefa.client_id ?? '',
    responsavel_id: tarefa.responsavel_id ?? '',
    tipo: tarefa.tipo,
    status: tarefa.status,
    data_entrega: tarefa.data_entrega ?? '',
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
  /** '' mostra todos os responsáveis */
  responsavel: string
}

export function filtrarTarefas(tarefas: Task[], { tipo, responsavel }: FiltrosTarefa): Task[] {
  return tarefas.filter(
    (tarefa) =>
      (tipo === '' || tarefa.tipo === tipo) &&
      (responsavel === '' || tarefa.responsavel_id === responsavel),
  )
}
