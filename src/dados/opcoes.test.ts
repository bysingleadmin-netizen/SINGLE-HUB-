vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { COR_DO_TOM, SITUACOES, corDe } from '@/lib/rotulos'
import { montarOpcoes } from './opcoes'
import type { OpcaoDeCampo } from './opcoes'

const PADRAO: OpcaoDeCampo[] = [
  { valor: 'travado', rotulo: 'Travado', tom: 'vermelho' },
  { valor: 'feito', rotulo: 'Feito', tom: 'verde' },
]

describe('montarOpcoes', () => {
  it('sem nada salvo, valem as opções fixas', () => {
    expect(montarOpcoes(PADRAO, [])).toEqual(PADRAO)
  })

  it('o nome salvo vale, e a opção de fábrica mantém a chave e a cor', () => {
    const opcoes = montarOpcoes(PADRAO, [
      { chave: 'feito', titulo: 'Pronto', posicao: 1 },
      { chave: 'travado', titulo: 'Travado', posicao: 2 },
    ])
    expect(opcoes).toEqual([
      { valor: 'feito', rotulo: 'Pronto', tom: 'verde' },
      { valor: 'travado', rotulo: 'Travado', tom: 'vermelho' },
    ])
  })

  it('opção criada pela equipe entra como personalizada', () => {
    const opcoes = montarOpcoes(PADRAO, [{ chave: 'personalizada_1', titulo: 'Em revisão', posicao: 1 }])
    expect(opcoes[0]).toEqual({
      valor: 'personalizada_1',
      rotulo: 'Em revisão',
      tom: 'cinza',
      personalizada: true,
    })
    // As fixas que não foram salvas continuam disponíveis, depois das salvas
    expect(opcoes.slice(1)).toEqual(PADRAO)
  })
})

describe('cor das opções', () => {
  it('a cor salva vale; sem cor salva, vale a do tom de fábrica', () => {
    const opcoes = montarOpcoes(SITUACOES, [
      { chave: 'travado', titulo: 'Travado', posicao: 1, cor: '#123456' },
      { chave: 'em_andamento', titulo: 'Em andamento', posicao: 2, cor: null },
    ])
    expect(opcoes[0].cor).toBe('#123456')
    expect(opcoes[1].cor).toBeUndefined()
    expect(corDe(opcoes[0])).toBe('#123456')
    expect(corDe(opcoes[1])).toBe('#4a9eff')
    expect(COR_DO_TOM.verde).toBe('#3ecf8e')
  })
})

describe('opções ocultas', () => {
  it('a removida vem marcada, e a de fábrica removida não volta pela lista fixa', () => {
    const opcoes = montarOpcoes(PADRAO, [
      { chave: 'travado', titulo: 'Travado', posicao: 1, oculta: true },
      { chave: 'feito', titulo: 'Feito', posicao: 2 },
    ])
    expect(opcoes).toEqual([
      { valor: 'travado', rotulo: 'Travado', tom: 'vermelho', oculta: true },
      { valor: 'feito', rotulo: 'Feito', tom: 'verde' },
    ])
  })
})
