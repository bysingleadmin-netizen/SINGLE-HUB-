import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useSalvar } from '@/dados/base'
import { useColunasOpcionais } from '@/dados/esquema'
import { useNotificar } from '@/dados/notificacoes'
import { useCampanhas, useClientes, usePerfis } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { opcoesDePessoas } from '@/lib/pessoas'
import { FUNCOES_CAMPANHA } from '@/lib/rotulos'
import type { CampaignFuncao, CampaignTask, CampaignTaskStatus } from '@/types/database'

interface FormTarefaDeCampanhaProps {
  campanhaInicial: string
  funcaoInicial: CampaignFuncao
  /** Coluna do quadro de Anúncios em que a tarefa nasce */
  statusInicial: CampaignTaskStatus
  onFechar: () => void
}

/** Campos e gravação de uma demanda de anúncio. Depois da migration 0008, a campanha é opcional. */
export function FormTarefaDeCampanha({
  campanhaInicial,
  funcaoInicial,
  statusInicial,
  onFechar,
}: FormTarefaDeCampanhaProps) {
  const { perfil } = useAuth()
  const campanhas = useCampanhas()
  const perfis = usePerfis()
  const clientes = useClientes()
  const esquema = useColunasOpcionais()
  // Sem a migration 0008 o banco ainda exige a campanha
  const campanhaOpcional = esquema.demandaSemCampanha
  const [campanhaId, setCampanhaId] = useState(campanhaInicial)
  const [clienteId, setClienteId] = useState('')
  const [funcao, setFuncao] = useState<CampaignFuncao>(funcaoInicial)
  const [titulo, setTitulo] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [erros, setErros] = useState<{ campanha?: string; titulo?: string }>({})
  const salvar = useSalvar<CampaignTask>('campaign_tasks')
  const notificar = useNotificar()
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = titulo.trim()
    const novos = {
      campanha: campanhaId === '' && !campanhaOpcional ? 'Escolha a campanha.' : undefined,
      titulo: limpo === '' ? 'Informe o título da demanda.' : undefined,
    }
    setErros(novos)
    if (novos.campanha || novos.titulo) return

    salvar.mutate(
      {
        valores: {
          campaign_id: campanhaId || null,
          // Com campanha, o cliente vem dela; sem, fica na própria demanda
          ...(campanhaOpcional ? { client_id: campanhaId ? null : clienteId || null } : {}),
          funcao,
          titulo: limpo,
          status: statusInicial,
          responsavel_id: responsavelId || null,
        },
      },
      {
        onSuccess: (salva) => {
          toast.sucesso('Demanda de anúncio criada.')
          void registrarAtividade({
            acao: 'tarefa_de_anuncio_criada',
            descricao: `criou a demanda de anúncio "${salva.titulo}"`,
            entidade: salva.campaign_id ? 'campaigns' : 'campaign_tasks',
            entidadeId: salva.campaign_id ?? salva.id,
          })
          void notificar([salva.responsavel_id], {
            tipo: 'tarefa',
            titulo: 'Nova demanda de anúncio para você',
            mensagem: `${perfil?.nome ?? 'Alguém'} atribuiu a demanda "${salva.titulo}" a você.`,
            link: salva.campaign_id ? `/app/anuncios/${salva.campaign_id}` : '/app/anuncios',
          })
          onFechar()
        },
        onError: () => toast.erro('Não foi possível criar a demanda de anúncio.'),
      },
    )
  }

  if (!campanhaOpcional && esquema.pronto && campanhas.isSuccess && campanhas.data.length === 0) {
    return (
      <>
        <p>Crie uma campanha antes de adicionar demandas a ela.</p>
        <Link to="/app/anuncios" className={ui.linkAcao} onClick={onFechar}>
          Ir para Anúncios
        </Link>
      </>
    )
  }

  return (
    <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
      <div className={ui.duasColunas}>
        <Selecao
          rotulo="Campanha"
          vazio={campanhaOpcional ? 'Sem campanha' : 'Escolha a campanha'}
          opcoes={(campanhas.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))}
          value={campanhaId}
          erro={erros.campanha}
          onChange={(evento) => setCampanhaId(evento.target.value)}
        />
        <Selecao
          rotulo="Função"
          opcoes={FUNCOES_CAMPANHA}
          value={funcao}
          onChange={(evento) => setFuncao(evento.target.value as CampaignFuncao)}
        />
      </div>
      <Campo
        rotulo="Título"
        autoFocus
        value={titulo}
        erro={erros.titulo}
        onChange={(evento) => setTitulo(evento.target.value)}
      />
      {campanhaOpcional && campanhaId === '' && (
        <Selecao
          rotulo="Cliente"
          vazio="Sem cliente"
          opcoes={(clientes.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))}
          value={clienteId}
          onChange={(evento) => setClienteId(evento.target.value)}
        />
      )}
      <Selecao
        rotulo="Responsável"
        vazio="Sem responsável"
        opcoes={opcoesDePessoas(perfis.data ?? [])}
        value={responsavelId}
        onChange={(evento) => setResponsavelId(evento.target.value)}
      />
      <div className={ui.acoes}>
        <Button variante="fantasma" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" carregando={salvar.isPending}>
          Salvar
        </Button>
      </div>
    </form>
  )
}
