import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlternarVisao, useVisao } from '@/components/quadro/AlternarVisao'
import { Abas } from '@/components/ui/Abas'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { ConfirmarExclusao, MenuDeAcoes } from '@/components/ui/MenuDeAcoes'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas, porId } from '@/dados/base'
import { useColunasOpcionais } from '@/dados/esquema'
import { useExcluir } from '@/dados/excluir'
import { useCampanhas, useClientes } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import { otimizacaoPendente } from '@/lib/regras'
import { STATUS_CAMPANHA, opcao } from '@/lib/rotulos'
import type { Campaign, CampaignStatus } from '@/types/database'
import { CampanhaModal } from './CampanhaModal'
import { QuadroDeAnuncios } from './QuadroDeAnuncios'
import { TarefasDeAnuncio } from './TarefasDeAnuncio'
import { periodoDaCampanha } from './campanha'
import styles from './campanhas.module.css'

const ABAS = [
  { id: 'quadro', rotulo: 'Tarefas' },
  { id: 'campanhas', rotulo: 'Campanhas' },
] as const

type Aba = (typeof ABAS)[number]['id']

function Anuncios() {
  const campanhas = useCampanhas()
  const clientes = useClientes()
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<Campaign>()
  const [confirmando, setConfirmando] = useState<string>()
  const [status, setStatus] = useState<CampaignStatus | ''>('')
  // Excluir o anúncio leva as tarefas dele (on delete cascade no banco)
  const excluir = useExcluir<Campaign>({ tabela: 'campaigns', recarregar: ['campaign_tasks'] })
  const toast = useToast()

  function aoExcluir(campanha: Campaign) {
    setConfirmando(undefined)
    excluir.mutate(campanha.id, {
      onSuccess: () => toast.sucesso('Anúncio excluído.'),
      onError: () => toast.erro('Não foi possível excluir o anúncio.'),
    })
  }

  const consultas = juntarConsultas(campanhas, clientes)
  const lista = campanhas.data ?? []
  const visiveis = lista.filter((campanha) => status === '' || campanha.status === status)
  const clientePorId = porId(clientes.data)
  const hoje = hojeISO()

  const botaoNova = (
    <Button onClick={() => setCriando(true)}>
      <Icone nome="mais" tamanho={16} />
      Novo anúncio
    </Button>
  )

  return (
    <>
      <div className={styles.barra}>
        <Selecao
          className={styles.filtro}
          rotulo="Status"
          vazio="Todos os status"
          opcoes={STATUS_CAMPANHA}
          value={status}
          onChange={(evento) => setStatus(evento.target.value as CampaignStatus | '')}
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
          ilustracao="campanhas" titulo="Nenhum anúncio ainda."
          texto="Crie a primeira para acompanhar estratégia, tarefas e otimizações."
          acao={botaoNova}
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio ilustracao="busca" titulo="Nenhum anúncio com esse status." />
      ) : (
        <ul className={`${styles.lista} stagger`}>
          {visiveis.map((campanha) => {
            const situacao = opcao(STATUS_CAMPANHA, campanha.status)
            return (
              <li key={campanha.id} className={styles.item}>
                <div className={ui.linhaTexto}>
                  <Link to={`/app/anuncios/${campanha.id}`} className={styles.itemNome}>
                    {campanha.nome}
                  </Link>
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

function TarefasDosAnuncios() {
  const esquema = useColunasOpcionais()
  const [visao, setVisao] = useVisao('anuncios')
  // Sem a coluna de posição o quadro não tem como guardar a ordem: fica a lista
  if (esquema.pronto && !esquema.posicaoAnuncio) return <TarefasDeAnuncio />
  return (
    <>
      <div className={styles.barra}>
        <AlternarVisao visao={visao} onMudar={setVisao} />
      </div>
      {visao === 'lista' ? <TarefasDeAnuncio /> : <QuadroDeAnuncios />}
    </>
  )
}

/** Menu Anúncios: as tarefas de todos os anúncios em quadro ou lista e, na outra aba, as campanhas. */
export function CampanhasPage() {
  const [aba, setAba] = useState<Aba>('quadro')
  return (
    <div className={styles.pagina}>
      <Abas rotulo="Seções de anúncios" abas={ABAS} ativa={aba} onMudar={setAba}>
        {aba === 'campanhas' ? <Anuncios /> : <TarefasDosAnuncios />}
      </Abas>
    </div>
  )
}
