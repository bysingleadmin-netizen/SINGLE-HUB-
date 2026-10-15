import { Avatar } from './Avatar'
import styles from './blocoDeVinculo.module.css'

export interface EmpresaDoBloco {
  nome: string
  logoUrl?: string | null
}

export interface PessoaDoBloco {
  id?: string
  nome: string
  avatarUrl?: string | null
  /** Cargo ou papel, em texto auxiliar */
  detalhe?: string | null
}

interface BlocoDeVinculoProps {
  /** Null mostra `semEmpresa`; undefined esconde a linha da empresa */
  empresa?: EmpresaDoBloco | null
  semEmpresa?: string
  pessoas: PessoaDoBloco[]
  /** Texto quando não há pessoa; sem ele, a linha da pessoa some */
  semPessoa?: string
}

const MAXIMO_DE_AVATARES = 3

/**
 * Empresa e pessoa no mesmo bloco, sem confundir uma com a outra: a empresa em cima, com o logo
 * quadrado e o nome em destaque; uma divisória; a pessoa embaixo, com avatar redondo, nome menor
 * e o cargo em texto auxiliar. Com várias pessoas, os avatares se empilham.
 * Só usa span: pode ficar dentro do botão que abre um card.
 */
export function BlocoDeVinculo({ empresa, semEmpresa = 'Sem cliente', pessoas, semPessoa }: BlocoDeVinculoProps) {
  const comPessoa = pessoas.length > 0 || semPessoa != null
  return (
    <span className={styles.bloco}>
      {empresa !== undefined && (
        <span className={styles.empresa}>
          <Avatar nome={empresa?.nome ?? null} url={empresa?.logoUrl} tamanho={26} forma="quadrado" />
          <span className={styles.empresaNome} data-vazio={!empresa || undefined}>
            {empresa?.nome ?? semEmpresa}
          </span>
        </span>
      )}
      {empresa !== undefined && comPessoa && <span className={styles.divisor} aria-hidden="true" />}
      {pessoas.length === 1 ? (
        <span className={styles.pessoa}>
          <Avatar nome={pessoas[0].nome} url={pessoas[0].avatarUrl} tamanho={24} />
          <span className={styles.pessoaTexto}>
            <span className={styles.pessoaNome}>{pessoas[0].nome}</span>
            {pessoas[0].detalhe && <span className={styles.pessoaDetalhe}>{pessoas[0].detalhe}</span>}
          </span>
        </span>
      ) : pessoas.length > 1 ? (
        <span className={styles.pessoa}>
          <span className={styles.pilha}>
            {pessoas.slice(0, MAXIMO_DE_AVATARES).map((pessoa) => (
              <Avatar key={pessoa.id ?? pessoa.nome} nome={pessoa.nome} url={pessoa.avatarUrl} tamanho={24} />
            ))}
            {pessoas.length > MAXIMO_DE_AVATARES && (
              <span className={styles.mais}>+{pessoas.length - MAXIMO_DE_AVATARES}</span>
            )}
          </span>
          <span className={styles.pessoaTexto}>
            <span className={styles.pessoaNome}>{pessoas.map((p) => p.nome.split(' ')[0]).join(', ')}</span>
            <span className={styles.pessoaDetalhe}>{pessoas.length} responsáveis</span>
          </span>
        </span>
      ) : (
        semPessoa != null && <span className={styles.pessoaVazia}>{semPessoa}</span>
      )}
    </span>
  )
}
