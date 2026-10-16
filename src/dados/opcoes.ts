import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import { useColunasOpcionais } from '@/dados/esquema'
import type { Tom } from '@/lib/rotulos'
import { supabase } from '@/lib/supabase'
import type { CampoConfiguravel, CardOption } from '@/types/database'

// Campos configuráveis dos cards: status, prioridade, tipo de conteúdo e área das demandas.
//
// Cada campo nasce com as opções fixas do código (src/lib/rotulos.ts). A equipe pode renomear
// qualquer uma e criar novas; isso fica em `card_options` (migration 0003). O card grava a
// chave da opção, então renomear não toca em nenhum card.
//
// O sistema atende uma agência só (não há workspaces no banco), então as opções valem para
// todo mundo. As chaves de fábrica mantêm o comportamento que o sistema dá a elas: 'feito'
// continua fazendo o card andar de coluna, mesmo se a equipe chamar de "Pronto".
//
// Sem a tabela, os campos mostram as opções fixas e a engrenagem não aparece.

export interface OpcaoDeCampo {
  valor: string
  rotulo: string
  tom: Tom
  /** Criada pela equipe; pode ser removida */
  personalizada?: boolean
  /** #rrggbb escolhida na engrenagem; sem ela vale a cor do tom */
  cor?: string
  /** Removida da lista: some dos seletores, mas os cards que a usam ainda mostram o nome */
  oculta?: boolean
}

// Códigos da API e do Postgres para "tabela não existe"
const TABELA_AUSENTE = new Set(['PGRST205', '42P01'])

/** Junta as opções fixas com o que a equipe salvou: a ordem e os nomes salvos valem. */
export function montarOpcoes(
  padrao: readonly OpcaoDeCampo[],
  salvas: Pick<CardOption, 'chave' | 'titulo' | 'posicao' | 'cor' | 'oculta'>[],
): OpcaoDeCampo[] {
  if (salvas.length === 0) return [...padrao]
  const fixas = new Map(padrao.map((opcao) => [opcao.valor, opcao]))
  const ordenadas = [...salvas]
    .sort((a, b) => a.posicao - b.posicao)
    .map((linha): OpcaoDeCampo => {
      const fixa = fixas.get(linha.chave)
      const cor = linha.cor ?? undefined
      const extra = linha.oculta ? { oculta: true } : {}
      return fixa
        ? { ...fixa, rotulo: linha.titulo, cor, ...extra }
        : { valor: linha.chave, rotulo: linha.titulo, tom: 'cinza', personalizada: true, cor, ...extra }
    })
  const presentes = new Set(ordenadas.map((opcao) => opcao.valor))
  return [...ordenadas, ...padrao.filter((opcao) => !presentes.has(opcao.valor))]
}

export interface EdicaoDeOpcoes {
  renomear: (valor: string, rotulo: string) => void
  criar: (rotulo: string) => void
  remover: (valor: string) => void
  /** Só com a coluna de cor no banco (migration 0004) */
  colorir?: (valor: string, cor: string) => void
  /** Remover só esconde a opção (migration 0010): até as de fábrica podem sair da lista */
  ocultar?: boolean
}

export function useOpcoes(campo: CampoConfiguravel, padrao: readonly OpcaoDeCampo[]) {
  const queryClient = useQueryClient()
  const esquema = useColunasOpcionais()
  const toast = useToast()
  const consulta = useQuery({
    queryKey: ['card_options'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_options')
        .select('*')
        .order('posicao', { ascending: true })
      if (error) {
        if (TABELA_AUSENTE.has(error.code ?? '')) return null
        throw error
      }
      return (data ?? []) as CardOption[]
    },
  })

  const salvas = (consulta.data ?? []).filter((linha) => linha.campo === campo)
  const todas = montarOpcoes(padrao, salvas)
  // Nos seletores, só as que não foram removidas
  const opcoes = todas.filter((item) => !item.oculta)
  /** A opção de um valor, mesmo removida; valor desconhecido aparece como veio */
  const opcao = (valor: string | null | undefined): OpcaoDeCampo | undefined =>
    valor == null || valor === ''
      ? undefined
      : (todas.find((item) => item.valor === valor) ?? { valor, rotulo: valor, tom: 'cinza' })

  /** Na primeira edição, as opções atuais vão para o banco, e a mudança é feita sobre elas. */
  async function semear() {
    if (salvas.length > 0) return
    const { error } = await supabase
      .from('card_options')
      .insert(
        todas.map((item, i) => ({
          campo,
          chave: item.valor,
          titulo: item.rotulo,
          posicao: i + 1,
          ...(esquema.corDasOpcoes ? { cor: item.cor ?? null } : {}),
        })),
      )
    if (error) throw error
  }

  async function executar(acao: () => Promise<void>, sucesso: string) {
    try {
      await semear()
      await acao()
      toast.sucesso(sucesso)
    } catch {
      toast.erro('Não foi possível salvar as opções.')
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['card_options'] })
    }
  }

  const edicao: EdicaoDeOpcoes | undefined =
    consulta.data == null
      ? undefined
      : {
          renomear: (valor, rotulo) =>
            void executar(async () => {
              const { error } = await supabase
                .from('card_options')
                .update({ titulo: rotulo })
                .eq('campo', campo)
                .eq('chave', valor)
              if (error) throw error
            }, 'Opção renomeada.'),
          criar: (rotulo) =>
            void executar(async () => {
              const { error } = await supabase.from('card_options').insert({
                campo,
                chave: `personalizada_${Date.now().toString(36)}`,
                titulo: rotulo,
                posicao: todas.length + 1,
              })
              if (error) throw error
            }, 'Opção criada.'),
          remover: (valor) =>
            void executar(async () => {
              // Com a coluna oculta, remover só esconde: os cards que usam a opção continuam com o nome
              const { error } = esquema.opcaoOculta
                ? await supabase.from('card_options').update({ oculta: true }).eq('campo', campo).eq('chave', valor)
                : await supabase.from('card_options').delete().eq('campo', campo).eq('chave', valor)
              if (error) throw error
            }, 'Opção removida.'),
          ocultar: esquema.opcaoOculta,
          ...(esquema.corDasOpcoes
            ? {
                colorir: (valor: string, cor: string) =>
                  void executar(async () => {
                    const { error } = await supabase
                      .from('card_options')
                      .update({ cor })
                      .eq('campo', campo)
                      .eq('chave', valor)
                    if (error) throw error
                  }, 'Cor salva.'),
              }
            : {}),
        }

  // A área das demandas só é configurável depois da migration 0010
  return { opcoes, opcao, edicao: campo === 'area' && !esquema.opcaoOculta ? undefined : edicao }
}
