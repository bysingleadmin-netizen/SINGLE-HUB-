import type { ReactNode } from 'react'
import { Button } from './Button'
import { Ilustracao } from './Ilustracao'
import type { NomeIlustracao } from './Ilustracao'
import styles from './ui.module.css'

interface EstadoErroProps {
  mensagem?: string
  onTentar: () => void
}

export function EstadoErro({
  mensagem = 'Não foi possível carregar os dados.',
  onTentar,
}: EstadoErroProps) {
  return (
    <div role="alert" className={styles.estado}>
      <p className={styles.estadoTitulo}>{mensagem}</p>
      <Button variante="secundario" onClick={onTentar}>
        Tentar novamente
      </Button>
    </div>
  )
}

interface EstadoVazioProps {
  titulo: string
  texto?: string
  acao?: ReactNode
  /** Desenho do módulo; sem ele, entra um genérico */
  ilustracao?: NomeIlustracao
}

export function EstadoVazio({ titulo, texto, acao, ilustracao }: EstadoVazioProps) {
  return (
    <div className={styles.estado}>
      <Ilustracao nome={ilustracao} />
      <p className={styles.estadoTitulo}>{titulo}</p>
      {texto && <p className={styles.estadoTexto}>{texto}</p>}
      {acao}
    </div>
  )
}
