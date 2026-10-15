import { hojeISO, somarDias } from '@/lib/datas'
import { tarefaAberta } from '@/lib/regras'
import type { Client, ContentCard, Task } from '@/types/database'

// Contas dos gráficos do Dashboard. Datas trafegam como 'AAAA-MM-DD', no fuso de quem usa.

/** O dia (local) de um carimbo de data e hora do banco */
const diaDe = (carimbo: string) => hojeISO(new Date(carimbo))

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export interface Barra {
  chave: string
  rotulo: string
  valor: number
}

/** Demandas em aberto por cliente, as `limite` maiores; demandas sem cliente ficam de fora. */
export function cardsPorCliente(
  tarefas: Pick<Task, 'status' | 'client_id' | 'archived_at'>[],
  clientes: Pick<Client, 'id' | 'nome'>[],
  limite = 6,
): Barra[] {
  const contagem = new Map<string, number>()
  for (const tarefa of tarefas) {
    if (!tarefa.client_id || !tarefaAberta(tarefa) || tarefa.archived_at) continue
    contagem.set(tarefa.client_id, (contagem.get(tarefa.client_id) ?? 0) + 1)
  }
  const nomes = new Map(clientes.map((cliente) => [cliente.id, cliente.nome]))
  return [...contagem]
    .map(([chave, valor]) => ({ chave, rotulo: nomes.get(chave) ?? 'Cliente removido', valor }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo))
    .slice(0, limite)
}

export interface PontoDoDia {
  /** 'AAAA-MM-DD' */
  mes: string
  rotulo: string
  valor: number
}

/** Demandas e conteúdos criados em cada um dos últimos `dias` dias, do mais antigo a hoje. */
export function atividadeDaSemana(
  tarefas: Pick<Task, 'created_at'>[],
  cards: Pick<ContentCard, 'created_at'>[],
  hoje: string,
  dias = 7,
): PontoDoDia[] {
  const porDia = new Map<string, number>()
  for (const item of [...tarefas, ...cards]) {
    const dia = diaDe(item.created_at)
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1)
  }
  return Array.from({ length: dias }, (_, i) => {
    const dia = somarDias(hoje, i - (dias - 1))
    const semana = DIAS[new Date(`${dia}T12:00:00`).getDay()]
    return { mes: dia, rotulo: `${semana} ${Number(dia.slice(8))}`, valor: porDia.get(dia) ?? 0 }
  })
}

/** O último dia de cada uma das últimas `semanas` semanas, terminando hoje */
export function fimDasSemanas(hoje: string, semanas = 4): string[] {
  return Array.from({ length: semanas }, (_, i) => somarDias(hoje, -7 * (semanas - 1 - i)))
}

type CardDoQuadro = Pick<Task, 'status' | 'created_at' | 'concluded_at' | 'archived_at'>

/**
 * A demanda estava em aberto no fim do dia `dia`? Reconstrói pelo que o banco guarda: quando foi
 * criada, concluída e arquivada. Concluída sem data registrada conta como concluída desde sempre.
 */
function abertaEm(tarefa: CardDoQuadro, dia: string): boolean {
  if (diaDe(tarefa.created_at) > dia) return false
  if (tarefa.archived_at && diaDe(tarefa.archived_at) <= dia) return false
  if (tarefa.concluded_at) return diaDe(tarefa.concluded_at) > dia
  return tarefaAberta(tarefa)
}

export interface Tendencias {
  clientesAtivos: number[]
  demandasAbertas: number[]
}

/**
 * Como cada indicador estava no fim de cada uma das últimas quatro semanas, contado como o
 * indicador conta, para o último ponto ser o número do card. Clientes ativos usam a data de
 * cadastro e o status de hoje (o banco não guarda quando o status mudou).
 */
export function tendenciasDosIndicadores(
  clientes: Pick<Client, 'status' | 'created_at'>[],
  tarefas: CardDoQuadro[],
  hoje: string,
): Tendencias {
  const dias = fimDasSemanas(hoje)
  return {
    clientesAtivos: dias.map(
      (dia) => clientes.filter((c) => c.status === 'ativo' && diaDe(c.created_at) <= dia).length,
    ),
    demandasAbertas: dias.map((dia) => tarefas.filter((t) => abertaEm(t, dia)).length),
  }
}
