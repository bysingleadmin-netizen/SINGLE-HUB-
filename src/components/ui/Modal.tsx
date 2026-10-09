import { Sobreposicao } from './Sobreposicao'
import type { SobreposicaoProps } from './Sobreposicao'

export function Modal(props: SobreposicaoProps) {
  return <Sobreposicao variante="modal" {...props} />
}
