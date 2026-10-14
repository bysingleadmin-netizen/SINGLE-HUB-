import { plural } from '@/lib/regras'
import { TabelaDeTarefas } from './TabelaDeTarefas'
import type { ColunaDaTabela } from './TabelaDeTarefas'
import { CelulaTitulo } from './celulas'
import { DIAS_ARQUIVADO, diasParaExcluir } from './ciclo'
import styles from './opcoes.module.css'

interface ItemArquivado {
  id: string
  concluded_at?: string | null
  archived_at?: string | null
}

interface ArquivadosProps<T extends ItemArquivado> {
  itens: T[]
  tituloDe: (item: T) => string
  /** Colunas a mostrar depois do título, como cliente e responsável */
  colunas: ColunaDaTabela<T>[]
  /** Se o banco já tem as datas do ciclo: sem elas não há exclusão automática a anunciar */
  comPrazo: boolean
  onAbrir: (item: T) => void
  onRestaurar: (item: T) => void
}

/**
 * Cards arquivados, fora do quadro. Aparece só quando alguém pede para ver.
 * Cada um pode voltar ao quadro; quem ficar é excluído 30 dias depois de arquivado.
 */
export function Arquivados<T extends ItemArquivado>({
  itens,
  tituloDe,
  colunas,
  comPrazo,
  onAbrir,
  onRestaurar,
}: ArquivadosProps<T>) {
  const tabela: ColunaDaTabela<T>[] = [
    {
      chave: 'titulo',
      titulo: 'Card',
      render: (item) => <CelulaTitulo>{tituloDe(item)}</CelulaTitulo>,
      ordem: tituloDe,
    },
    ...colunas,
    ...(comPrazo
      ? [
          {
            chave: 'exclusao',
            titulo: 'Exclusão',
            render: (item: T) => {
              const dias = diasParaExcluir(item)
              if (dias == null) return 'Sem prazo'
              return dias === 0 ? 'Na próxima limpeza' : `Em ${plural(dias, 'dia', 'dias')}`
            },
            ordem: (item: T) => diasParaExcluir(item),
          },
        ]
      : []),
    {
      chave: 'restaurar',
      titulo: '',
      render: (item) => (
        <button
          type="button"
          className={styles.restaurar}
          aria-label={`Restaurar ${tituloDe(item)}`}
          onClick={(evento) => {
            evento.stopPropagation()
            onRestaurar(item)
          }}
        >
          Restaurar
        </button>
      ),
    },
  ]

  return (
    <section className={styles.arquivados} aria-label="Arquivados">
      <div className={styles.arquivadosTopo}>
        <h2 className={styles.arquivadosTitulo}>Arquivados</h2>
        <span className={styles.arquivadosLegenda}>
          {comPrazo
            ? `Cards concluídos saem do quadro depois de 7 dias e são excluídos ${DIAS_ARQUIVADO} dias depois de arquivados.`
            : 'Cards arquivados ficam guardados aqui.'}
        </span>
      </div>
      {itens.length === 0 ? (
        <p className={styles.arquivadosLegenda}>
          Nenhum card arquivado.
        </p>
      ) : (
        <TabelaDeTarefas
          rotulo="Cards arquivados"
          itens={itens}
          colunas={tabela}
          tituloDe={tituloDe}
          onAbrir={onAbrir}
          ordemInicial={comPrazo ? 'exclusao' : 'titulo'}
        />
      )}
    </section>
  )
}
