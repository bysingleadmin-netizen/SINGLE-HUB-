import { formatarData } from '@/lib/formato'
import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { parseMoeda } from '@/lib/regras'
import { FUNCOES_CAMPANHA } from '@/lib/rotulos'
import type { Campaign, CampaignFuncao, CampaignStatus, CampaignTask } from '@/types/database'

export interface FormCampanha {
  nome: string
  client_id: string
  status: CampaignStatus
  data_inicio: string
  data_fim: string
  orcamento: string
  proxima_otimizacao: string
  plataforma: string
  objetivo: string
}

export type ValoresCampanha = Pick<
  Campaign,
  | 'nome'
  | 'client_id'
  | 'status'
  | 'data_inicio'
  | 'data_fim'
  | 'orcamento'
  | 'proxima_otimizacao'
  | 'plataforma'
  | 'objetivo'
>

export function formNovaCampanha(): FormCampanha {
  return {
    nome: '',
    client_id: '',
    status: 'planejamento',
    data_inicio: '',
    data_fim: '',
    orcamento: '',
    proxima_otimizacao: '',
    plataforma: 'Meta Ads',
    objetivo: '',
  }
}

export function formDaCampanha(campanha: Campaign): FormCampanha {
  return {
    nome: campanha.nome,
    client_id: campanha.client_id,
    status: campanha.status,
    data_inicio: campanha.data_inicio ?? '',
    data_fim: campanha.data_fim ?? '',
    orcamento: Number(campanha.orcamento).toFixed(2).replace('.', ','),
    proxima_otimizacao: campanha.proxima_otimizacao ?? '',
    plataforma: campanha.plataforma ?? 'Meta Ads',
    objetivo: campanha.objetivo ?? '',
  }
}

/** `comPlataforma`: o banco já tem plataforma e objetivo (migration 0008); sem eles, os dois ficam de fora. */
export function validarCampanha(
  form: FormCampanha,
  { comPlataforma = false }: { comPlataforma?: boolean } = {},
): Validacao<ValoresCampanha, FormCampanha> {
  const erros: Erros<FormCampanha> = {}
  const nome = form.nome.trim()
  const orcamento = form.orcamento.trim() === '' ? 0 : parseMoeda(form.orcamento)

  if (nome === '') erros.nome = 'Informe o nome da campanha.'
  if (form.client_id === '') erros.client_id = 'Escolha o cliente.'
  if (orcamento == null) erros.orcamento = 'Informe um valor como 1.500,00.'
  if (form.data_inicio && form.data_fim && form.data_fim < form.data_inicio) {
    erros.data_fim = 'O fim não pode vir antes do início.'
  }
  if (Object.keys(erros).length > 0 || orcamento == null) return { erros }

  return {
    valores: {
      nome,
      client_id: form.client_id,
      status: form.status,
      data_inicio: textoOuNull(form.data_inicio),
      data_fim: textoOuNull(form.data_fim),
      orcamento,
      proxima_otimizacao: textoOuNull(form.proxima_otimizacao),
      ...(comPlataforma ? { plataforma: form.plataforma, objetivo: textoOuNull(form.objetivo) } : {}),
    },
  }
}

/** O cliente de uma demanda de anúncio: o da campanha ou, sem campanha, o da própria demanda. */
export function clienteDaDemanda(
  tarefa: Pick<CampaignTask, 'campaign_id' | 'client_id'>,
  campanhaPorId: Map<string, Pick<Campaign, 'client_id'>>,
): string | null {
  const campanha = tarefa.campaign_id ? campanhaPorId.get(tarefa.campaign_id) : undefined
  return campanha?.client_id ?? tarefa.client_id ?? null
}

export function periodoDaCampanha({
  data_inicio,
  data_fim,
}: Pick<Campaign, 'data_inicio' | 'data_fim'>): string {
  if (data_inicio && data_fim) return `${formatarData(data_inicio)} a ${formatarData(data_fim)}`
  if (data_inicio) return `A partir de ${formatarData(data_inicio)}`
  if (data_fim) return `Até ${formatarData(data_fim)}`
  return 'Sem datas'
}

export interface GrupoDeTarefas {
  funcao: CampaignFuncao
  rotulo: string
  tarefas: CampaignTask[]
}

/** As cinco funções, sempre na mesma ordem, com as tarefas da campanha em cada uma. */
export function agruparPorFuncao(tarefas: CampaignTask[], campanhaId: string): GrupoDeTarefas[] {
  const daCampanha = tarefas.filter((tarefa) => tarefa.campaign_id === campanhaId)
  return FUNCOES_CAMPANHA.map(({ valor, rotulo }) => ({
    funcao: valor,
    rotulo,
    tarefas: daCampanha.filter((tarefa) => tarefa.funcao === valor),
  }))
}
