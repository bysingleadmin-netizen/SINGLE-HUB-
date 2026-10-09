import type {
  CampaignFuncao,
  CampaignStatus,
  CampaignTaskStatus,
  ClientStatus,
  ContentEtapa,
  PaymentStatus,
  TaskStatus,
  TaskTipo,
  TipoConteudo,
} from '@/types/database'

export type Tom = 'verde' | 'amarelo' | 'vermelho' | 'cinza' | 'azul' | 'roxo'

interface Opcao<T extends string> {
  valor: T
  rotulo: string
  tom: Tom
}

export const STATUS_CLIENTE: readonly Opcao<ClientStatus>[] = [
  { valor: 'ativo', rotulo: 'Ativo', tom: 'verde' },
  { valor: 'pausado', rotulo: 'Pausado', tom: 'amarelo' },
  { valor: 'churn', rotulo: 'Churn', tom: 'vermelho' },
]

export const STATUS_PAGAMENTO: readonly Opcao<PaymentStatus>[] = [
  { valor: 'pendente', rotulo: 'Pendente', tom: 'amarelo' },
  { valor: 'pago', rotulo: 'Pago', tom: 'verde' },
  { valor: 'atrasado', rotulo: 'Atrasado', tom: 'vermelho' },
]

// Cores pedidas no briefing: Conteúdo #4a9eff, Tráfego #e63030, Estratégia #a855f7, Audiovisual #e6a630
export const TIPOS_TAREFA: readonly Opcao<TaskTipo>[] = [
  { valor: 'conteudo', rotulo: 'Conteúdo', tom: 'azul' },
  { valor: 'trafego', rotulo: 'Tráfego', tom: 'vermelho' },
  { valor: 'estrategia', rotulo: 'Estratégia', tom: 'roxo' },
  { valor: 'audiovisual', rotulo: 'Audiovisual', tom: 'amarelo' },
]

/** Colunas do quadro de Demandas. 'arquivado' existe no banco mas não é coluna. */
export const COLUNAS_TAREFA: readonly { id: TaskStatus; titulo: string }[] = [
  { id: 'a_fazer', titulo: 'A Fazer' },
  { id: 'em_andamento', titulo: 'Em Andamento' },
  { id: 'aguardando_aprovacao', titulo: 'Aguardando Aprovação' },
  { id: 'concluido', titulo: 'Concluído' },
]

export const TIPOS_CONTEUDO: readonly Opcao<TipoConteudo>[] = [
  { valor: 'reels', rotulo: 'Reels', tom: 'roxo' },
  { valor: 'carrossel', rotulo: 'Carrossel', tom: 'azul' },
  { valor: 'post', rotulo: 'Post', tom: 'cinza' },
  { valor: 'stories', rotulo: 'Stories', tom: 'amarelo' },
  { valor: 'video', rotulo: 'Vídeo', tom: 'vermelho' },
]

export const COLUNAS_CONTEUDO: readonly { id: ContentEtapa; titulo: string }[] = [
  { id: 'captar_material', titulo: 'Captar Material' },
  { id: 'editar', titulo: 'Editar' },
  { id: 'aguardando_aprovacao', titulo: 'Aguardando Aprovação' },
  { id: 'publicado', titulo: 'Publicado' },
]

export const STATUS_CAMPANHA: readonly Opcao<CampaignStatus>[] = [
  { valor: 'planejamento', rotulo: 'Planejamento', tom: 'cinza' },
  { valor: 'em_execucao', rotulo: 'Em execução', tom: 'verde' },
  { valor: 'pausada', rotulo: 'Pausada', tom: 'amarelo' },
  { valor: 'finalizada', rotulo: 'Finalizada', tom: 'azul' },
]

export const FUNCOES_CAMPANHA: readonly { valor: CampaignFuncao; rotulo: string }[] = [
  { valor: 'copy', rotulo: 'Copy' },
  { valor: 'criativos', rotulo: 'Criativos' },
  { valor: 'captacao_material', rotulo: 'Captação de Material' },
  { valor: 'trafego', rotulo: 'Tráfego' },
  { valor: 'estrategia', rotulo: 'Estratégia' },
]

export const STATUS_TAREFA_CAMPANHA: readonly Opcao<CampaignTaskStatus>[] = [
  { valor: 'pendente', rotulo: 'Pendente', tom: 'cinza' },
  { valor: 'em_andamento', rotulo: 'Em andamento', tom: 'amarelo' },
  { valor: 'concluido', rotulo: 'Concluído', tom: 'verde' },
]

export function opcao<T extends string>(lista: readonly Opcao<T>[], valor: T): Opcao<T> {
  return lista.find((o) => o.valor === valor) ?? { valor, rotulo: valor, tom: 'cinza' }
}
