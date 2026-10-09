import { semAcentos } from '@/lib/texto'
import type { Campaign, Client, ContentCard, Task } from '@/types/database'

export type TipoDeResultado = 'cliente' | 'demanda' | 'conteudo' | 'campanha'

export interface Resultado {
  tipo: TipoDeResultado
  id: string
  nome: string
  /** Para onde o resultado leva dentro do app */
  rota: string
}

interface Acervo {
  clientes: Pick<Client, 'id' | 'nome'>[]
  tarefas: Pick<Task, 'id' | 'titulo' | 'status'>[]
  cards: Pick<ContentCard, 'id' | 'titulo' | 'etapa'>[]
  campanhas: Pick<Campaign, 'id' | 'nome'>[]
}

const LIMITE = 12

/** Procura o termo em clientes, demandas, conteúdos e anúncios, sem ligar para acentos. */
export function buscar(termo: string, acervo: Acervo): Resultado[] {
  const alvo = semAcentos(termo.trim())
  if (alvo === '') return []
  const casa = (texto: string) => semAcentos(texto).includes(alvo)

  return [
    ...acervo.clientes
      .filter((c) => casa(c.nome))
      .map((c): Resultado => ({ tipo: 'cliente', id: c.id, nome: c.nome, rota: `/app/clientes/${c.id}` })),
    ...acervo.tarefas
      .filter((t) => t.status !== 'arquivado' && casa(t.titulo))
      .map((t): Resultado => ({
        tipo: 'demanda',
        id: t.id,
        nome: t.titulo,
        rota: `/app/demandas?abrir=${t.id}`,
      })),
    ...acervo.cards
      .filter((c) => c.etapa !== 'arquivado' && casa(c.titulo))
      .map((c): Resultado => ({
        tipo: 'conteudo',
        id: c.id,
        nome: c.titulo,
        rota: `/app/conteudo?abrir=${c.id}`,
      })),
    ...acervo.campanhas
      .filter((c) => casa(c.nome))
      .map((c): Resultado => ({
        tipo: 'campanha',
        id: c.id,
        nome: c.nome,
        rota: `/app/anuncios/${c.id}`,
      })),
  ].slice(0, LIMITE)
}
