import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Painel } from '@/components/ui/Painel'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useReceitasAsaas } from '@/dados/asaas'
import { juntarConsultas, useSalvar } from '@/dados/base'
import { useColunasOpcionais } from '@/dados/esquema'
import { useMetas, useMetricasDeTrafego } from '@/dados/tabelas'
import { formatarMes, moedaParaCampo } from '@/features/clientes/cliente'
import { hojeISO } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import type { Erros } from '@/lib/formulario'
import { parseMoeda, ultimosMeses } from '@/lib/regras'
import type { MonthlyGoal, TrafficMetric } from '@/types/database'
import {
  custoPorLead,
  formatarPercentual,
  metaAnualDe,
  metaDoPeriodo,
  metaMensalDe,
  progressoDaMeta,
  taxaDeConversao,
  totalDeLeads,
  validarMetricas,
} from './financeiro'
import type { FormMetricas } from './financeiro'
import { recebidoNoPeriodo } from './asaas'
import type { Intervalo } from '@/lib/periodos'
import styles from './financeiro.module.css'

const SEM_DADOS = 'sem dados'

type TipoDeMeta = 'mensal' | 'anual'

interface EditorDeMetaProps {
  tipo: TipoDeMeta
  /** 'AAAA-MM' na mensal, 'AAAA' na anual */
  referencia: string
  meta?: MonthlyGoal
  /** Meta anual sugerida: a mensal × 12 */
  sugestao: number | null
  comAnual: boolean
}

/** Campo da meta escolhida no toggle. Recriado ao trocar de tipo, para nascer com o valor dela. */
function EditorDeMeta({ tipo, referencia, meta, sugestao, comAnual }: EditorDeMetaProps) {
  const [valor, setValor] = useState(meta ? moedaParaCampo(meta.meta) : '')
  const [erro, setErro] = useState<string>()
  const salvar = useSalvar<MonthlyGoal>('monthly_goals')
  const toast = useToast()

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const novo = parseMoeda(valor)
    if (novo == null) {
      setErro('Informe um valor como 1.500,00.')
      return
    }
    setErro(undefined)
    const valores =
      tipo === 'anual'
        ? { mes: `${referencia}-01-01`, meta: novo, tipo: 'anual' as const }
        : { mes: `${referencia}-01`, meta: novo, ...(comAnual ? { tipo: 'mensal' as const } : {}) }
    salvar.mutate(
      { id: meta?.id, valores },
      {
        onSuccess: () => toast.sucesso('Meta salva.'),
        onError: () => toast.erro('Não foi possível salvar a meta.'),
      },
    )
  }

  return (
    <form className={styles.formularioMeta} onSubmit={aoEnviar} noValidate>
      <Campo
        rotulo={tipo === 'anual' ? `Meta anual de ${referencia}` : `Meta mensal de ${formatarMes(referencia)}`}
        inputMode="decimal"
        placeholder={sugestao != null ? moedaParaCampo(sugestao) : '0,00'}
        value={valor}
        erro={erro}
        onChange={(evento) => setValor(evento.target.value)}
      />
      {tipo === 'anual' && !meta && sugestao != null && valor === '' && (
        <Button variante="secundario" onClick={() => setValor(moedaParaCampo(sugestao))}>
          Usar sugestão ({formatarMoeda(sugestao)})
        </Button>
      )}
      <Button type="submit" carregando={salvar.isPending}>
        Salvar meta
      </Button>
    </form>
  )
}

/**
 * Meta de faturamento no período do Financeiro. O toggle escolhe qual meta definir (a do mês ou
 * a do ano em que o período começa); a barra compara o recebido no período com a meta do período.
 */
function MetaDoPeriodo({ intervalo, metas, recebido }: { intervalo: Intervalo; metas: MonthlyGoal[]; recebido: number }) {
  const esquema = useColunasOpcionais()
  const comAnual = esquema.metaAnual
  const [tipo, setTipo] = useState<TipoDeMeta>('mensal')
  const tipoUsado: TipoDeMeta = comAnual ? tipo : 'mensal'
  const mes = intervalo.inicio.slice(0, 7)
  const ano = intervalo.inicio.slice(0, 4)
  const mensal = metaMensalDe(metas, mes)
  const anual = metaAnualDe(metas, ano)
  const alvo = metaDoPeriodo(metas, intervalo)
  const { percentual, falta } = progressoDaMeta(recebido, alvo)

  return (
    <Painel titulo="Meta de faturamento">
      {comAnual && (
        <div className={styles.alternar} role="group" aria-label="Qual meta definir">
          {(['mensal', 'anual'] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              className={styles.alternarBotao}
              aria-pressed={tipoUsado === opcao}
              onClick={() => setTipo(opcao)}
            >
              {opcao === 'mensal' ? 'Meta mensal' : 'Meta anual'}
            </button>
          ))}
        </div>
      )}

      {alvo > 0 ? (
        <div className={styles.meta}>
          <div className={styles.metaTopo}>
            <strong className={styles.metaPercentual}>{formatarPercentual(percentual)}</strong>
            <span className={ui.mudo}>
              {formatarMoeda(recebido)} de {formatarMoeda(alvo)} no período
            </span>
          </div>
          <div
            className={styles.barra}
            role="progressbar"
            aria-label="Progresso da meta"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(percentual))}
          >
            <div
              className={styles.barraCheia}
              data-batida={falta === 0 || undefined}
              style={{ width: `${Math.min(100, percentual)}%` }}
            />
          </div>
          <span className={ui.mudo}>
            {falta === 0 ? 'Meta batida.' : `Faltam ${formatarMoeda(falta)} para a meta.`}
          </span>
        </div>
      ) : (
        <p className={ui.mudo}>
          Nenhuma meta definida para este período. Recebido até agora: {formatarMoeda(recebido)}.
        </p>
      )}

      <EditorDeMeta
        key={tipoUsado}
        tipo={tipoUsado}
        referencia={tipoUsado === 'anual' ? ano : mes}
        meta={tipoUsado === 'anual' ? anual : mensal}
        sugestao={mensal ? Number(mensal.meta) * 12 : null}
        comAnual={comAnual}
      />
    </Painel>
  )
}

function formDaMetrica(mes: string, metrica?: TrafficMetric): FormMetricas {
  return {
    mes,
    investimento: metrica ? moedaParaCampo(metrica.investimento) : '',
    leads_instagram: metrica ? String(metrica.leads_instagram) : '',
    leads_whatsapp: metrica ? String(metrica.leads_whatsapp) : '',
    convertidos: metrica ? String(metrica.convertidos) : '',
  }
}

/** Só é montada com as métricas já carregadas. Um mês tem uma linha só: salvar de novo atualiza. */
function MetricasDeTrafego({ mesAtual, metricas }: { mesAtual: string; metricas: TrafficMetric[] }) {
  const doMes = (mes: string) => metricas.find((m) => m.mes.slice(0, 7) === mes)
  const [form, setForm] = useState(() => formDaMetrica(mesAtual, doMes(mesAtual)))
  const [erros, setErros] = useState<Erros<FormMetricas>>({})
  const salvar = useSalvar<TrafficMetric>('traffic_metrics')
  const toast = useToast()

  const opcoes = ultimosMeses(`${mesAtual}-01`, 12)
    .reverse()
    .map((ponto) => ({ valor: ponto.mes, rotulo: formatarMes(ponto.mes) }))
  const historico = [...metricas].sort((a, b) => b.mes.localeCompare(a.mes))

  const mudar = (campo: keyof FormMetricas) => (evento: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: evento.target.value }))

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const validacao = validarMetricas(form)
    if ('erros' in validacao) {
      setErros(validacao.erros)
      return
    }
    setErros({})
    salvar.mutate(
      { id: doMes(form.mes)?.id, valores: validacao.valores },
      {
        onSuccess: () => toast.sucesso('Métricas salvas.'),
        onError: () => toast.erro('Não foi possível salvar as métricas.'),
      },
    )
  }

  return (
    <>
      <Painel titulo="Métricas de tráfego">
        <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
          <div className={styles.campos}>
            <Selecao
              rotulo="Mês"
              opcoes={opcoes}
              value={form.mes}
              // Trocar de mês traz o que já foi salvo nele
              onChange={(evento) => {
                setErros({})
                setForm(formDaMetrica(evento.target.value, doMes(evento.target.value)))
              }}
            />
            <Campo
              rotulo="Investimento"
              inputMode="decimal"
              placeholder="0,00"
              value={form.investimento}
              erro={erros.investimento}
              onChange={mudar('investimento')}
            />
            <Campo
              rotulo="Leads do Instagram"
              inputMode="numeric"
              value={form.leads_instagram}
              erro={erros.leads_instagram}
              onChange={mudar('leads_instagram')}
            />
            <Campo
              rotulo="Leads do WhatsApp"
              inputMode="numeric"
              value={form.leads_whatsapp}
              erro={erros.leads_whatsapp}
              onChange={mudar('leads_whatsapp')}
            />
            <Campo
              rotulo="Convertidos"
              inputMode="numeric"
              value={form.convertidos}
              erro={erros.convertidos}
              onChange={mudar('convertidos')}
            />
          </div>
          <div className={ui.acoes}>
            <Button type="submit" carregando={salvar.isPending}>
              Salvar métricas
            </Button>
          </div>
        </form>
      </Painel>

      <Painel titulo="Histórico de tráfego">
        {historico.length === 0 ? (
          <EstadoVazio
            ilustracao="campanhas"
            titulo="Nenhuma métrica registrada."
            texto="Salve o investimento e os leads de um mês para ver o custo por lead e a conversão."
          />
        ) : (
          <div className={styles.tabelaCaixa}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th scope="col">Mês</th>
                  <th scope="col">Investimento</th>
                  <th scope="col">Leads</th>
                  <th scope="col">Convertidos</th>
                  <th scope="col">CPL</th>
                  <th scope="col">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((metrica) => {
                  const cpl = custoPorLead(metrica)
                  const conversao = taxaDeConversao(metrica)
                  return (
                    <tr key={metrica.id}>
                      <th scope="row">{formatarMes(metrica.mes.slice(0, 7))}</th>
                      <td>{formatarMoeda(Number(metrica.investimento))}</td>
                      <td>{totalDeLeads(metrica)}</td>
                      <td>{metrica.convertidos}</td>
                      <td>{cpl == null ? SEM_DADOS : formatarMoeda(cpl)}</td>
                      <td>{conversao == null ? SEM_DADOS : formatarPercentual(conversao)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </>
  )
}

/** Meta de faturamento do período e as métricas de tráfego digitadas mês a mês. */
export function MetaETrafego({ intervalo }: { intervalo: Intervalo }) {
  const receitas = useReceitasAsaas()
  const metas = useMetas()
  const metricas = useMetricasDeTrafego()
  const estado = juntarConsultas(receitas, metas, metricas)

  if (estado.erro) return <EstadoErro onTentar={estado.tentar} />
  if (estado.carregando) return <Skeleton altura="240px" />

  const mes = hojeISO().slice(0, 7)

  return (
    <>
      <MetaDoPeriodo
        intervalo={intervalo}
        metas={metas.data ?? []}
        recebido={recebidoNoPeriodo(receitas.data ?? [], intervalo)}
      />
      <MetricasDeTrafego mesAtual={mes} metricas={metricas.data ?? []} />
    </>
  )
}
