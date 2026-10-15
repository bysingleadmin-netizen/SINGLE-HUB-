import { useState } from 'react'
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
import { useDespesas } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { vencimentoNoMes } from '@/features/clientes/cartoes'
import { moedaParaCampo } from '@/features/clientes/cliente'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import type { Erros } from '@/lib/formulario'
import { plural } from '@/lib/regras'
import { supabase } from '@/lib/supabase'
import type { Expense } from '@/types/database'
import {
  CATEGORIAS,
  FORMAS_DE_PAGAMENTO,
  MAXIMO_DE_MESES,
  datasDaRecorrencia,
  filtrarDespesas,
  totalDasDespesas,
  validarDespesa,
  validarMeses,
} from './financeiro'
import type { FiltroDeDespesas, FormDespesa } from './financeiro'
import styles from './financeiro.module.css'

const OPCOES_CATEGORIA = CATEGORIAS.map((valor) => ({ valor, rotulo: valor }))
const OPCOES_FORMA = FORMAS_DE_PAGAMENTO.map((valor) => ({ valor, rotulo: valor }))

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

// O banco diz assim que a coluna pedida não existe (migration 0005 não rodada)
const COLUNA_AUSENTE = new Set(['42703', 'PGRST204'])

/**
 * Grava as despesas de uma recorrência num insert só, marcadas com o mesmo grupo. Sem a
 * migration 0005 o banco recusa a marca, e as despesas são gravadas sem ela.
 */
function useLancarDespesas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (linhas: Valores<Expense>[]) => {
      const grupo = crypto.randomUUID()
      const { error } = await supabase
        .from('expenses')
        .insert(linhas.map((linha) => ({ ...linha, recorrente: true, grupo_recorrencia: grupo })))
      if (!error) return
      if (!COLUNA_AUSENTE.has(error.code ?? '')) throw error
      const semGrupo = await supabase.from('expenses').insert(linhas)
      if (semGrupo.error) throw semGrupo.error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

interface FormularioDeDespesaProps {
  /** Despesa em edição; sem ela, o formulário lança uma nova */
  despesa?: Expense
  /** Chamado ao salvar ou cancelar a edição */
  onSalvo?: () => void
}

/** O mesmo formulário lança uma despesa (ou uma por mês, se recorrente) e edita uma existente. */
function FormularioDeDespesa({ despesa, onSalvo }: FormularioDeDespesaProps) {
  const { perfil } = useAuth()
  const [form, setForm] = useState(() => (despesa ? formDaDespesa(despesa) : formVazio()))
  const [recorrente, setRecorrente] = useState(false)
  const [meses, setMeses] = useState('12')
  const [erros, setErros] = useState<Erros<FormDespesa & { meses: string }>>({})
  const salvar = useSalvar<Expense>('expenses')
  const lancar = useLancarDespesas()
  const toast = useToast()

  const mudar = (campo: keyof FormDespesa) => (evento: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: evento.target.value }))

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const validacao = validarDespesa(form)
    const repeticoes = recorrente ? validarMeses(meses) : 1
    if ('erros' in validacao || repeticoes == null) {
      setErros({
        ...('erros' in validacao ? validacao.erros : {}),
        ...(repeticoes == null ? { meses: `Repita de 1 a ${MAXIMO_DE_MESES} meses.` } : {}),
      })
      return
    }
    setErros({})
    const valores = validacao.valores

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
    if (repeticoes === 1) {
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

    const linhas = datasDaRecorrencia(valores.data, repeticoes).map((data) => ({
      ...valores,
      data,
      created_by: perfil?.id ?? null,
    }))
    lancar.mutate(linhas, {
      onSuccess: () => {
        toast.sucesso(`${linhas.length} despesas lançadas com sucesso.`)
        limpar()
      },
      onError: () => toast.erro('Não foi possível lançar as despesas.'),
    })
  }

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
        <Campo
          rotulo="Data"
          type="date"
          value={form.data}
          erro={erros.data}
          onChange={mudar('data')}
        />
        <Selecao
          rotulo="Forma de pagamento"
          opcoes={OPCOES_FORMA}
          value={form.forma_pagamento}
          onChange={mudar('forma_pagamento')}
        />
      </div>
      {/* Editar mexe numa despesa só; a recorrência existe no lançamento */}
      {!despesa && (
        <div className={styles.recorrencia}>
          <label className={styles.marcar}>
            <input
              type="checkbox"
              checked={recorrente}
              onChange={(evento) => setRecorrente(evento.target.checked)}
            />
            Despesa recorrente
          </label>
          {recorrente && (
            <Campo
              className={styles.meses}
              rotulo="Repetir por (meses)"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAXIMO_DE_MESES}
              value={meses}
              erro={erros.meses}
              onChange={(evento) => setMeses(evento.target.value)}
            />
          )}
        </div>
      )}
      <div className={ui.acoes}>
        {despesa && (
          <Button variante="fantasma" onClick={onSalvo}>
            Cancelar
          </Button>
        )}
        <Button type="submit" carregando={salvar.isPending || lancar.isPending}>
          {despesa ? 'Salvar alterações' : 'Lançar despesa'}
        </Button>
      </div>
    </form>
  )
}

/** Despesas da agência: lançamento, lista filtrada por período e categoria e o total do período. */
export function Lancamentos() {
  const despesas = useDespesas()
  const remover = useRemover('expenses')
  const toast = useToast()
  const [filtro, setFiltro] = useState<FiltroDeDespesas>(() => {
    // Começa no mês atual inteiro
    const mes = `${hojeISO().slice(0, 7)}-01`
    return { de: mes, ate: vencimentoNoMes(mes, 31), categoria: '' }
  })
  const [editando, setEditando] = useState<Expense>()

  const mudarFiltro = (campo: keyof FiltroDeDespesas) => (evento: { target: { value: string } }) =>
    setFiltro((atual) => ({ ...atual, [campo]: evento.target.value }))

  function excluir(despesa: Expense) {
    remover.mutate(despesa.id, {
      onSuccess: () => toast.sucesso('Despesa excluída.'),
      onError: () => toast.erro('Não foi possível excluir a despesa.'),
    })
  }

  const filtradas = filtrarDespesas(despesas.data ?? [], filtro)

  return (
    <>
      <Painel titulo="Nova despesa">
        <FormularioDeDespesa />
      </Painel>

      <Painel titulo="Despesas">
        <div className={styles.campos}>
          <Campo rotulo="De" type="date" value={filtro.de} onChange={mudarFiltro('de')} />
          <Campo rotulo="Até" type="date" value={filtro.ate} onChange={mudarFiltro('ate')} />
          <Selecao
            rotulo="Categoria do filtro"
            vazio="Todas as categorias"
            opcoes={OPCOES_CATEGORIA}
            value={filtro.categoria}
            onChange={mudarFiltro('categoria')}
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
                <strong className={styles.totalValor}>
                  {formatarMoeda(totalDasDespesas(filtradas))}
                </strong>
              </div>
              <span className={ui.mudo}>{plural(filtradas.length, 'despesa', 'despesas')}</span>
            </div>

            {filtradas.length === 0 ? (
              <EstadoVazio
                ilustracao="pagamentos"
                titulo="Nenhuma despesa neste período."
                texto="Lance uma despesa acima ou ajuste o período e a categoria."
              />
            ) : (
              <ul className={`${ui.lista} stagger`}>
                {filtradas.map((despesa) => (
                  <li key={despesa.id} className={ui.linha}>
                    <div className={ui.linhaTexto}>
                      <span className={ui.linhaTitulo}>{despesa.descricao}</span>
                      <span className={ui.mudo}>
                        {formatarData(despesa.data)}, {despesa.categoria}, {despesa.forma_pagamento}
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
            onSalvo={() => setEditando(undefined)}
          />
        </Modal>
      )}
    </>
  )
}
