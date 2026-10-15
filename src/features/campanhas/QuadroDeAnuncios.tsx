import { useState } from 'react'
import { AvisoDeMigracao } from '@/components/quadro/AvisoDeMigracao'
import { CardInfo } from '@/components/quadro/CardInfo'
import { Quadro } from '@/components/quadro/Quadro'
import { progressoNoQuadro } from '@/components/quadro/colunas'
import { useMover } from '@/components/quadro/useMover'
import { EstadoErro } from '@/components/ui/Estado'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { juntarConsultas, porId } from '@/dados/base'
import { useColunasDoQuadro } from '@/dados/colunas'
import { useExcluir } from '@/dados/excluir'
import { useCampanhas, useClientes, usePerfis, useTarefasDeCampanha } from '@/dados/tabelas'
import { useCriar } from '@/features/criar/CriacaoContext'
import { COLUNAS_ANUNCIO, FUNCOES_CAMPANHA } from '@/lib/rotulos'
import type { CampaignTask } from '@/types/database'
import { DemandaDeAnuncioDrawer } from './DemandaDeAnuncioDrawer'
import { clienteDaDemanda } from './campanha'

type TarefaNoQuadro = CampaignTask & { posicao: number }

/** Demandas de anúncio em quadro, uma coluna por status. Abrir mostra o painel da demanda. */
export function QuadroDeAnuncios() {
  const tarefas = useTarefasDeCampanha()
  const campanhas = useCampanhas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const criar = useCriar()
  const [abertaId, setAbertaId] = useState<string>()
  const excluir = useExcluir<CampaignTask>({ tabela: 'campaign_tasks' })
  const toast = useToast()
  const { colunas, titulo, edicao, carregando } = useColunasDoQuadro('anuncios', COLUNAS_ANUNCIO)

  const mover = useMover<TarefaNoQuadro>({
    tabela: 'campaign_tasks',
    campo: 'status',
    sucesso: (_tarefa, destino) => `Demanda movida para ${titulo(destino)}.`,
    erro: 'Não foi possível mover a demanda.',
    atividade: (tarefa, destino) =>
      destino === 'concluido'
        ? {
            acao: 'tarefa_de_anuncio_concluida',
            descricao: `concluiu a tarefa de anúncio "${tarefa.titulo}"`,
            entidade: 'campaign_tasks',
            entidadeId: tarefa.id,
          }
        : null,
  })

  const consultas = juntarConsultas(tarefas, campanhas, clientes, perfis)
  if (consultas.erro) return <EstadoErro onTentar={consultas.tentar} />
  if (consultas.carregando) return <Skeleton altura="220px" raio="var(--radius)" />

  const campanhaPorId = porId(campanhas.data)
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const itens: TarefaNoQuadro[] = (tarefas.data ?? []).map((t) => ({ ...t, posicao: t.posicao ?? 0 }))
  const aberta = itens.find((t) => t.id === abertaId)

  return (
    <>
      {!edicao && !carregando && <AvisoDeMigracao />}
      <Quadro
        colunas={colunas}
        edicao={edicao}
        itens={itens}
        colunaDe={(tarefa) => tarefa.status}
        tituloDe={(tarefa) => tarefa.titulo}
        renderCard={(tarefa) => {
          const campanha = tarefa.campaign_id ? campanhaPorId.get(tarefa.campaign_id) : undefined
          const clienteId = clienteDaDemanda(tarefa, campanhaPorId)
          const funcao = FUNCOES_CAMPANHA.find((f) => f.valor === tarefa.funcao)
          return (
            <CardInfo
              titulo={tarefa.titulo}
              etiqueta={
                campanha ? <Pill tom="vermelho">{campanha.nome}</Pill> : <Pill tom="cinza">Sem campanha</Pill>
              }
              cliente={clienteId ? clientePorId.get(clienteId) : undefined}
              responsavel={tarefa.responsavel_id ? perfilPorId.get(tarefa.responsavel_id) : undefined}
              dataEntrega={null}
              prazo={null}
              progresso={progressoNoQuadro(tarefa.status, colunas)}
              legenda={funcao?.rotulo}
            />
          )
        }}
        onMover={(tarefa, destino) => mover(tarefa, destino, itens)}
        onCriar={(coluna) => criar({ categoria: 'campanha', statusDeAnuncio: coluna })}
        onAbrir={(tarefa) => setAbertaId(tarefa.id)}
        onExcluir={(tarefa) =>
          excluir.mutate(tarefa.id, {
            onSuccess: () => toast.sucesso('Demanda de anúncio excluída.'),
            onError: () => toast.erro('Não foi possível excluir a demanda de anúncio.'),
          })
        }
      />
      {aberta && (
        <DemandaDeAnuncioDrawer
          key={aberta.id}
          tarefa={aberta}
          campanhas={campanhas.data ?? []}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          colunas={colunas}
          onFechar={() => setAbertaId(undefined)}
        />
      )}
    </>
  )
}
