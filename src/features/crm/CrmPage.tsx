import { useState } from 'react'
import { Quadro } from '@/components/quadro/Quadro'
import { proximaPosicao } from '@/components/quadro/colunas'
import { useMover } from '@/components/quadro/useMover'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useExcluir } from '@/dados/excluir'
import { registrarMudancaDeEtapa, useLeads } from '@/dados/leads'
import { useAuth } from '@/features/auth/AuthContext'
import type { EtapaDoLead, Lead } from '@/types/database'
import { ConverterLeadModal } from './ConverterLeadModal'
import { LeadModal } from './LeadModal'
import { ETAPAS_DO_LEAD, linkDoWhatsapp, tempoNaEtapa } from './crm'
import styles from './crm.module.css'

type Formulario = { lead?: Lead; etapa: EtapaDoLead } | undefined

/** Pipeline de leads da liderança: Leads, Reunião, Fechamento de contrato e, ao fim, Cliente. */
export function CrmPage() {
  const leads = useLeads()
  const { perfil } = useAuth()
  const [formulario, setFormulario] = useState<Formulario>()
  const [convertendo, setConvertendo] = useState<Lead>()
  // O histórico do lead sai junto (on delete cascade)
  const excluir = useExcluir<Lead>({ tabela: 'leads' })
  const toast = useToast()

  const mover = useMover<Lead>({
    tabela: 'leads',
    campo: 'etapa',
    sucesso: (_lead, destino) => `Lead movido para ${ETAPAS_DO_LEAD.find((e) => e.id === destino)?.titulo}.`,
    erro: 'Não foi possível mover o lead.',
    atividade: () => null,
    extras: () => ({ etapa_desde: new Date().toISOString() }),
  })

  if (leads.isError) return <EstadoErro onTentar={() => void leads.refetch()} />
  if (leads.isLoading) return <Skeleton altura="220px" raio="var(--radius)" />
  if (leads.data === null) {
    return (
      <EstadoVazio
        ilustracao="clientes"
        titulo="O CRM liga depois da migration 0004."
        texto="Peça a quem administra o Supabase para rodar supabase/migrations/0004_etapa8.sql."
      />
    )
  }

  const noPipeline = (leads.data ?? []).filter((lead) => lead.convertido_em == null)
  const posicaoNova = (etapa: EtapaDoLead) => proximaPosicao(noPipeline.filter((l) => l.etapa === etapa))

  function aoMover(lead: Lead, destino: string) {
    if (destino === lead.etapa) return
    // Cliente não guarda card: abre a conversão, e o lead só sai quando ela der certo
    if (destino === 'cliente') {
      setConvertendo(lead)
      return
    }
    mover(lead, destino, noPipeline)
    void registrarMudancaDeEtapa(lead.id, lead.etapa, destino, perfil?.id)
  }

  return (
    <div className={styles.pagina}>
      <Quadro
        colunas={ETAPAS_DO_LEAD}
        itens={noPipeline}
        colunaDe={(lead) => lead.etapa}
        tituloDe={(lead) => lead.nome}
        renderCard={(lead) => (
          <div className={styles.card}>
            <strong className={styles.nome}>{lead.nome}</strong>
            {lead.empresa && <span className={styles.empresa}>{lead.empresa}</span>}
            {lead.origem && <span className={styles.origem}>{lead.origem}</span>}
            <span className={styles.tempo}>{tempoNaEtapa(lead.etapa_desde)}</span>
          </div>
        )}
        renderRodape={(lead) => {
          const whatsapp = linkDoWhatsapp(lead.telefone)
          return lead.telefone ? (
            <div className={styles.rodape}>
              <span className={styles.telefone}>{lead.telefone}</span>
              {whatsapp && (
                <a
                  className={styles.whatsapp}
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp de ${lead.nome}`}
                >
                  <Icone nome="externo" tamanho={14} />
                  WhatsApp
                </a>
              )}
            </div>
          ) : null
        }}
        podeCriar={(coluna) => coluna !== 'cliente'}
        onMover={aoMover}
        onCriar={(coluna) => setFormulario({ etapa: coluna as EtapaDoLead })}
        onAbrir={(lead) => setFormulario({ lead, etapa: lead.etapa })}
        onExcluir={(lead) =>
          excluir.mutate(lead.id, {
            onSuccess: () => toast.sucesso('Lead excluído.'),
            onError: () => toast.erro('Não foi possível excluir o lead.'),
          })
        }
      />

      {formulario && (
        <LeadModal
          key={formulario.lead?.id ?? `novo-${formulario.etapa}`}
          lead={formulario.lead}
          etapa={formulario.etapa}
          posicao={posicaoNova(formulario.etapa)}
          onFechar={() => setFormulario(undefined)}
        />
      )}
      {convertendo && <ConverterLeadModal lead={convertendo} onFechar={() => setConvertendo(undefined)} />}
    </div>
  )
}
