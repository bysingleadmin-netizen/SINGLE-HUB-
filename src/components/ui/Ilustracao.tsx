import type { ReactNode } from 'react'
import styles from './ui.module.css'

// Ícones discretos para os estados vazios: só traço, nunca preenchidos.
// O traço não escala com o desenho, então fica em 1,5 px no tamanho final.
const DESENHOS = {
  geral: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 9.5h18M8 14h8" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M18 7v5M15.5 9.5h5" />
    </>
  ),
  quadro: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="10" rx="1.5" />
      <rect x="16" y="4" width="5" height="13" rx="1.5" />
    </>
  ),
  campanhas: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  atividade: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  sino: (
    <>
      <path d="M6 16.5c1.2-1.4 1.7-3 1.7-5.6a4.3 4.3 0 0 1 8.6 0c0 2.6.5 4.2 1.7 5.6z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
    </>
  ),
  busca: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  pagamentos: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.5 9.5v.01M17.5 14.5v.01" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type NomeIlustracao = keyof typeof DESENHOS

export function Ilustracao({ nome = 'geral' }: { nome?: NomeIlustracao }) {
  return (
    <svg
      className={styles.ilustracao}
      data-testid="ilustracao"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.25"
      aria-hidden="true"
      focusable="false"
    >
      {DESENHOS[nome]}
    </svg>
  )
}
