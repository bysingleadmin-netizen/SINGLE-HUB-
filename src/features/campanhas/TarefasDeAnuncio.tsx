import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiltroDeColaboradores } from '@/components/quadro/FiltroDeColaboradores'
import { TabelaDeTarefas } from '@/components/quadro/TabelaDeTarefas'
import type { ColunaDaTabela } from '@/components/quadro/TabelaDeTarefas'
import { CelulaCliente, CelulaPessoa, CelulaTitulo } from '@/components/quadro/celulas'
import { doColaborador } from '@/components/quadro/colunas'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { juntarConsultas, porId } from '@/dados/base'
import { useCampanhas, useClientes, usePerfis, useTarefasDeCampanha } from '@/dados/tabelas'
import { useCriar } from '@/features/criar/CriacaoContext'
import { FUNCOES_CAMPANHA, STATUS_TAREFA_CAMPANHA, opcao } from '@/lib/rotulos'
import type { CampaignTask } from '@/types/database'
import styles from './campanhas.module.css'

/** Todas as tarefas de anúncio em uma lista só, sem precisar abrir anúncio por anúncio. */
export function TarefasDeAnuncio() {
  const tarefas = useTarefasDeCampanha()
  const campanhas = useCampanhas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const criar = useCriar()
  const navigate = useNavigate()
  const [responsaveis, setResponsaveis] = useState<string[]>([])

  const consultas = juntarConsultas(tarefas, campanhas, clientes, perfis)
  if (consultas.erro) return <EstadoErro onTentar={consultas.tentar} />
  if (consultas.carregando) return <Skeleton altura="220px" raio="var(--radius)" />

  const campanhaPorId = porId(campanhas.data)
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const todas = tarefas.data ?? []
  const visiveis = todas.filter((tarefa) => doColaborador(tarefa.responsavel_id, responsaveis))
  const campanhaDa = (tarefa: CampaignTask) => campanhaPorId.get(tarefa.campaign_id)
  const clienteDa = (tarefa: CampaignTask) => {
    const campanha = campanhaDa(tarefa)
    return campanha ? clientePorId.get(campanha.client_id) : undefined
  }
  const responsavelDa = (tarefa: CampaignTask) =>
    tarefa.responsavel_id ? perfilPorId.get(tarefa.responsavel_id) : undefined

  const colunas: ColunaDaTabela<CampaignTask>[] = [
    {
      chave: 'titulo',
      titulo: 'Tarefa',
      render: (t) => <CelulaTitulo>{t.titulo}</CelulaTitulo>,
      ordem: (t) => t.titulo,
    },
    {
      chave: 'status',
      titulo: 'Status',
      render: (t) => {
        const status = opcao(STATUS_TAREFA_CAMPANHA, t.status)
        return <Pill tom={status.tom}>{status.rotulo}</Pill>
      },
      ordem: (t) => STATUS_TAREFA_CAMPANHA.findIndex((s) => s.valor === t.status),
    },
    {
      chave: 'funcao',
      titulo: 'Função',
      render: (t) => FUNCOES_CAMPANHA.find((f) => f.valor === t.funcao)?.rotulo ?? t.funcao,
      ordem: (t) => t.funcao,
    },
    {
      chave: 'responsavel',
      titulo: 'Responsável',
      render: (t) => <CelulaPessoa perfil={responsavelDa(t)} />,
      ordem: (t) => responsavelDa(t)?.nome ?? null,
    },
    {
      chave: 'anuncio',
      titulo: 'Anúncio',
      render: (t) => campanhaDa(t)?.nome ?? 'Anúncio removido',
      ordem: (t) => campanhaDa(t)?.nome ?? null,
    },
    {
      chave: 'cliente',
      titulo: 'Cliente',
      render: (t) => <CelulaCliente cliente={clienteDa(t)} />,
      ordem: (t) => clienteDa(t)?.nome ?? null,
    },
  ]

  return (
    <>
      <div className={styles.barra}>
        <FiltroDeColaboradores
          perfis={perfis.data ?? []}
          selecionados={responsaveis}
          onMudar={setResponsaveis}
        />
        <Button variante="secundario" onClick={() => criar({ categoria: 'campanha' })}>
          <Icone nome="mais" tamanho={16} />
          Nova tarefa
        </Button>
      </div>
      {todas.length === 0 ? (
        <EstadoVazio
          ilustracao="quadro"
          titulo="Nenhuma tarefa de anúncio ainda."
          texto="Crie pela categoria Tarefa de anúncio, no botão Criar, ou dentro de um anúncio."
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio ilustracao="busca" titulo="Nenhuma tarefa com esse filtro." />
      ) : (
        <TabelaDeTarefas
          rotulo="Tarefas de anúncio"
          itens={visiveis}
          colunas={colunas}
          tituloDe={(tarefa) => tarefa.titulo}
          ordemInicial="status"
          onAbrir={(tarefa) => navigate(`/app/anuncios/${tarefa.campaign_id}`)}
        />
      )}
    </>
  )
}
