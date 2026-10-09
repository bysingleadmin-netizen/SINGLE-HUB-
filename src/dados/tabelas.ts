import { useAuth } from '@/features/auth/AuthContext'
import { isLideranca } from '@/lib/permissoes'
import type {
  Campaign,
  CampaignTask,
  Client,
  ClientPayment,
  ContentCard,
  Expense,
  MonthlyGoal,
  Profile,
  Task,
  TrafficMetric,
} from '@/types/database'
import { useLista } from './base'

export const usePerfis = () => useLista<Profile>('profiles')
export const useClientes = () => useLista<Client>('clients')
export const useTarefas = () => useLista<Task>('tasks')
export const useCards = () => useLista<ContentCard>('content_cards')
export const useCampanhas = () => useLista<Campaign>('campaigns')
export const useTarefasDeCampanha = () => useLista<CampaignTask>('campaign_tasks')

/** O banco só entrega pagamentos à liderança; para os demais a consulta nem é feita. */
export function usePagamentos() {
  const { perfil } = useAuth()
  return useLista<ClientPayment>('client_payments', { ativo: isLideranca(perfil?.cargo) })
}

// Tabelas do Financeiro: como os pagamentos, só a liderança lê.
export function useDespesas() {
  const { perfil } = useAuth()
  return useLista<Expense>('expenses', { ativo: isLideranca(perfil?.cargo), ordenarPor: 'data' })
}

export function useMetas() {
  const { perfil } = useAuth()
  return useLista<MonthlyGoal>('monthly_goals', { ativo: isLideranca(perfil?.cargo), ordenarPor: 'mes' })
}

export function useMetricasDeTrafego() {
  const { perfil } = useAuth()
  return useLista<TrafficMetric>('traffic_metrics', {
    ativo: isLideranca(perfil?.cargo),
    ordenarPor: 'mes',
  })
}
