import { useState } from 'react'
import type { ReactNode } from 'react'
import styles from './lista.module.css'

export interface ColunaDaTabela<T> {
  chave: string
  titulo: string
  render: (item: T) => ReactNode
  /** Valor usado para ordenar; sem ele a coluna não ordena */
  ordem?: (item: T) => string | number | null
}

interface TabelaDeTarefasProps<T extends { id: string }> {
  /** Nome da tabela para leitores de tela */
  rotulo: string
  itens: T[]
  colunas: ColunaDaTabela<T>[]
  tituloDe: (item: T) => string
  /** Sem isso, as linhas não abrem nada */
  onAbrir?: (item: T) => void
  /** Coluna que ordena a lista ao abrir */
  ordemInicial?: string
}

/**
 * Lista de tarefas em tabela, alternativa ao quadro: uma linha por tarefa, com todas as
 * informações lado a lado e ordenação ao clicar no cabeçalho. A linha inteira abre a tarefa.
 */
export function TabelaDeTarefas<T extends { id: string }>({
  rotulo,
  itens,
  colunas,
  tituloDe,
  onAbrir,
  ordemInicial,
}: TabelaDeTarefasProps<T>) {
  const [ordenacao, setOrdenacao] = useState({ chave: ordemInicial ?? '', crescente: true })
  const coluna = colunas.find((c) => c.chave === ordenacao.chave)

  const ordenados = coluna?.ordem
    ? [...itens].sort((a, b) => {
        const va = coluna.ordem?.(a) ?? null
        const vb = coluna.ordem?.(b) ?? null
        // Sem valor (sem data, sem responsável) fica sempre no fim
        if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1
        const comparacao =
          typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), 'pt-BR')
        return ordenacao.crescente ? comparacao : -comparacao
      })
    : itens

  function ordenarPor(chave: string) {
    setOrdenacao((atual) => ({ chave, crescente: atual.chave === chave ? !atual.crescente : true }))
  }

  return (
    <div className={styles.tabelaCaixa}>
      <table className={styles.tabela} aria-label={rotulo}>
        <thead>
          <tr>
            {colunas.map((c) => {
              const ativa = ordenacao.chave === c.chave
              return (
                <th
                  key={c.chave}
                  scope="col"
                  aria-sort={ativa ? (ordenacao.crescente ? 'ascending' : 'descending') : undefined}
                >
                  {c.ordem ? (
                    <button type="button" className={styles.ordenar} onClick={() => ordenarPor(c.chave)}>
                      {c.titulo}
                      <span aria-hidden="true">{ativa ? (ordenacao.crescente ? '↑' : '↓') : ''}</span>
                    </button>
                  ) : (
                    c.titulo
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((item) => (
            <tr
              key={item.id}
              data-clicavel={onAbrir ? true : undefined}
              onClick={onAbrir ? () => onAbrir(item) : undefined}
            >
              {colunas.map((c, i) => (
                <td key={c.chave}>
                  {i === 0 && onAbrir ? (
                    <button
                      type="button"
                      className={styles.abrir}
                      aria-label={`Abrir ${tituloDe(item)}`}
                      // O clique da linha já abre; aqui só o teclado precisa do botão
                      onClick={(evento) => {
                        evento.stopPropagation()
                        onAbrir(item)
                      }}
                    >
                      {c.render(item)}
                    </button>
                  ) : (
                    c.render(item)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
