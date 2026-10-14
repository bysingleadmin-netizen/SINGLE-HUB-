import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EstadoErro } from '@/components/ui/Estado'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { useHistoricoDeAtividade } from '@/dados/atividade'
import type { ActivityLog, Profile } from '@/types/database'
import { Atividade } from './Atividade'
import { guardarExpandida, lerExpandida, registrosVisiveis, temMaisNas24h } from './atividadeRecolhivel'
import styles from './dashboard.module.css'

const LOTE = 50

interface AtividadeRecenteProps {
  registros: ActivityLog[]
  perfilPorId: Map<string, Profile>
}

function HistoricoCompleto({
  perfilPorId,
  onFechar,
}: {
  perfilPorId: Map<string, Profile>
  onFechar: () => void
}) {
  const [quantidade, setQuantidade] = useState(LOTE)
  const historico = useHistoricoDeAtividade(quantidade)
  const registros = historico.data ?? []
  // Veio o lote inteiro: pode haver mais no banco
  const podeHaverMais = registros.length === quantidade

  return (
    <Modal aberto titulo="Histórico de atividade" onFechar={onFechar}>
      {historico.isError ? (
        <EstadoErro onTentar={() => void historico.refetch()} />
      ) : historico.isLoading ? (
        <Skeleton altura="200px" />
      ) : (
        <div className={ui.formulario}>
          <Atividade registros={registros} perfilPorId={perfilPorId} />
          {podeHaverMais && (
            <Button
              variante="secundario"
              carregando={historico.isFetching}
              onClick={() => setQuantidade((atual) => atual + LOTE)}
            >
              Carregar mais
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Atividade do Dashboard: 4 últimas, as últimas 24 horas ao expandir e o histórico inteiro num modal. */
export function AtividadeRecente({ registros, perfilPorId }: AtividadeRecenteProps) {
  const [expandida, setExpandida] = useState(lerExpandida)
  const [historico, setHistorico] = useState(false)

  function alternar() {
    guardarExpandida(!expandida)
    setExpandida(!expandida)
  }

  return (
    <>
      <Atividade registros={registrosVisiveis(registros, expandida)} perfilPorId={perfilPorId} />
      <div className={styles.atividadeRodape}>
        {(expandida || temMaisNas24h(registros)) && (
          <button type="button" className={styles.atividadeAlternar} onClick={alternar}>
            {expandida ? 'Recolher' : 'Ver mais'}
          </button>
        )}
        <button type="button" className={styles.atividadeHistorico} onClick={() => setHistorico(true)}>
          Ver histórico completo
        </button>
      </div>
      {historico && <HistoricoCompleto perfilPorId={perfilPorId} onFechar={() => setHistorico(false)} />}
    </>
  )
}
