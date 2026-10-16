import { ConfigurarOpcoes } from '@/components/quadro/ConfigurarOpcoes'
import opcoesCss from '@/components/quadro/opcoes.module.css'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useOpcoes } from '@/dados/opcoes'
import { useTarefas } from '@/dados/tabelas'
import { TIPOS_TAREFA } from '@/lib/rotulos'

/** Áreas das demandas: as de fábrica e as criadas pela equipe na engrenagem (migration 0010). */
export function useAreas() {
  const areas = useOpcoes('area', TIPOS_TAREFA)
  const tarefas = useTarefas()
  /** Quantas demandas usam a área, para avisar antes de remover */
  const emUso = (valor: string) => (tarefas.data ?? []).filter((tarefa) => tarefa.tipo === valor).length
  return { ...areas, emUso }
}

interface CampoDeAreaProps {
  value: string
  onChange: (valor: string) => void
  /** Texto da opção vazia; sem ele, a área é obrigatória */
  vazio?: string
}

/** Seletor de área com a engrenagem para criar, renomear, colorir e remover áreas. */
export function CampoDeArea({ value, onChange, vazio }: CampoDeAreaProps) {
  const areas = useAreas()
  return (
    <div className={opcoesCss.comEngrenagem}>
      <StatusSelect rotulo="Área" vazio={vazio} opcoes={areas.opcoes} value={value} onChange={onChange} />
      <ConfigurarOpcoes
        campo="áreas"
        opcoes={areas.opcoes}
        edicao={areas.edicao}
        emUso={areas.emUso}
        unidade={['demanda', 'demandas']}
      />
    </div>
  )
}
