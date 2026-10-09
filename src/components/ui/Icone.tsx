import type { ReactNode } from 'react'

const DESENHOS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14.3c2.1.7 3.5 2.6 3.5 5.7" />
    </>
  ),
  demandas: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="10" rx="1.5" />
      <rect x="16" y="4" width="5" height="13" rx="1.5" />
    </>
  ),
  conteudo: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  campanhas: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
      <path d="M19.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  financeiro: (
    <>
      <path d="M12 3v18" />
      <path d="M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 1.5 2.6 4.5 3.2 4.5 1.5 4.5 3.3-2 3-4.5 3-4.5-1.3-4.5-3" />
    </>
  ),
  configuracoes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  recolher: (
    <>
      <path d="m14 7-5 5 5 5" />
      <path d="M19 5v14" />
    </>
  ),
  expandir: (
    <>
      <path d="m10 7 5 5-5 5" />
      <path d="M5 5v14" />
    </>
  ),
  sair: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="m15 8 4 4-4 4" />
      <path d="M19 12H9" />
    </>
  ),
  fechar: <path d="m6 6 12 12M18 6 6 18" />,
  mais: <path d="M12 5v14M5 12h14" />,
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
  seta: <path d="m9 6 6 6-6 6" />,
  pix: (
    <>
      <path d="m12 3.5 8.5 8.5-8.5 8.5L3.5 12z" />
      <path d="m8 8 4 4 4-4M8 16l4-4 4 4" />
    </>
  ),
  dinheiro: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M6.5 10v.01M17.5 14v.01" />
    </>
  ),
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M16.6 7.4v.01" />
    </>
  ),
  setaEsquerda: <path d="m15 6-6 6 6 6" />,
  arquivar: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </>
  ),
  editar: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  externo: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  confirmar: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  lixeira: (
    <>
      <path d="M4 7h16M10 7V4h4v3" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    </>
  ),
  voltar: <path d="M19 12H5m6-6-6 6 6 6" />,
  enviar: (
    <>
      <path d="M12 16V4m-5 5 5-5 5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 4 2.8 19.5h18.4z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type NomeIcone = keyof typeof DESENHOS

interface IconeProps {
  nome: NomeIcone
  tamanho?: number
}

export function Icone({ nome, tamanho = 20 }: IconeProps) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DESENHOS[nome]}
    </svg>
  )
}
