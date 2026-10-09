import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas, porId, useAtualizarOtimista } from '@/dados/base'
import { useRegistrarOtimizacao } from '@/dados/otimizacao'
import { useCampanhas, useClientes, usePerfis, useTarefasDeCampanha } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { textoOuNull } from '@/lib/formulario'
import { otimizacaoPendente } from '@/lib/regras'
import { STATUS_CAMPANHA, opcao } from '@/lib/rotulos'
import type { Campaign } from '@/types/database'
import { CampanhaModal } from './CampanhaModal'
import { TarefasDaCampanha } from './TarefasDaCampanha'
import { periodoDaCampanha } from './campanha'
import styles from './campanhas.module.css'

function Estrategia({ campanha }: { campanha: Campaign }) {
  const [texto, setTexto] = useState(campanha.estrategia ?? '')
  const atualizar = useAtualizarOtimista<Campaign>('campaigns')
  const toast = useToast()

  function salvar() {
    const nova = textoOuNull(texto)
    if (nova === (campanha.estrategia ?? null)) return
    atualizar.mutate(
      { id: campanha.id, valores: { estrategia: nova } },
      {
        onSuccess: () => toast.sucesso('Estratégia salva.'),
        onError: () => toast.erro('Não foi possível salvar a estratégia.'),
      },
    )
  }

  return (
    <div className={ui.painel}>
      <AreaTexto
        rotulo="Estratégia da campanha"
        rows={6}
        placeholder="Público, oferta, canais e o que se espera do resultado. Salva ao sair do campo."
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        onBlur={salvar}
      />
    </div>
  )
}

export function CampanhaPage() {
  const { id } = useParams()
  const campanhas = useCampanhas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const tarefas = useTarefasDeCampanha()
  const { registrar, registrando } = useRegistrarOtimizacao()
  const [editando, setEditando] = useState(false)

  const consultas = juntarConsultas(campanhas, clientes, perfis, tarefas)
  const campanha = campanhas.data?.find((c) => c.id === id)
  const hoje = hojeISO()

  if (consultas.erro) return <EstadoErro onTentar={consultas.tentar} />

  if (consultas.carregando) {
    return (
      <div className={styles.pagina} aria-busy="true">
        <Skeleton altura="140px" raio="var(--radius)" />
        <Skeleton altura="200px" raio="var(--radius)" />
      </div>
    )
  }

  if (!campanha) {
    return (
      <EstadoVazio
        ilustracao="busca" titulo="Campanha não encontrada."
        texto="Ela pode ter sido removida ou o endereço está incorreto."
        acao={
          <Link to="/app/campanhas" className={ui.linkAcao}>
            Voltar para Campanhas
          </Link>
        }
      />
    )
  }

  const status = opcao(STATUS_CAMPANHA, campanha.status)
  const pendente = otimizacaoPendente(campanha, hoje)

  return (
    <div className={styles.pagina}>
      <Link to="/app/campanhas" className={styles.voltar}>
        <Icone nome="voltar" tamanho={16} />
        Voltar para Campanhas
      </Link>

      <div className={ui.painel}>
        <div className={styles.cabecalho}>
          <div className={styles.cabecalhoTitulo}>
            <h2>{campanha.nome}</h2>
            <Pill tom={status.tom}>{status.rotulo}</Pill>
          </div>
          <div className={styles.cabecalhoAcoes}>
            <Button variante="secundario" onClick={() => setEditando(true)}>
              Editar
            </Button>
            <Button disabled={registrando} onClick={() => registrar(campanha)}>
              Registrar otimização
            </Button>
          </div>
        </div>

        <dl className={styles.dados}>
          <div>
            <dt>Cliente</dt>
            <dd>{porId(clientes.data).get(campanha.client_id)?.nome ?? 'Sem cliente'}</dd>
          </div>
          <div>
            <dt>Período</dt>
            <dd>{periodoDaCampanha(campanha)}</dd>
          </div>
          <div>
            <dt>Orçamento</dt>
            <dd>{formatarMoeda(Number(campanha.orcamento))}</dd>
          </div>
          <div>
            <dt>Próxima otimização</dt>
            <dd>
              {campanha.proxima_otimizacao
                ? formatarData(campanha.proxima_otimizacao)
                : 'Sem data'}
            </dd>
          </div>
        </dl>

        {pendente && (
          <p className={styles.alerta}>
            <Icone nome="alerta" tamanho={18} />
            Otimização pendente desde {formatarData(campanha.proxima_otimizacao)}.
          </p>
        )}
      </div>

      <Estrategia key={campanha.id} campanha={campanha} />

      <h2 className={styles.titulo}>Tarefas por função</h2>
      <TarefasDaCampanha
        campanhaId={campanha.id}
        tarefas={tarefas.data ?? []}
        perfis={perfis.data ?? []}
      />

      {editando && (
        <CampanhaModal
          campanha={campanha}
          clientes={clientes.data ?? []}
          onFechar={() => setEditando(false)}
        />
      )}
    </div>
  )
}
