import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import { Painel } from '@/components/ui/Painel'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRemover, useSalvar } from '@/dados/base'
import { useDespesas } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { vencimentoNoMes } from '@/features/clientes/cartoes'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import type { Erros } from '@/lib/formulario'
import { plural } from '@/lib/regras'
import type { Expense } from '@/types/database'
import {
  CATEGORIAS,
  FORMAS_DE_PAGAMENTO,
  filtrarDespesas,
  totalDasDespesas,
  validarDespesa,
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

function NovaDespesa() {
  const { perfil } = useAuth()
  const [form, setForm] = useState(formVazio)
  const [erros, setErros] = useState<Erros<FormDespesa>>({})
  const salvar = useSalvar<Expense>('expenses')
  const toast = useToast()

  const mudar = (campo: keyof FormDespesa) => (evento: { target: { value: string } }) =>
    setForm((atual) => ({ ...atual, [campo]: evento.target.value }))

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const validacao = validarDespesa(form)
    if ('erros' in validacao) {
      setErros(validacao.erros)
      return
    }
    setErros({})
    salvar.mutate(
      { valores: { ...validacao.valores, created_by: perfil?.id ?? null } },
      {
        onSuccess: () => {
          toast.sucesso('Despesa lançada.')
          // Categoria, data e forma ficam, para lançar várias despesas seguidas
          setForm((atual) => ({ ...atual, descricao: '', valor: '' }))
        },
        onError: () => toast.erro('Não foi possível lançar a despesa.'),
      },
    )
  }

  return (
    <Painel titulo="Nova despesa">
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
        <div className={ui.acoes}>
          <Button type="submit" carregando={salvar.isPending}>
            Lançar despesa
          </Button>
        </div>
      </form>
    </Painel>
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
  const [excluindo, setExcluindo] = useState<Expense>()

  const mudarFiltro = (campo: keyof FiltroDeDespesas) => (evento: { target: { value: string } }) =>
    setFiltro((atual) => ({ ...atual, [campo]: evento.target.value }))

  function excluir() {
    if (!excluindo) return
    remover.mutate(excluindo.id, {
      onSuccess: () => toast.sucesso('Despesa excluída.'),
      onError: () => toast.erro('Não foi possível excluir a despesa.'),
      onSettled: () => setExcluindo(undefined),
    })
  }

  const filtradas = filtrarDespesas(despesas.data ?? [], filtro)

  return (
    <>
      <NovaDespesa />

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
                    <button
                      type="button"
                      className={ui.botaoIcone}
                      aria-label={`Excluir ${despesa.descricao}`}
                      title="Excluir"
                      onClick={() => setExcluindo(despesa)}
                    >
                      <Icone nome="lixeira" tamanho={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Painel>

      {excluindo && (
        <Modal aberto titulo="Excluir despesa" onFechar={() => setExcluindo(undefined)}>
          <div className={ui.formulario}>
            <p>
              Excluir <strong>{excluindo.descricao}</strong>, de{' '}
              <strong>{formatarMoeda(Number(excluindo.valor))}</strong>? Ela sai do DRE do mês.
            </p>
            <div className={ui.acoes}>
              <Button variante="fantasma" onClick={() => setExcluindo(undefined)}>
                Cancelar
              </Button>
              <Button carregando={remover.isPending} onClick={excluir}>
                Excluir despesa
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
