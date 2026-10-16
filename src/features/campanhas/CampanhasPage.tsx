import { useState } from 'react'
import { AlternarVisao, useVisao } from '@/components/quadro/AlternarVisao'
import { PainelDeVolume } from '@/components/graficos/PainelDeVolume'
import { Abas } from '@/components/ui/Abas'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { ConfirmarExclusao, MenuDeAcoes } from '@/components/ui/MenuDeAcoes'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas, porId } from '@/dados/base'
import { useColunasDoQuadro } from '@/dados/colunas'
import { useColunasOpcionais } from '@/dados/esquema'
import { useExcluir } from '@/dados/excluir'
import { useCampanhas, useClientes, usePerfis, useTarefasDeCampanha } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import { otimizacaoPendente } from '@/lib/regras'
import { COLUNAS_ANUNCIO, STATUS_CAMPANHA, opcao } from '@/lib/rotulos'
import type { Campaign, CampaignStatus } from '@/types/database'
import { CampanhaDrawer } from './CampanhaDrawer'
import { CampanhaModal } from './CampanhaModal'
import { QuadroDeAnuncios } from './QuadroDeAnuncios'
import { TarefasDeAnuncio } from './TarefasDeAnuncio'
import { clienteDaDemanda, periodoDaCampanha } from './campanha'
import styles from './campanhas.module.css'

const ABAS = [
  { id: 'quadro', rotulo: 'Demandas' },
  { id: 'campanhas', rotulo: 'Campanhas' },
] as const

type Aba = (typeof ABAS)[number]['id']

/** Aba Campanhas: a lista por cliente; cada campanha abre no painel com o histórico. */
function Campanhas() {
  const campanhas = useCampanhas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const [criando, setCriando] = useState(false)
  const [abertaId, setAbertaId] = useState<string>()
  const [clienteId, setClienteId] = useState('')
  const [editando, setEditando] = useState<Campaign>()
  const [confirmando, setConfirmando] = useState<string>()
  const [status, setStatus] = useState<CampaignStatus | ''>('')
  // Excluir o anúncio leva as tarefas dele (on delete cascade no banco)
  const excluir = useExcluir<Campaign>({ tabela: 'campaigns', recarregar: ['campaign_tasks'] })
  const toast = useToast()

  function aoExcluir(campanha: Campaign) {
    setConfirmando(undefined)
    excluir.mutate(campanha.id, {
      onSuccess: () => toast.sucesso('Campanha excluída.'),
      onError: () => toast.erro('Não foi possível excluir a campanha.'),
    })
  }

  const consultas = juntarConsultas(campanhas, clientes)
  const lista = campanhas.data ?? []
  const visiveis = lista.filter(
    (campanha) => (status === '' || campanha.status === status) && (clienteId === '' || campanha.client_id === clienteId),
  )
  const aberta = lista.find((campanha) => campanha.id === abertaId)
  const clientePorId = porId(clientes.data)
  const hoje = hojeISO()

  const botaoNova = (
    <Button onClick={() => setCriando(true)}>
      <Icone nome="mais" tamanho={16} />
      Nova campanha
    </Button>
  )

  return (
    <>
      <div className={styles.barra}>
        <Selecao
          className={styles.filtro}
          rotulo="Cliente"
          vazio="Todos os clientes"
          opcoes={(clientes.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))}
          value={clienteId}
          onChange={(evento) => setClienteId(evento.target.value)}
        />
        <StatusSelect
          className={styles.filtro}
          rotulo="Status"
          vazio="Todos os status"
          opcoes={STATUS_CAMPANHA}
          value={status}
          onChange={(valor) => setStatus(valor as CampaignStatus | '')}
        />
        {botaoNova}
      </div>

      {consultas.erro ? (
        <EstadoErro onTentar={consultas.tentar} />
      ) : consultas.carregando ? (
        <div className={styles.lista} aria-busy="true">
          <Skeleton altura="76px" raio="var(--radius)" />
          <Skeleton altura="76px" raio="var(--radius)" />
        </div>
      ) : lista.length === 0 ? (
        <EstadoVazio
          ilustracao="campanhas"
          titulo="Nenhuma campanha ainda."
          texto="Crie a primeira para acompanhar orçamento, estratégia e o histórico de otimizações."
          acao={botaoNova}
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio ilustracao="busca" titulo="Nenhuma campanha com esses filtros." />
      ) : (
        <ul className={`${styles.lista} stagger`}>
          {visiveis.map((campanha) => {
            const situacao = opcao(STATUS_CAMPANHA, campanha.status)
            return (
              <li key={campanha.id} className={styles.item}>
                <div className={ui.linhaTexto}>
                  <button type="button" className={styles.itemNome} onClick={() => setAbertaId(campanha.id)}>
                    {campanha.nome}
                  </button>
                  <span className={ui.mudo}>
                    {clientePorId.get(campanha.client_id)?.nome ?? 'Sem cliente'},{' '}
                    {periodoDaCampanha(campanha)}
                  </span>
                </div>
                <div className={styles.itemLado}>
                  {otimizacaoPendente(campanha, hoje) && (
                    <Pill tom="vermelho">Otimização pendente</Pill>
                  )}
                  <Pill tom={situacao.tom}>{situacao.rotulo}</Pill>
                  <MenuDeAcoes
                    className={styles.itemAcoes}
                    rotulo={`Ações de ${campanha.nome}`}
                    acoes={[
                      { rotulo: 'Editar', icone: 'editar', onEscolher: () => setEditando(campanha) },
                      {
                        rotulo: 'Excluir',
                        icone: 'lixeira',
                        perigo: true,
                        onEscolher: () => setConfirmando(campanha.id),
                      },
                    ]}
                  />
                  <span className={styles.itemValor}>{formatarMoeda(Number(campanha.orcamento))}</span>
                </div>
                {confirmando === campanha.id && (
                  <div className={styles.itemConfirmar}>
                    <ConfirmarExclusao
                      nome={campanha.nome}
                      onCancelar={() => setConfirmando(undefined)}
                      onConfirmar={() => aoExcluir(campanha)}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {criando && (
        <CampanhaModal clientes={clientes.data ?? []} onFechar={() => setCriando(false)} />
      )}
      {aberta && (
        <CampanhaDrawer
          key={aberta.id}
          campanha={aberta}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          onFechar={() => setAbertaId(undefined)}
        />
      )}
      {editando && (
        <CampanhaModal
          campanha={editando}
          clientes={clientes.data ?? []}
          onFechar={() => setEditando(undefined)}
        />
      )}
    </>
  )
}

/** Quantas demandas há em cada coluna, filtrando por cliente e período. */
function DemandasPorColuna() {
  const tarefas = useTarefasDeCampanha()
  const campanhas = useCampanhas()
  const clientes = useClientes()
  const { colunas } = useColunasDoQuadro('anuncios', COLUNAS_ANUNCIO)
  if (!tarefas.data || tarefas.data.length === 0) return null
  const campanhaPorId = porId(campanhas.data)

  return (
    <PainelDeVolume
      titulo="Demandas por coluna"
      descricao="Demandas de anúncio por coluna do quadro"
      unidade={['demanda', 'demandas']}
      clientes={clientes.data ?? []}
      colunas={colunas}
      itens={tarefas.data.map((tarefa) => ({
        coluna: tarefa.status,
        cliente: clienteDaDemanda(tarefa, campanhaPorId),
        data: tarefa.created_at,
      }))}
    />
  )
}

function TarefasDosAnuncios() {
  const esquema = useColunasOpcionais()
  const [visao, setVisao] = useVisao('anuncios')
  // Sem a coluna de posição o quadro não tem como guardar a ordem: fica a lista
  if (esquema.pronto && !esquema.posicaoAnuncio) return <TarefasDeAnuncio />
  return (
    <>
      <DemandasPorColuna />
      <div className={styles.barra}>
        <AlternarVisao visao={visao} onMudar={setVisao} />
      </div>
      {visao === 'lista' ? <TarefasDeAnuncio /> : <QuadroDeAnuncios />}
    </>
  )
}

/** Menu Anúncios: as demandas de anúncio em quadro ou lista e, na outra aba, as campanhas. */
export function CampanhasPage() {
  const [aba, setAba] = useState<Aba>('quadro')
  return (
    <div className={styles.pagina}>
      <Abas rotulo="Seções de anúncios" abas={ABAS} ativa={aba} onMudar={setAba}>
        {aba === 'campanhas' ? <Campanhas /> : <TarefasDosAnuncios />}
      </Abas>
    </div>
  )
}
