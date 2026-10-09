import type { ReactNode } from 'react'
import styles from './ui.module.css'

// Desenhos simples para os estados vazios. Traço na cor do texto apagado, um detalhe em vermelho.
const DESENHOS = {
  geral: (
    <>
      <rect x="14" y="18" width="68" height="46" rx="8" />
      <path d="M14 32h68" />
      <path className={styles.ilustracaoDestaque} d="M30 48h36" />
    </>
  ),
  clientes: (
    <>
      <circle cx="38" cy="32" r="11" />
      <path d="M18 64c0-11 9-18 20-18s20 7 20 18" />
      <path className={styles.ilustracaoDestaque} d="M70 26v16M62 34h16" />
    </>
  ),
  quadro: (
    <>
      <rect x="12" y="16" width="20" height="50" rx="5" />
      <rect x="38" y="16" width="20" height="34" rx="5" />
      <rect x="64" y="16" width="20" height="42" rx="5" />
      <path className={styles.ilustracaoDestaque} d="M17 26h10M43 26h10M69 26h10" />
    </>
  ),
  campanhas: (
    <>
      <path d="M18 36v10a3 3 0 0 0 3 3h7l20 13V20L28 33h-7a3 3 0 0 0-3 3z" />
      <path className={styles.ilustracaoDestaque} d="M60 32a12 12 0 0 1 0 18M68 24a24 24 0 0 1 0 34" />
    </>
  ),
  atividade: (
    <>
      <circle cx="48" cy="41" r="26" />
      <path className={styles.ilustracaoDestaque} d="M48 26v16l10 7" />
    </>
  ),
  calendario: (
    <>
      <rect x="14" y="20" width="68" height="48" rx="8" />
      <path d="M14 34h68M30 12v14M66 12v14" />
      <path className={styles.ilustracaoDestaque} d="M30 48h8M44 48h8M58 48h8" />
    </>
  ),
  sino: (
    <>
      <path d="M26 56c4-5 6-10 6-19a16 16 0 0 1 32 0c0 9 2 14 6 19z" />
      <path className={styles.ilustracaoDestaque} d="M42 64a6 6 0 0 0 12 0" />
    </>
  ),
  busca: (
    <>
      <circle cx="42" cy="38" r="20" />
      <path className={styles.ilustracaoDestaque} d="m58 54 16 16" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type NomeIlustracao = keyof typeof DESENHOS

export function Ilustracao({ nome = 'geral' }: { nome?: NomeIlustracao }) {
  return (
    <svg
      className={styles.ilustracao}
      data-testid="ilustracao"
      width="96"
      height="82"
      viewBox="0 0 96 82"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DESENHOS[nome]}
    </svg>
  )
}
