import { useState } from 'react'
import type { FormEvent } from 'react'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Pill } from '@/components/ui/Pill'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { porId } from '@/dados/base'
import { useHistoricoDeCampanhas, useRegistrarNoHistorico } from '@/dados/historicoDeCampanha'
import { useTempoReal } from '@/dados/tempoReal'
import { formatarData } from '@/lib/formato'
import { textoOuNull } from '@/lib/formulario'
import { TIPOS_DE_OTIMIZACAO, opcao } from '@/lib/rotulos'
import type { Campaign, Profile, TipoDeOtimizacao } from '@/types/database'
import styles from './campanhas.module.css'

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

interface FormProps {
  campanha: Pick<Campaign, 'id' | 'nome'>
  comHistorico: boolean
  onFechar: () => void
}

/** Formulário rápido: o que mudou, em palavras, e os valores de antes e depois se houver. */
function RegistrarOtimizacao({ campanha, comHistorico, onFechar }: FormProps) {
  const [tipo, setTipo] = useState<TipoDeOtimizacao>('orcamento')
  const [descricao, setDescricao] = useState('')
  const [anterior, setAnterior] = useState('')
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string>()
  const registrar = useRegistrarNoHistorico()
  const toast = useToast()

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const texto = descricao.trim()
    if (comHistorico && texto === '') {
      setErro('Descreva o que foi feito.')
      return
    }
    try {
      await registrar.mutateAsync({
        campanha,
        comHistorico,
        otimizacao: { tipo, descricao: texto, valor_anterior: textoOuNull(anterior), valor_novo: textoOuNull(novo) },
      })
      toast.sucesso('Otimização registrada.')
      onFechar()
    } catch {
      toast.erro('Não foi possível registrar a otimização.')
    }
  }

  return (
    <form className={`${ui.formulario} ${styles.otimizacao}`} onSubmit={aoEnviar} noValidate aria-label="Registrar otimização">
      {comHistorico && (
        <>
          <StatusSelect
            rotulo="Tipo de alteração"
            opcoes={TIPOS_DE_OTIMIZACAO}
            value={tipo}
            onChange={(valor) => setTipo(valor as TipoDeOtimizacao)}
          />
          <AreaTexto
            rotulo="O que foi feito"
            rows={3}
            value={descricao}
            erro={erro}
            onChange={(evento) => {
              setDescricao(evento.target.value)
              setErro(undefined)
            }}
          />
          <div className={ui.duasColunas}>
            <Campo rotulo="Valor anterior" placeholder="R$ 50/dia" value={anterior} onChange={(e) => setAnterior(e.target.value)} />
            <Campo rotulo="Valor novo" placeholder="R$ 80/dia" value={novo} onChange={(e) => setNovo(e.target.value)} />
          </div>
        </>
      )}
      {!comHistorico && (
        <p className={ui.mudo}>
          O histórico de otimizações liga depois da migration 0008. Por enquanto, registrar só marca a
          próxima otimização para daqui a dois dias.
        </p>
      )}
      <div className={ui.acoes}>
        <Button variante="fantasma" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" carregando={registrar.isPending}>
          Registrar
        </Button>
      </div>
    </form>
  )
}

interface HistoricoProps {
  campanha: Pick<Campaign, 'id' | 'nome'>
  perfis: Profile[]
}

/** Otimizações da campanha, da mais recente para a mais antiga, com o botão de registrar. */
export function HistoricoDaCampanha({ campanha, perfis }: HistoricoProps) {
  const historico = useHistoricoDeCampanhas()
  const [registrando, setRegistrando] = useState(false)
  useTempoReal(['campaign_historico'])
  const comHistorico = historico.data !== null
  const itens = (historico.data ?? []).filter((item) => item.campaign_id === campanha.id)
  const perfilPorId = porId(perfis)

  return (
    <section className={styles.historico} aria-label="Histórico de otimizações">
      <div className={styles.historicoTopo}>
        <h3 className={styles.historicoTitulo}>Histórico de otimizações</h3>
        {!registrando && <Button onClick={() => setRegistrando(true)}>Registrar otimização</Button>}
      </div>

      {registrando && (
        <RegistrarOtimizacao campanha={campanha} comHistorico={comHistorico} onFechar={() => setRegistrando(false)} />
      )}

      {historico.isLoading ? null : !comHistorico ? null : itens.length === 0 ? (
        <p className={ui.mudo}>Nenhuma otimização registrada ainda.</p>
      ) : (
        <ol className={styles.linhaDoTempo}>
          {itens.map((item) => {
            const tipo = opcao(TIPOS_DE_OTIMIZACAO, item.tipo)
            const autor = item.user_id ? perfilPorId.get(item.user_id)?.nome : undefined
            return (
              <li key={item.id} className={styles.marco}>
                <div className={styles.marcoTopo}>
                  <Pill tom={tipo.tom}>{tipo.rotulo}</Pill>
                  <span className={ui.mudo}>
                    {formatarData(item.created_at.slice(0, 10))}, {hora(item.created_at)}
                    {autor && `, ${autor}`}
                  </span>
                </div>
                <p className={styles.marcoTexto}>{item.descricao}</p>
                {(item.valor_anterior || item.valor_novo) && (
                  <p className={styles.marcoValores}>
                    {item.valor_anterior ?? 'sem valor'} <span aria-hidden="true">→</span>
                    <span className={ui.somenteLeitor}>para</span> {item.valor_novo ?? 'sem valor'}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
