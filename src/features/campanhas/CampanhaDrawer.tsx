import { useState } from 'react'
import { Link } from 'react-router-dom'
import detalhe from '@/components/quadro/detalhe.module.css'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import ui from '@/components/ui/ui.module.css'
import { useColunasOpcionais } from '@/dados/esquema'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { otimizacaoPendente } from '@/lib/regras'
import { STATUS_CAMPANHA, opcao } from '@/lib/rotulos'
import type { Campaign, Client, Profile } from '@/types/database'
import { CampanhaModal } from './CampanhaModal'
import { HistoricoDaCampanha } from './HistoricoDaCampanha'
import styles from './campanhas.module.css'

interface CampanhaDrawerProps {
  campanha: Campaign
  clientes: Client[]
  perfis: Profile[]
  onFechar: () => void
}

/** Painel da campanha: os dados e, abaixo, a linha do tempo das otimizações. */
export function CampanhaDrawer({ campanha, clientes, perfis, onFechar }: CampanhaDrawerProps) {
  const [editando, setEditando] = useState(false)
  const esquema = useColunasOpcionais()
  const status = opcao(STATUS_CAMPANHA, campanha.status)
  const cliente = clientes.find((c) => c.id === campanha.client_id)

  return (
    <Drawer aberto titulo={campanha.nome} onFechar={onFechar}>
      <div className={detalhe.detalhe}>
        <div className={detalhe.resumo}>
          <Pill tom={status.tom}>{status.rotulo}</Pill>
          {otimizacaoPendente(campanha, hojeISO()) && <Pill tom="vermelho">Otimização pendente</Pill>}
        </div>

        <dl className={styles.painelDados}>
          <div>
            <dt>Cliente</dt>
            <dd>{cliente?.nome ?? 'Sem cliente'}</dd>
          </div>
          <div>
            <dt>Orçamento atual</dt>
            <dd>{formatarMoeda(Number(campanha.orcamento))}</dd>
          </div>
          {esquema.plataformaCampanha && (
            <>
              <div>
                <dt>Plataforma</dt>
                <dd>{campanha.plataforma ?? 'Meta Ads'}</dd>
              </div>
              <div>
                <dt>Objetivo</dt>
                <dd>{campanha.objetivo ?? 'Sem objetivo'}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Início</dt>
            <dd>{campanha.data_inicio ? formatarData(campanha.data_inicio) : 'Sem data'}</dd>
          </div>
          <div>
            <dt>Próxima otimização</dt>
            <dd>{campanha.proxima_otimizacao ? formatarData(campanha.proxima_otimizacao) : 'Sem data'}</dd>
          </div>
        </dl>

        <div className={styles.painelAcoes}>
          <Button variante="secundario" onClick={() => setEditando(true)}>
            Editar
          </Button>
          <Link to={`/app/anuncios/${campanha.id}`} className={ui.linkAcao}>
            Estratégia e tarefas
            <Icone nome="seta" tamanho={14} />
          </Link>
        </div>

        <HistoricoDaCampanha campanha={campanha} perfis={perfis} />
      </div>

      {editando && <CampanhaModal campanha={campanha} clientes={clientes} onFechar={() => setEditando(false)} />}
    </Drawer>
  )
}
