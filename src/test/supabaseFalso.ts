// Substituto em memória do cliente Supabase, só para testes.
// Cobre o que o app usa: select, insert, update, delete, eq, order, limit, single e storage.

type Linha = Record<string, unknown>

interface ErroFalso {
  message: string
  code?: string
}

interface Resposta {
  data: unknown
  error: ErroFalso | null
}

export interface BancoFalso {
  tabelas: Record<string, Linha[]>
  /** Se definido, toda escrita falha com este erro */
  erroEscrita: ErroFalso | null
  /** Se definido, toda leitura falha com este erro */
  erroLeitura: ErroFalso | null
  /** Colunas que o banco ainda não tem, como 'clients.dia_vencimento' */
  colunasAusentes: string[]
  /** Chamadas feitas a Edge Functions, na ordem */
  funcoesChamadas: { nome: string; body: unknown }[]
  /** Se definido, a próxima chamada de função falha com este erro */
  erroDaFuncao: (ErroFalso & { context?: { status?: number } }) | null
  /** Corpo devolvido pelas funções; por padrão `{ ok: true }` */
  respostaDaFuncao: unknown
  reiniciar: (tabelas?: Record<string, object[]>) => void
}

export function criarSupabaseFalso() {
  let sequencia = 1
  const banco: BancoFalso = {
    tabelas: {},
    erroEscrita: null,
    erroLeitura: null,
    colunasAusentes: [],
    funcoesChamadas: [],
    erroDaFuncao: null,
    respostaDaFuncao: { ok: true },
    reiniciar(tabelas = {}) {
      banco.tabelas = structuredClone(tabelas) as Record<string, Linha[]>
      banco.erroEscrita = null
      banco.erroLeitura = null
      banco.colunasAusentes = []
      banco.funcoesChamadas = []
      banco.erroDaFuncao = null
      banco.respostaDaFuncao = { ok: true }
    },
  }

  function from(tabela: string) {
    let operacao: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let valores: Linha | Linha[] = {}
    const filtros: [string, unknown][] = []
    let unico = false
    let limite: number | undefined
    let ordem: { coluna: string; crescente: boolean } | undefined
    let colunasPedidas: string[] = []

    const ausente = (colunas: string[]) =>
      colunas.find((coluna) => banco.colunasAusentes.includes(`${tabela}.${coluna}`))

    function executar(): Resposta {
      const linhas = (banco.tabelas[tabela] ??= [])
      const casa = (linha: Linha) => filtros.every(([coluna, valor]) => linha[coluna] === valor)
      let resultado: Linha[]

      if (operacao === 'select') {
        if (banco.erroLeitura) return { data: null, error: banco.erroLeitura }
        const falta = ausente(colunasPedidas)
        if (falta) {
          return { data: null, error: { code: '42703', message: `column ${tabela}.${falta} does not exist` } }
        }
        resultado = linhas.filter(casa)
      } else {
        if (banco.erroEscrita) return { data: null, error: banco.erroEscrita }
        const gravadas = (Array.isArray(valores) ? valores : [valores]).flatMap((linha) => Object.keys(linha))
        const falta = ausente(gravadas)
        if (falta) {
          return { data: null, error: { code: 'PGRST204', message: `Could not find the '${falta}' column` } }
        }
        if (operacao === 'insert') {
          resultado = (Array.isArray(valores) ? valores : [valores]).map((linha) => ({
            id: `novo-${sequencia++}`,
            created_at: new Date().toISOString(),
            ...linha,
          }))
          linhas.push(...resultado)
        } else if (operacao === 'update') {
          resultado = linhas.filter(casa)
          resultado.forEach((linha) => Object.assign(linha, valores))
        } else {
          resultado = linhas.filter(casa)
          banco.tabelas[tabela] = linhas.filter((linha) => !casa(linha))
        }
      }

      if (ordem) {
        const { coluna, crescente } = ordem
        resultado = [...resultado].sort(
          (a, b) => String(a[coluna]).localeCompare(String(b[coluna])) * (crescente ? 1 : -1),
        )
      }
      if (limite != null) resultado = resultado.slice(0, limite)
      const copia = structuredClone(resultado)
      return { data: unico ? (copia[0] ?? null) : copia, error: null }
    }

    const consulta = {
      select: (colunas?: string) => {
        if (operacao === 'select' && colunas && colunas !== '*') {
          colunasPedidas = colunas.split(',').map((coluna) => coluna.trim())
        }
        return consulta
      },
      insert: (novos: Linha | Linha[]) => {
        operacao = 'insert'
        valores = novos
        return consulta
      },
      update: (novos: Linha) => {
        operacao = 'update'
        valores = novos
        return consulta
      },
      delete: () => {
        operacao = 'delete'
        return consulta
      },
      eq: (coluna: string, valor: unknown) => {
        filtros.push([coluna, valor])
        return consulta
      },
      order: (coluna: string, opcoes?: { ascending?: boolean }) => {
        ordem = { coluna, crescente: opcoes?.ascending ?? true }
        return consulta
      },
      limit: (n: number) => {
        limite = n
        return consulta
      },
      single: () => {
        unico = true
        return consulta
      },
      maybeSingle: () => {
        unico = true
        return consulta
      },
      then: <A, B>(ok: (resposta: Resposta) => A, falha?: (motivo: unknown) => B) =>
        Promise.resolve().then(executar).then(ok, falha),
    }
    return consulta
  }

  const storage = {
    from: (bucket: string) => ({
      upload: async () => ({ error: banco.erroEscrita }),
      getPublicUrl: (caminho: string) => ({
        data: { publicUrl: `https://falso.test/${bucket}/${caminho}` },
      }),
    }),
  }

  const functions = {
    invoke: async (nome: string, opcoes?: { body?: unknown }) => {
      if (banco.erroDaFuncao) return { data: null, error: banco.erroDaFuncao }
      banco.funcoesChamadas.push({ nome, body: opcoes?.body })
      return { data: banco.respostaDaFuncao, error: null }
    },
  }

  return { from, storage, functions, banco }
}

export type SupabaseFalso = ReturnType<typeof criarSupabaseFalso>
