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
  setaBaixo: <path d="m6 9 6 6 6-6" />,
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
  whatsapp: (
    <>
      <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6Z" />
      <path d="M9.2 9.3c.3 1.8 1.7 3.6 3.6 4.4l1.2-1.1 1.8.8-.4 1.6c-3.2.2-6.6-3-6.5-6.4l1.6-.4.8 1.8Z" />
    </>
  ),
  email: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </>
  ),
  telefone: (
    <path d="M7.2 3.8 9.6 4.4l1 4-2 1.4a10 10 0 0 0 5.6 5.6l1.4-2 4 1 .6 2.4c-.2 1.9-1.8 3.3-3.7 3.2C9.7 19.6 4.4 14.3 4 7.5c-.1-1.9 1.3-3.5 3.2-3.7Z" />
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
  vinculo: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
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
  comentario: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  anexo: <path d="M19.5 11.5 12 19a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" />,
  lista: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5v.01M4 12v.01M4 17.5v.01" />,
  colunas: (
    <>
      <rect x="3.5" y="4.5" width="5" height="15" rx="1.5" />
      <rect x="10.5" y="4.5" width="5" height="10" rx="1.5" />
      <rect x="17.5" y="4.5" width="3" height="13" rx="1.5" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" />
    </>
  ),
  acoes: (
    <>
      <circle cx="5.5" cy="12" r="1.1" />
      <circle cx="12" cy="12" r="1.1" />
      <circle cx="18.5" cy="12" r="1.1" />
    </>
  ),
  lua: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  usuario: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
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
