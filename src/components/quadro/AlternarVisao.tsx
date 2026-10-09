import { useState } from 'react'
import { Icone } from '@/components/ui/Icone'
import styles from './lista.module.css'

export type Visao = 'quadro' | 'lista'

const OPCOES = [
  { valor: 'quadro', rotulo: 'Quadro', icone: 'colunas' },
  { valor: 'lista', rotulo: 'Lista', icone: 'lista' },
] as const

/** Lembra, por tela, se a pessoa prefere o quadro ou a lista. */
export function useVisao(chave: string): [Visao, (visao: Visao) => void] {
  const guardada = `single:visao:${chave}`
  const [visao, setVisao] = useState<Visao>(() => {
    try {
      return localStorage.getItem(guardada) === 'lista' ? 'lista' : 'quadro'
    } catch {
      return 'quadro'
    }
  })
  return [
    visao,
    (nova) => {
      setVisao(nova)
      try {
        localStorage.setItem(guardada, nova)
      } catch {
        // preferência não salva; a troca de visão continua funcionando
      }
    },
  ]
}

export function AlternarVisao({ visao, onMudar }: { visao: Visao; onMudar: (visao: Visao) => void }) {
  return (
    <div className={styles.alternar} role="group" aria-label="Forma de ver as tarefas">
      {OPCOES.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          className={styles.alternarBotao}
          aria-pressed={visao === opcao.valor}
          onClick={() => onMudar(opcao.valor)}
        >
          <Icone nome={opcao.icone} tamanho={15} />
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}
