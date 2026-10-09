import { useId, useState } from 'react'
import { semAcentos } from '@/lib/texto'
import type { Profile } from '@/types/database'
import { Avatar } from './Avatar'
import { Icone } from './Icone'
import styles from './ui.module.css'

interface SeletorDePessoasProps {
  rotulo: string
  pessoas: Profile[]
  /** ids escolhidos */
  escolhidas: string[]
  onMudar: (ids: string[]) => void
}

/** Campo de busca por nome que vai juntando as pessoas escolhidas. */
export function SeletorDePessoas({ rotulo, pessoas, escolhidas, onMudar }: SeletorDePessoasProps) {
  const id = useId()
  const [busca, setBusca] = useState('')

  const termo = semAcentos(busca.trim())
  const sugestoes =
    termo === ''
      ? []
      : pessoas
          .filter((p) => !escolhidas.includes(p.id) && semAcentos(p.nome).includes(termo))
          .slice(0, 6)
  const marcadas = pessoas.filter((p) => escolhidas.includes(p.id))

  function escolher(pessoa: Profile) {
    onMudar([...escolhidas, pessoa.id])
    setBusca('')
  }

  return (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.campoRotulo}>
        {rotulo}
      </label>
      {marcadas.length > 0 && (
        <ul className={styles.pessoas}>
          {marcadas.map((pessoa) => (
            <li key={pessoa.id} className={styles.pessoa}>
              <Avatar nome={pessoa.nome} url={pessoa.avatar_url} tamanho={20} />
              {pessoa.nome}
              <button
                type="button"
                className={styles.pessoaRemover}
                aria-label={`Remover ${pessoa.nome}`}
                onClick={() => onMudar(escolhidas.filter((escolhida) => escolhida !== pessoa.id))}
              >
                <Icone nome="fechar" tamanho={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className={styles.campoInput}
        role="combobox"
        aria-expanded={sugestoes.length > 0}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Digite um nome"
        value={busca}
        onChange={(evento) => setBusca(evento.target.value)}
        onKeyDown={(evento) => {
          // Enter escolhe a primeira sugestão em vez de enviar o formulário
          if (evento.key === 'Enter' && sugestoes.length > 0) {
            evento.preventDefault()
            escolher(sugestoes[0])
          }
        }}
      />
      {termo !== '' && (
        <ul id={`${id}-lista`} role="listbox" aria-label={rotulo} className={styles.sugestoes}>
          {sugestoes.length === 0 ? (
            <li className={styles.sugestaoVazia}>Ninguém com esse nome.</li>
          ) : (
            sugestoes.map((pessoa) => (
              <li
                key={pessoa.id}
                role="option"
                aria-selected="false"
                className={styles.sugestao}
                onClick={() => escolher(pessoa)}
              >
                <Avatar nome={pessoa.nome} url={pessoa.avatar_url} tamanho={24} />
                <span>{pessoa.nome}</span>
                <span className={styles.mudo}>{pessoa.cargo}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
