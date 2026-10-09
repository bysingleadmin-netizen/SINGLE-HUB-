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
import { useNotificar } from '@/dados/notificacoes'
import { useCampanhas, useClientes, usePerfis } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { opcoesDePessoas } from '@/lib/pessoas'
import { FUNCOES_CAMPANHA } from '@/lib/rotulos'
import type { CampaignFuncao, CampaignTask } from '@/types/database'

interface FormTarefaDeCampanhaProps {
  campanhaInicial: string
  funcaoInicial: CampaignFuncao
  onFechar: () => void
}

/** Campos e gravação de uma tarefa dentro de uma campanha. */
export function FormTarefaDeCampanha({
  campanhaInicial,
  funcaoInicial,
  onFechar,
}: FormTarefaDeCampanhaProps) {
  const { perfil } = useAuth()
  const campanhas = useCampanhas()
  const perfis = usePerfis()
  // Carregada também aqui para as três categorias abrirem com as mesmas listas prontas
  useClientes()
  const [campanhaId, setCampanhaId] = useState(campanhaInicial)
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
      campanha: campanhaId === '' ? 'Escolha o anúncio.' : undefined,
      titulo: limpo === '' ? 'Informe o título da tarefa.' : undefined,
    }
    setErros(novos)
    if (novos.campanha || novos.titulo) return

    salvar.mutate(
      {
        valores: {
          campaign_id: campanhaId,
          funcao,
          titulo: limpo,
          status: 'pendente',
          responsavel_id: responsavelId || null,
        },
      },
      {
        onSuccess: (salva) => {
          toast.sucesso('Tarefa adicionada ao anúncio.')
          void registrarAtividade({
            acao: 'tarefa_de_anuncio_criada',
            descricao: `criou a tarefa de anúncio "${salva.titulo}"`,
            entidade: 'campaigns',
            entidadeId: salva.campaign_id,
          })
          void notificar([salva.responsavel_id], {
            tipo: 'tarefa',
            titulo: 'Nova tarefa de anúncio para você',
            mensagem: `${perfil?.nome ?? 'Alguém'} atribuiu a tarefa "${salva.titulo}" a você.`,
            link: `/app/anuncios/${salva.campaign_id}`,
          })
          onFechar()
        },
        onError: () => toast.erro('Não foi possível adicionar a tarefa.'),
      },
    )
  }

  if (campanhas.isSuccess && campanhas.data.length === 0) {
    return (
      <>
        <p>Crie um anúncio antes de adicionar tarefas a ele.</p>
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
          rotulo="Anúncio"
          vazio="Escolha o anúncio"
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
