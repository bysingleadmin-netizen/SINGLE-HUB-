import { useState } from 'react'
import styles from '@/components/quadro/detalhe.module.css'
import { useEdicaoInline } from '@/components/quadro/useEdicaoInline'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Campo } from '@/components/ui/Campo'
import { Drawer } from '@/components/ui/Drawer'
import { Pill } from '@/components/ui/Pill'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useColunasOpcionais } from '@/dados/esquema'
import { textoOuNull } from '@/lib/formulario'
import type { Lead, TemperaturaDoLead } from '@/types/database'
import { ETAPAS_DO_LEAD, TEMPERATURAS, tempoNaEtapa } from './crm'
import crm from './crm.module.css'

type CampoDeTexto =
  | 'empresa'
  | 'telefone'
  | 'origem'
  | 'instagram'
  | 'cidade'
  | 'segmento'
  | 'faturamento_medio'
  | 'tamanho_equipe'
  | 'observacoes'

interface TextoInlineProps {
  lead: Lead
  campo: CampoDeTexto
  rotulo: string
  placeholder?: string
  type?: string
  /** Texto longo: área de várias linhas */
  longo?: boolean
  onSalvar: (campo: CampoDeTexto, valor: string | null) => void
}

/** Campo que salva sozinho ao sair dele, só se o valor mudou. */
function TextoInline({ lead, campo, rotulo, placeholder, type, longo = false, onSalvar }: TextoInlineProps) {
  const [valor, setValor] = useState(lead[campo] ?? '')
  const salvar = () => {
    const novo = textoOuNull(valor)
    if (novo !== (lead[campo] ?? null)) onSalvar(campo, novo)
  }
  return longo ? (
    <AreaTexto
      rotulo={rotulo}
      placeholder={placeholder}
      value={valor}
      onChange={(evento) => setValor(evento.target.value)}
      onBlur={salvar}
    />
  ) : (
    <Campo
      rotulo={rotulo}
      placeholder={placeholder}
      type={type}
      value={valor}
      onChange={(evento) => setValor(evento.target.value)}
      onBlur={salvar}
    />
  )
}

interface LeadDrawerProps {
  lead: Lead
  onFechar: () => void
}

/** Painel do lead: cada campo salva sozinho, como nos painéis dos quadros. */
export function LeadDrawer({ lead, onFechar }: LeadDrawerProps) {
  const [nome, setNome] = useState(lead.nome)
  const [erroNome, setErroNome] = useState<string>()
  const esquema = useColunasOpcionais()
  const salvar = useEdicaoInline<Lead>('leads', lead.id, {
    sucesso: 'Lead atualizado.',
    erro: 'Não foi possível salvar o lead.',
  })
  const salvarTexto = (campo: CampoDeTexto, valor: string | null) => salvar({ [campo]: valor })
  const texto = (campo: CampoDeTexto, rotulo: string, extra: Partial<TextoInlineProps> = {}) => (
    <TextoInline lead={lead} campo={campo} rotulo={rotulo} onSalvar={salvarTexto} {...extra} />
  )
  const etapa = ETAPAS_DO_LEAD.find((item) => item.id === lead.etapa)?.titulo
  const temperatura = TEMPERATURAS.find((item) => item.valor === (lead.temperatura ?? 'frio'))

  function salvarNome() {
    const limpo = nome.trim()
    if (limpo === '') {
      setErroNome('Informe o nome do lead.')
      setNome(lead.nome)
      return
    }
    setErroNome(undefined)
    if (limpo !== lead.nome) salvar({ nome: limpo })
  }

  return (
    <Drawer aberto titulo={lead.nome} onFechar={onFechar}>
      <div className={styles.detalhe}>
        <div className={styles.resumo}>
          {etapa && <Pill tom="cinza">{etapa}</Pill>}
          {esquema.perfilDoLead && temperatura && <Pill tom={temperatura.tom}>{temperatura.rotulo}</Pill>}
          <span className={styles.prazo}>{tempoNaEtapa(lead.etapa_desde)}</span>
        </div>

        <Campo
          className={styles.titulo}
          rotulo="Nome"
          value={nome}
          erro={erroNome}
          onChange={(evento) => setNome(evento.target.value)}
          onBlur={salvarNome}
        />

        <section className={styles.bloco} aria-label="Contato">
          <h3 className={styles.blocoTitulo}>Contato</h3>
          <div className={styles.propriedades}>
            {texto('empresa', 'Empresa')}
            {texto('origem', 'Origem', { placeholder: 'Instagram, indicação...' })}
          </div>
        </section>

        <section className={styles.bloco} aria-label="Perfil">
          <h3 className={styles.blocoTitulo}>Perfil</h3>
          <div className={crm.perfil}>
            <div className={crm.perfilColuna}>
              {texto('telefone', 'Telefone', { type: 'tel', placeholder: '(27) 99999-0000' })}
              {esquema.perfilDoLead && (
                <>
                  {texto('instagram', 'Instagram', { placeholder: '@perfil' })}
                  {texto('cidade', 'Cidade')}
                  <StatusSelect
                    rotulo="Temperatura"
                    opcoes={TEMPERATURAS}
                    value={lead.temperatura ?? 'frio'}
                    onChange={(valor) => salvar({ temperatura: valor as TemperaturaDoLead })}
                  />
                </>
              )}
            </div>
            {esquema.perfilDoLead && (
              <div className={crm.perfilColuna}>
                {texto('segmento', 'Segmento', { placeholder: 'Odontologia, varejo...' })}
                {texto('faturamento_medio', 'Faturamento médio', { placeholder: 'R$ 50 mil por mês' })}
                {texto('tamanho_equipe', 'Tamanho da equipe', { placeholder: '5 pessoas' })}
              </div>
            )}
          </div>
          {esquema.perfilDoLead && (
            <div className={crm.perfilLargo}>{texto('observacoes', 'Observações', { longo: true })}</div>
          )}
        </section>
      </div>
    </Drawer>
  )
}
