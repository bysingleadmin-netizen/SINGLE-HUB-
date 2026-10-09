import { Button } from '@/components/ui/Button'
import { Icone } from '@/components/ui/Icone'
import ui from '@/components/ui/ui.module.css'
import { useCriar } from './CriacaoContext'
import styles from './criar.module.css'

/** Botão do cabeçalho: o único lugar de onde se cria tarefa de qualquer categoria. */
export function BotaoCriar() {
  const criar = useCriar()
  return (
    <Button
      className={`${ui.botaoPequeno} ${styles.botao}`}
      aria-label="Criar tarefa"
      onClick={() => criar()}
    >
      <Icone nome="mais" tamanho={16} />
      <span className={styles.botaoTexto}>Criar</span>
    </Button>
  )
}
