import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { MenuAcoes } from '@/components/ui/MenuDeAcoes'
import { Modal } from '@/components/ui/Modal'
import { Painel } from '@/components/ui/Painel'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRemover, useSalvar } from '@/dados/base'
import type { Valores } from '@/dados/base'
import { useColunasOpcionais } from '@/dados/esquema'
import { useDespesas } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { moedaParaCampo } from '@/features/clientes/cliente'
import { hojeISO, somarDias } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import type { Erros } from '@/lib/formulario'
import { isLideranca } from '@/lib/permissoes'
import { plural } from '@/lib/regras'
import { supabase } from '@/lib/supabase'
import type { Expense } from '@/types/database'
import {
  CATEGORIAS,
  FORMAS_DE_PAGAMENTO,
  FREQUENCIAS,
  HORIZONTE_DIAS,
  MAXIMO_DE_PARCELAS,
  datasAte,
  datasDaRecorrencia,
  filtrarDespesas,
  totalDasDespesas,
  validarDespesa,
  validarParcelas,
} from './financeiro'
import type { FormDespesa, Frequencia, ValoresDespesa } from './financeiro'
import type { Intervalo } from '@/lib/periodos'
import styles from './financeiro.module.css'

const OPCOES_CATEGORIA = CATEGORIAS.map((valor) => ({ valor, rotulo: valor }))
const OPCOES_FORMA = FORMAS_DE_PAGAMENTO.map((valor) => ({ valor, rotulo: valor }))
const rotuloDaFrequencia = (frequencia: Frequencia | undefined) =>
  FREQUENCIAS.find((f) => f.valor === (frequencia ?? 'mensal'))?.rotulo ?? 'Mensal'

function formVazio(): FormDespesa {
  return {
    descricao: '',
    categoria: CATEGORIAS[0],
    valor: '',
    data: hojeISO(),
    forma_pagamento: FORMAS_DE_PAGAMENTO[0],
  }
}

function formDaDespesa(despesa: Expense): FormDespesa {
  return {
    descricao: despesa.descricao,
    categoria: despesa.categoria,
    valor: moedaParaCampo(Number(despesa.valor)),
    data: despesa.data,
    forma_pagamento: despesa.forma_pagamento,
  }
}

/** Última data que uma recorrência sem fim precisa ter criada */
const limiteSemFim = () => somarDias(hojeISO(), HORIZONTE_DIAS)

// O banco diz assim que a coluna pedida não existe (migration 0005 não rodada)
const COLUNA_AUSENTE = new Set(['42703', 'PGRST204'])

/** Frequência e fim da recorrência: só vão ao banco com a migration 0009 */
type Regra = { frequencia: Frequencia; sem_fim: boolean } | Record<string, never>

/**
 * Grava as despesas de uma recorrência num insert só, marcadas com o mesmo grupo. Sem a
 * migration 0005 o banco recusa a marca, e as despesas são gravadas sem ela.
 */
function useLancarDespesas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ linhas, regra }: { linhas: Valores<Expense>[]; regra: Regra }) => {
      const grupo = crypto.randomUUID()
      const { error } = await supabase
        .from('expenses')
        .insert(linhas.map((linha) => ({ ...linha, ...regra, recorrente: true, grupo_recorrencia: grupo })))
      if (!error) return
      if (!COLUNA_AUSENTE.has(error.code ?? '')) throw error
      const semGrupo = await supabase.from('expenses').insert(linhas)
      if (semGrupo.error) throw semGrupo.error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

/**
 * "Esta e as próximas": a despesa recebe os valores novos, as seguintes do grupo saem e a
 * recorrência é recriada a partir dela com a regra nova (valor, frequência, fim).
 */
function useReescreverRecorrencia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      despesa,
      valores,
      datas,
      regra,
      criadoPor,
    }: {
      despesa: Expense
      valores: ValoresDespesa
      datas: string[]
      regra: Regra
      criadoPor: string | null
    }) => {
      const atualizada = await supabase
        .from('expenses')
        .update({ ...valores, ...regra })
        .eq('id', despesa.id)
      if (atualizada.error) throw atualizada.error
      const apagadas = await supabase
        .from('expenses')
        .delete()
        .eq('grupo_recorrencia', despesa.grupo_recorrencia!)
        .gt('data', despesa.data)
      if (apagadas.error) throw apagadas.error
      const seguintes = datas.slice(1)
      if (seguintes.length === 0) return
      const inseridas = await supabase.from('expenses').insert(
        seguintes.map((data) => ({
          ...valores,
          ...regra,
          data,
          recorrente: true,
          grupo_recorrencia: despesa.grupo_recorrencia,
          created_by: criadoPor,
        })),
      )
      if (inseridas.error) throw inseridas.error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

/**
 * Mantém as recorrências sem fim criadas até um ano à frente: a cada abertura do Financeiro, o
 * grupo que ficou curto ganha as próximas datas. Um plano que falhou não é tentado de novo sem
 * que os dados mudem.
 */
export function useEstenderRecorrencias() {
  const { perfil } = useAuth()
  const despesas = useDespesas()
  const esquema = useColunasOpcionais()
  const queryClient = useQueryClient()
  const tentado = useRef('')

  useEffect(() => {
    if (!isLideranca(perfil?.cargo) || !esquema.recorrenciaDespesa || !despesas.data) return
    const limite = limiteSemFim()
    const grupos = new Map<string, Expense[]>()
    for (const despesa of despesas.data) {
      if (!despesa.sem_fim || !despesa.grupo_recorrencia) continue
      grupos.set(despesa.grupo_recorrencia, [...(grupos.get(despesa.grupo_recorrencia) ?? []), despesa])
    }
    const novas: Record<string, unknown>[] = []
    for (const linhas of grupos.values()) {
      const ultima = linhas.reduce((a, b) => (b.data > a.data ? b : a))
      const frequencia = ultima.frequencia ?? 'mensal'
      for (const data of datasAte(ultima.data, frequencia, limite).slice(1)) {
        const { id: _id, created_at: _criada, ...resto } = ultima
        novas.push({ ...resto, data })
      }
    }
    const assinatura = JSON.stringify(novas.map((n) => [n.grupo_recorrencia, n.data]))
    if (novas.length === 0 || tentado.current === assinatura) return
    tentado.current = assinatura
    void supabase
      .from('expenses')
      .insert(novas)
      .then(() => queryClient.invalidateQueries({ queryKey: ['expenses'] }))
  }, [perfil?.cargo, esquema.recorrenciaDespesa, despesas.data, queryClient])
}

interface FormularioDeDespesaProps {
  /** Despesa em edição; sem ela, o formulário lança uma nova */
  despesa?: Expense
  /** As despesas do mesmo grupo de recorrência, para saber quantas faltam */
  doGrupo?: Expense[]
  /** Chamado ao salvar ou cancelar a edição */
  onSalvo?: () => void
}

/** O mesmo formulário lança uma despesa (ou uma recorrência) e edita uma existente. */
function FormularioDeDespesa({ despesa, doGrupo = [], onSalvo }: FormularioDeDespesaProps) {
  const { perfil } = useAuth()
  const esquema = useColunasOpcionais()
  const comRegra = esquema.recorrenciaDespesa
  const ehRecorrente = Boolean(despesa?.recorrente && despesa.grupo_recorrencia)
  const restantes = doGrupo.filter((d) => despesa && d.data >= despesa.data).length
  const [form, setForm] = useState(() => (despesa ? formDaDespesa(despesa) : formVazio()))
  const [recorrente, setRecorrente] = useState(false)
  const [escopo, setEscopo] = useState<'esta' | 'proximas'>('esta')
  const [frequencia, setFrequencia] = useState<Frequencia>(despesa?.frequencia ?? 'mensal')
  const [semFim, setSemFim] = useState(despesa?.sem_fim ?? false)
  const [parcelas, setParcelas] = useState(String(restantes > 0 ? restantes : 12))
  const [erros, setErros] = useState<Erros<FormDespesa & { parcelas: string }>>({})
  const salvar = useSalvar<Expense>('expenses')
  const lancar = useLancarDespesas()
  const reescrever = useReescreverRecorrencia()
  const toast = useToast()

  // A regra entra em jogo ao lançar uma recorrência ou ao editar "esta e as próximas"
  const mexeNaRegra = despesa ? ehRecorrente && escopo === 'proximas' : recorrente
  const frequenciaUsada: Frequencia = comRegra ? frequencia : 'mensal'
  const semFimUsado = comRegra && semFim
  const regra: Regra = comRegra ? { frequencia: frequenciaUsada, sem_fim: semFimUsado } : {}

  const mudar = (campo: keyof FormDespesa) => (evento: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: evento.target.value }))

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const validacao = validarDespesa(form)
    const quantas = mexeNaRegra && !semFimUsado ? validarParcelas(parcelas) : 1
    if ('erros' in validacao || quantas == null) {
      setErros({
        ...('erros' in validacao ? validacao.erros : {}),
        ...(quantas == null ? { parcelas: `Informe de 1 a ${MAXIMO_DE_PARCELAS} parcelas.` } : {}),
      })
      return
    }
    setErros({})
    const valores = validacao.valores
    const datas = semFimUsado
      ? datasAte(valores.data, frequenciaUsada, limiteSemFim())
      : datasDaRecorrencia(valores.data, quantas, frequenciaUsada)

    if (despesa && mexeNaRegra) {
      reescrever.mutate(
        { despesa, valores, datas, regra, criadoPor: perfil?.id ?? null },
        {
          onSuccess: () => {
            toast.sucesso('Despesa e as próximas atualizadas.')
            onSalvo?.()
          },
          onError: () => toast.erro('Não foi possível atualizar a recorrência.'),
        },
      )
      return
    }

    if (despesa) {
      salvar.mutate(
        { id: despesa.id, valores },
        {
          onSuccess: () => {
            toast.sucesso('Despesa atualizada.')
            onSalvo?.()
          },
          onError: () => toast.erro('Não foi possível salvar a despesa.'),
        },
      )
      return
    }

    // Categoria, data e forma ficam, para lançar várias despesas seguidas
    const limpar = () => setForm((atual) => ({ ...atual, descricao: '', valor: '' }))
    if (!recorrente) {
      salvar.mutate(
        { valores: { ...valores, created_by: perfil?.id ?? null } },
        {
          onSuccess: () => {
            toast.sucesso('Despesa lançada.')
            limpar()
          },
          onError: () => toast.erro('Não foi possível lançar a despesa.'),
        },
      )
      return
    }

    const linhas = datas.map((data) => ({ ...valores, data, created_by: perfil?.id ?? null }))
    lancar.mutate(
      { linhas, regra },
      {
        onSuccess: () => {
          toast.sucesso(`${linhas.length} despesas lançadas com sucesso.`)
          limpar()
        },
        onError: () => toast.erro('Não foi possível lançar as despesas.'),
      },
    )
  }

  const camposDaRegra = (
    <>
      {comRegra && (
        <Selecao
          rotulo="Recorrência"
          opcoes={FREQUENCIAS}
          value={frequencia}
          onChange={(evento) => setFrequencia(evento.target.value as Frequencia)}
        />
      )}
      {!semFimUsado && (
        <Campo
          className={styles.meses}
          rotulo="Parcelas"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAXIMO_DE_PARCELAS}
          value={parcelas}
          erro={erros.parcelas}
          onChange={(evento) => setParcelas(evento.target.value)}
        />
      )}
      {comRegra && (
        <label className={styles.marcar}>
          <input type="checkbox" checked={semFim} onChange={(evento) => setSemFim(evento.target.checked)} />
          Sem fim
        </label>
      )}
    </>
  )

  return (
    <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
      <div className={styles.campos}>
        <Campo
          className={styles.descricao}
          rotulo="Descrição"
          value={form.descricao}
          erro={erros.descricao}
          onChange={mudar('descricao')}
        />
        <Selecao
          rotulo="Categoria"
          opcoes={OPCOES_CATEGORIA}
          value={form.categoria}
          onChange={mudar('categoria')}
        />
        <Campo
          rotulo="Valor"
          inputMode="decimal"
          placeholder="0,00"
          value={form.valor}
          erro={erros.valor}
          onChange={mudar('valor')}
        />
        <Campo rotulo="Data" type="date" value={form.data} erro={erros.data} onChange={mudar('data')} />
        <Selecao
          rotulo="Forma de pagamento"
          opcoes={OPCOES_FORMA}
          value={form.forma_pagamento}
          onChange={mudar('forma_pagamento')}
        />
      </div>

      {!despesa && (
        <div className={styles.recorrencia}>
          <label className={styles.marcar}>
            <input type="checkbox" checked={recorrente} onChange={(evento) => setRecorrente(evento.target.checked)} />
            Despesa recorrente
          </label>
          {recorrente && camposDaRegra}
        </div>
      )}

      {/* Editar uma recorrente: só esta, ou esta e as próximas (com valor, frequência e fim) */}
      {despesa && ehRecorrente && (
        <div className={styles.recorrencia}>
          <Selecao
            rotulo="Aplicar a"
            opcoes={[
              { valor: 'esta', rotulo: 'Só esta despesa' },
              { valor: 'proximas', rotulo: 'Esta e as próximas' },
            ]}
            value={escopo}
            onChange={(evento) => setEscopo(evento.target.value as 'esta' | 'proximas')}
          />
          {escopo === 'proximas' && camposDaRegra}
        </div>
      )}

      <div className={ui.acoes}>
        {despesa && (
          <Button variante="fantasma" onClick={onSalvo}>
            Cancelar
          </Button>
        )}
        <Button type="submit" carregando={salvar.isPending || lancar.isPending || reescrever.isPending}>
          {despesa ? 'Salvar alterações' : 'Lançar despesa'}
        </Button>
      </div>
    </form>
  )
}

/** Despesas da agência no período do Financeiro: lançamento, lista por categoria e o total. */
export function Lancamentos({ intervalo }: { intervalo: Intervalo }) {
  const despesas = useDespesas()
  const remover = useRemover('expenses')
  const toast = useToast()
  const [categoria, setCategoria] = useState('')
  const [editando, setEditando] = useState<Expense>()

  function excluir(despesa: Expense) {
    remover.mutate(despesa.id, {
      onSuccess: () => toast.sucesso('Despesa excluída.'),
      onError: () => toast.erro('Não foi possível excluir a despesa.'),
    })
  }

  const todas = despesas.data ?? []
  const filtradas = filtrarDespesas(todas, { de: intervalo.inicio, ate: intervalo.fim, categoria })

  return (
    <>
      <Painel titulo="Nova despesa">
        <FormularioDeDespesa />
      </Painel>

      <Painel titulo="Despesas">
        <div className={styles.campos}>
          <Selecao
            rotulo="Categoria do filtro"
            vazio="Todas as categorias"
            opcoes={OPCOES_CATEGORIA}
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value)}
          />
        </div>

        {despesas.isError ? (
          <EstadoErro onTentar={() => void despesas.refetch()} />
        ) : despesas.isLoading ? (
          <Skeleton altura="120px" />
        ) : (
          <>
            <div className={styles.rodape}>
              <div className={styles.total}>
                <span className={ui.mudo}>Total do período</span>
                <strong className={styles.totalValor}>{formatarMoeda(totalDasDespesas(filtradas))}</strong>
              </div>
              <span className={ui.mudo}>{plural(filtradas.length, 'despesa', 'despesas')}</span>
            </div>

            {filtradas.length === 0 ? (
              <EstadoVazio
                ilustracao="pagamentos"
                titulo="Nenhuma despesa neste período."
                texto="Lance uma despesa acima ou troque o período e a categoria."
              />
            ) : (
              <ul className={`${ui.lista} stagger`}>
                {filtradas.map((despesa) => (
                  <li key={despesa.id} className={ui.linha}>
                    <div className={ui.linhaTexto}>
                      <span className={ui.linhaTitulo}>{despesa.descricao}</span>
                      <span className={ui.mudo}>
                        {[
                          formatarData(despesa.data),
                          despesa.categoria,
                          despesa.forma_pagamento,
                          despesa.recorrente &&
                            `${rotuloDaFrequencia(despesa.frequencia).toLowerCase()}${despesa.sem_fim ? ', sem fim' : ''}`,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                    <span className={styles.valor}>{formatarMoeda(Number(despesa.valor))}</span>
                    <MenuAcoes
                      className={styles.acoesDaLinha}
                      nome={despesa.descricao}
                      aviso="Ela sai do DRE do mês."
                      onEditar={() => setEditando(despesa)}
                      onExcluir={() => excluir(despesa)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Painel>

      {editando && (
        <Modal aberto titulo="Editar despesa" onFechar={() => setEditando(undefined)}>
          <FormularioDeDespesa
            key={editando.id}
            despesa={editando}
            doGrupo={todas.filter(
              (d) => editando.grupo_recorrencia && d.grupo_recorrencia === editando.grupo_recorrencia,
            )}
            onSalvo={() => setEditando(undefined)}
          />
        </Modal>
      )}
    </>
  )
}
