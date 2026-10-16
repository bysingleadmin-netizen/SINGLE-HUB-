import { Link } from 'react-router-dom'
import { BarrasHorizontais } from '@/components/graficos/BarrasHorizontais'
import { GraficoMensal } from '@/components/graficos/GraficoMensal'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { KpiCard } from '@/components/ui/KpiCard'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { useReceitasAsaas } from '@/dados/asaas'
import { porId } from '@/dados/base'
import { useClientes, useDespesas } from '@/dados/tabelas'
import { useTempoReal } from '@/dados/tempoReal'
import { GraficoMRR } from '@/features/dashboard/GraficoMRR'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { intervaloAnterior, nomeDoMes } from '@/lib/periodos'
import type { Intervalo } from '@/lib/periodos'
import { plural } from '@/lib/regras'
import { COR_DO_TOM } from '@/lib/rotulos'
import type { ReceitaAsaas } from '@/types/database'
import {
  aReceberNoPeriodo,
  atrasadas,
  desempenhoMensal,
  emAtraso,
  historicoDoTicket,
  mrrDoMes,
  proximosVencimentos,
  receitaPorCliente,
  recebidoNoPeriodo,
  ticketMedio,
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
        <li
          key={receita.id}
          className={`${ui.linha} ${styles.vencimento} ${receita.cliente_id ? ui.linhaClicavel : ''}`}
        >
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

const diferenca = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  signDisplay: 'exceptZero',
  maximumFractionDigits: 0,
})

const VERDE = COR_DO_TOM.verde
const VERMELHO = COR_DO_TOM.vermelho
const AZUL = COR_DO_TOM.azul
const corDoLucro = (valor: number) => (valor < 0 ? VERMELHO : VERDE)

/**
 * Visão geral do Financeiro no período escolhido, calculada das cobranças do Asaas e das despesas
 * lançadas: MRR e ARR, quanto entrou, quanto falta, o que está atrasado, o ticket médio e os
 * gráficos de desempenho mês a mês.
 */
export function Resumo({ intervalo }: { intervalo: Intervalo }) {
  const receitas = useReceitasAsaas()
  const clientes = useClientes()
  const despesas = useDespesas()
  useTempoReal(['receitas_asaas'])

  if (receitas.isError || clientes.isError || despesas.isError) {
    return (
      <EstadoErro
        onTentar={() => {
          void receitas.refetch()
          void clientes.refetch()
          void despesas.refetch()
        }}
      />
    )
  }
  if (receitas.data === null) return <SemTabelaAsaas />

  const carregando = receitas.isLoading || clientes.isLoading || despesas.isLoading
  const hoje = hojeISO()
  const lista = receitas.data ?? []
  const clientePorId = porId(clientes.data)
  const nomeDe = (receita: ReceitaAsaas) => nomeDaReceita(receita, clientePorId)
  // Atrasado é o que venceu até o fim do período: a dívida antiga continua contando
  const atrasos = atrasadas(lista, hoje, intervalo.fim)
  const proximos = proximosVencimentos(lista, hoje, intervalo)
  const devido = emAtraso(lista, intervalo.fim)
  const ticket = ticketMedio(lista, intervalo)
  const ticketAntes = ticketMedio(lista, intervaloAnterior(intervalo))
  const variacaoDoTicket = ticket.valor != null && ticketAntes.valor != null ? ticket.valor - ticketAntes.valor : null
  const recorrente = mrrDoMes(lista, intervalo, hoje)
  const desempenho = desempenhoMensal(lista, despesas.data ?? [], intervalo)
  const porCliente = receitaPorCliente(lista, intervalo, nomeDe).slice(0, 10)

  return (
    <>
      <div className={`${styles.kpis} stagger`}>
        <KpiCard
          rotulo="MRR ativo"
          valor={recorrente.mrr}
          formatar={formatarMoeda}
          carregando={carregando}
          legenda={<span>Faturamento recorrente de {nomeDoMes(recorrente.mes)}</span>}
        />
        <KpiCard
          rotulo="ARR"
          valor={recorrente.arr}
          formatar={formatarMoeda}
          carregando={carregando}
          legenda={<span>MRR × 12</span>}
        />
        <KpiCard
          rotulo="Recebido no período"
          valor={recebidoNoPeriodo(lista, intervalo)}
          formatar={formatarMoeda}
          carregando={carregando}
        />
        <KpiCard
          rotulo="A receber no período"
          valor={aReceberNoPeriodo(lista, intervalo)}
          formatar={formatarMoeda}
          carregando={carregando}
        />
        <KpiCard
          rotulo="Ticket médio"
          valor={ticket.valor}
          formatar={formatarMoeda}
          carregando={carregando}
          legenda={
            <>
              {variacaoDoTicket != null && (
                <span
                  className={styles.ticketVariacao}
                  data-sinal={variacaoDoTicket > 0 ? 'positivo' : variacaoDoTicket < 0 ? 'negativo' : undefined}
                >
                  {variacaoDoTicket > 0 ? '▲' : variacaoDoTicket < 0 ? '▼' : '='} {diferenca.format(variacaoDoTicket)} vs
                  período anterior
                </span>
              )}
              <span>Baseado em {plural(ticket.clientes, 'cliente ativo', 'clientes ativos')}</span>
            </>
          }
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

      <div className={styles.paineis}>
        <Painel titulo="Receita × Despesas">
          {carregando ? (
            <Carregando />
          ) : (
            <GraficoMensal
              titulo="Receita e despesas por mês"
              tipo="barras"
              series={[
                { chave: 'receita', rotulo: 'Receita', cor: VERDE },
                { chave: 'despesas', rotulo: 'Despesas', cor: VERMELHO },
              ]}
              pontos={desempenho.map((d) => ({ mes: d.mes, rotulo: d.rotulo, valores: { receita: d.receita, despesas: d.despesas } }))}
            />
          )}
        </Painel>

        <Painel titulo="Receita × Lucro líquido">
          {carregando ? (
            <Carregando />
          ) : (
            <GraficoMensal
              titulo="Receita e lucro líquido (receita menos despesas) por mês"
              tipo="linhas"
              series={[
                { chave: 'receita', rotulo: 'Receita', cor: AZUL },
                {
                  chave: 'lucro',
                  rotulo: 'Lucro líquido',
                  cor: VERDE,
                  corDoValor: corDoLucro,
                  coresDaLegenda: [VERDE, VERMELHO],
                },
              ]}
              pontos={desempenho.map((d) => ({ mes: d.mes, rotulo: d.rotulo, valores: { receita: d.receita, lucro: d.lucro } }))}
            />
          )}
        </Painel>

        <Painel titulo="Ticket médio por mês">
          {carregando ? <Carregando /> : <GraficoMRR nome="Ticket médio" serie={historicoDoTicket(lista, intervalo)} />}
        </Painel>

        <Painel titulo="Empresas que mais geraram receita">
          {carregando ? (
            <Carregando />
          ) : porCliente.length === 0 ? (
            <EstadoVazio ilustracao="pagamentos" titulo="Nenhum pagamento recebido neste período." />
          ) : (
            <BarrasHorizontais
              titulo="Total recebido por empresa no período, do maior para o menor"
              itens={porCliente}
              formatar={formatarMoeda}
              cor={VERDE}
            />
          )}
        </Painel>
      </div>

      <div className={styles.paineis}>
        <Painel titulo="Vencimentos no período">
          {carregando ? (
            <Carregando />
          ) : proximos.length === 0 ? (
            <EstadoVazio ilustracao="calendario" titulo="Nenhum vencimento a partir de hoje neste período." />
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
