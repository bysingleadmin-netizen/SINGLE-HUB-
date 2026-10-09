import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import styles from './ui.module.css'

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string
  opcoes: readonly { valor: string; rotulo: string }[]
  /** Texto da opção sem valor, como "Sem cliente". Sem isso, não há opção vazia. */
  vazio?: string
  erro?: string
}

export function Selecao({ rotulo, opcoes, vazio, erro, id, className, ...resto }: SelecaoProps) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idErro = `${idCampo}-erro`
  return (
    <div className={[styles.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={idCampo} className={styles.campoRotulo}>
        {rotulo}
      </label>
      <select
        id={idCampo}
        className={`${styles.campoInput} ${styles.campoSelecao}`}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        {...resto}
      >
        {vazio != null && <option value="">{vazio}</option>}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
      {erro && (
        <p id={idErro} className={styles.campoErro}>
          {erro}
        </p>
      )}
    </div>
  )
}
