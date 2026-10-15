import { useState } from 'react'
import { FiltroDeColaboradores } from '@/components/quadro/FiltroDeColaboradores'
import { TabelaDeTarefas } from '@/components/quadro/TabelaDeTarefas'
import type { ColunaDaTabela } from '@/components/quadro/TabelaDeTarefas'
import { CelulaCliente, CelulaPessoa, CelulaTitulo } from '@/components/quadro/celulas'
import { doColaborador } from '@/components/quadro/colunas'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { MenuAcoes } from '@/components/ui/MenuDeAcoes'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { juntarConsultas, porId } from '@/dados/base'
import { useColunasDoQuadro } from '@/dados/colunas'
import { useExcluir } from '@/dados/excluir'
import { useCampanhas, useClientes, usePerfis, useTarefasDeCampanha } from '@/dados/tabelas'
import { useCriar } from '@/features/criar/CriacaoContext'
import { COLUNAS_ANUNCIO, FUNCOES_CAMPANHA, opcao } from '@/lib/rotulos'
import type { CampaignTask } from '@/types/database'
import { DemandaDeAnuncioDrawer } from './DemandaDeAnuncioDrawer'
import { clienteDaDemanda } from './campanha'
import styles from './campanhas.module.css'
import { useStatusDeAnuncio } from './statusDeAnuncio'

/** Todas as demandas de anúncio em uma lista só, com ou sem campanha. */
export function TarefasDeAnuncio() {
  const tarefas = useTarefasDeCampanha()
  const campanhas = useCampanhas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const criar = useCriar()
  const [abertaId, setAbertaId] = useState<string>()
  const { colunas: colunasDoQuadro } = useColunasDoQuadro('anuncios', COLUNAS_ANUNCIO)
  const statusDeAnuncio = useStatusDeAnuncio()
  const excluir = useExcluir<CampaignTask>({ tabela: 'campaign_tasks' })
  const toast = useToast()
  const [responsaveis, setResponsaveis] = useState<string[]>([])

  const consultas = juntarConsultas(tarefas, campanhas, clientes, perfis)
  if (consultas.erro) return <EstadoErro onTentar={consultas.tentar} />
  if (consultas.carregando) return <Skeleton altura="220px" raio="var(--radius)" />

  const campanhaPorId = porId(campanhas.data)
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const todas = tarefas.data ?? []
  const visiveis = todas.filter((tarefa) => doColaborador(tarefa.responsavel_id, responsaveis))
  const aberta = todas.find((tarefa) => tarefa.id === abertaId)
  const campanhaDa = (tarefa: CampaignTask) => (tarefa.campaign_id ? campanhaPorId.get(tarefa.campaign_id) : undefined)
  const clienteDa = (tarefa: CampaignTask) => {
    const id = clienteDaDemanda(tarefa, campanhaPorId)
    return id ? clientePorId.get(id) : undefined
  }
  const responsavelDa = (tarefa: CampaignTask) =>
    tarefa.responsavel_id ? perfilPorId.get(tarefa.responsavel_id) : undefined

  const colunas: ColunaDaTabela<CampaignTask>[] = [
    {
      chave: 'titulo',
      titulo: 'Demanda',
      render: (t) => <CelulaTitulo>{t.titulo}</CelulaTitulo>,
      ordem: (t) => t.titulo,
    },
    {
      chave: 'status',
      titulo: 'Status',
      render: (t) => {
        const status = opcao(statusDeAnuncio, t.status)
        return <Pill tom={status.tom}>{status.rotulo}</Pill>
      },
      ordem: (t) => statusDeAnuncio.findIndex((s) => s.valor === t.status),
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
      titulo: 'Campanha',
      render: (t) => campanhaDa(t)?.nome ?? 'Sem campanha',
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
          Nova demanda
        </Button>
      </div>
      {todas.length === 0 ? (
        <EstadoVazio
          ilustracao="quadro"
          titulo="Nenhuma demanda de anúncio ainda."
          texto="Crie pelo botão Criar, escolhendo Anúncio. A campanha é opcional."
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio ilustracao="busca" titulo="Nenhuma demanda com esse filtro." />
      ) : (
        <TabelaDeTarefas
          rotulo="Demandas de anúncio"
          itens={visiveis}
          colunas={colunas}
          tituloDe={(tarefa) => tarefa.titulo}
          ordemInicial="status"
          onAbrir={(tarefa) => setAbertaId(tarefa.id)}
          acoes={(tarefa) => (
            <MenuAcoes
              nome={tarefa.titulo}
              onEditar={() => setAbertaId(tarefa.id)}
              onExcluir={() =>
                excluir.mutate(tarefa.id, {
                  onSuccess: () => toast.sucesso('Demanda de anúncio excluída.'),
                  onError: () => toast.erro('Não foi possível excluir a demanda de anúncio.'),
                })
              }
            />
          )}
        />
      )}
      {aberta && (
        <DemandaDeAnuncioDrawer
          key={aberta.id}
          tarefa={aberta}
          campanhas={campanhas.data ?? []}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          colunas={colunasDoQuadro}
          onFechar={() => setAbertaId(undefined)}
        />
      )}
    </>
  )
}
