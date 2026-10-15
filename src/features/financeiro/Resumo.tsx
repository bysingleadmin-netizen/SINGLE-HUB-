import { Link } from 'react-router-dom'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { KpiCard } from '@/components/ui/KpiCard'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { useReceitasAsaas } from '@/dados/asaas'
import { porId } from '@/dados/base'
import { useClientes } from '@/dados/tabelas'
import { useTempoReal } from '@/dados/tempoReal'
import { GraficoMRR } from '@/features/dashboard/GraficoMRR'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { plural } from '@/lib/regras'
import type { ReceitaAsaas } from '@/types/database'
import {
  aReceberNoMes,
  atrasadas,
  emAtraso,
  mrrDoMes,
  proximosVencimentos,
  recebidoNoMes,
  recebimentosPorMes,
} from './asaas'
import type { VencimentoAsaas } from './asaas'
import { SemTabelaAsaas, nomeDaReceita } from './ReceitasAsaas'
import styles from './financeiro.module.css'

function Carregando() {
  return (
    <div className={styles.carregando} aria-busy="true">
      <Skeleton altura="40px" />
      <Skeleton altura="40px" />
      <Skeleton altura="40px" />
    </div>
  )
}

function quandoVence(dias: number): string {
  if (dias === 0) return 'Vence hoje'
  return dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`
}

interface VencimentosProps {
  itens: VencimentoAsaas<ReceitaAsaas>[]
  nomeDe: (receita: ReceitaAsaas) => string
  atrasados?: boolean
}

function Vencimentos({ itens, nomeDe, atrasados = false }: VencimentosProps) {
  return (
    <ul className={`${ui.lista} stagger`}>
      {itens.map(({ receita, dias }) => (
        <li key={receita.id} className={`${ui.linha} ${receita.cliente_id ? ui.linhaClicavel : ''}`}>
          <div className={ui.linhaTexto}>
            {receita.cliente_id ? (
              <Link to={`/app/clientes/${receita.cliente_id}`} className={ui.linhaTitulo}>
                {nomeDe(receita)}
              </Link>
            ) : (
              <span className={ui.linhaTitulo}>{nomeDe(receita)}</span>
            )}
            <span className={ui.mudo}>
              {[receita.descricao, receita.data_vencimento && `vencimento em ${formatarData(receita.data_vencimento)}`]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
          <span className={styles.valor}>{formatarMoeda(Number(receita.valor ?? 0))}</span>
          {atrasados ? (
            <Pill tom="vermelho">{plural(-dias, 'dia', 'dias')} de atraso</Pill>
          ) : (
            <Pill tom={dias <= 1 ? 'amarelo' : 'cinza'}>{quandoVence(dias)}</Pill>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Visão geral do Financeiro, calculada das cobranças do Asaas: quanto vence no mês, quanto já
 * entrou, quanto falta e o que está atrasado.
 */
export function Resumo() {
  const receitas = useReceitasAsaas()
  const clientes = useClientes()
  useTempoReal(['receitas_asaas'])

  if (receitas.isError || clientes.isError) {
    return (
      <EstadoErro
        onTentar={() => {
          void receitas.refetch()
          void clientes.refetch()
        }}
      />
    )
  }
  if (receitas.data === null) return <SemTabelaAsaas />

  const carregando = receitas.isLoading || clientes.isLoading
  const hoje = hojeISO()
  const mes = hoje.slice(0, 7)
  const lista = receitas.data ?? []
  const clientePorId = porId(clientes.data)
  const nomeDe = (receita: ReceitaAsaas) => nomeDaReceita(receita, clientePorId)
  const atrasos = atrasadas(lista, hoje)
  const proximos = proximosVencimentos(lista, hoje)
  const devido = emAtraso(lista)

  return (
    <>
      <div className={`${styles.kpis} stagger`}>
        <KpiCard rotulo="MRR ativo" valor={mrrDoMes(lista, mes)} formatar={formatarMoeda} carregando={carregando} />
        <KpiCard
          rotulo="Recebido no mês"
          valor={recebidoNoMes(lista, mes)}
          formatar={formatarMoeda}
          carregando={carregando}
        />
        <KpiCard
          rotulo="A receber no mês"
          valor={aReceberNoMes(lista, mes)}
          formatar={formatarMoeda}
          carregando={carregando}
        />
        <div className={styles.inadimplencia} data-alerta={devido.cobrancas > 0 || undefined}>
          <KpiCard rotulo="Em atraso" valor={devido.total} formatar={formatarMoeda} carregando={carregando} />
          {!carregando && (
            <p className={styles.inadimplenciaLegenda}>
              {devido.cobrancas === 0
                ? 'Nenhuma cobrança vencida'
                : `${plural(devido.cobrancas, 'cobrança vencida', 'cobranças vencidas')} de ${plural(devido.clientes, 'cliente', 'clientes')}`}
            </p>
          )}
        </div>
      </div>

      <Painel titulo="Recebimentos dos últimos 6 meses">
        {carregando ? <Carregando /> : <GraficoMRR nome="Recebimentos" serie={recebimentosPorMes(lista, hoje)} />}
      </Painel>

      <div className={styles.paineis}>
        <Painel titulo="Próximos vencimentos">
          {carregando ? (
            <Carregando />
          ) : proximos.length === 0 ? (
            <EstadoVazio ilustracao="calendario" titulo="Nenhum vencimento nos próximos 30 dias." />
          ) : (
            <Vencimentos itens={proximos} nomeDe={nomeDe} />
          )}
        </Painel>

        <Painel titulo="Pagamentos atrasados">
          {carregando ? (
            <Carregando />
          ) : atrasos.length === 0 ? (
            <EstadoVazio ilustracao="pagamentos" titulo="Nenhum pagamento atrasado." />
          ) : (
            <Vencimentos itens={atrasos} nomeDe={nomeDe} atrasados />
          )}
        </Painel>
      </div>
    </>
  )
}
