// Edge Function: convida um colaborador por e-mail.
//
// Gera um código de 6 caracteres, guarda em invite_codes com o cargo escolhido e manda o código
// por e-mail pelo Resend. A pessoa cria a conta na tela de login ("Criar conta") com o e-mail e
// o código; a função usar_codigo_convite aplica o cargo. Só a liderança convida.
//
// Publicar: supabase functions deploy convidar-colaborador --project-ref <ref do projeto>
// O nome precisa ser exatamente `convidar-colaborador`: é por ele que o app chama.
// Segredos: RESEND_API_KEY (obrigatório). EMAIL_REMETENTE, EMPRESA_NOME e APP_URL são opcionais
// (ver _shared/emails.ts).

import { exigirLideranca, responder, servir } from '../_shared/acesso.ts'
import { APP_PADRAO, EMPRESA_PADRAO, REMETENTE_PADRAO, emailDeConvite, enviarEmail } from '../_shared/emails.ts'

const CARGOS = ['Liderança', 'Gestor de Tráfego', 'SDR', 'Closer', 'Estrategista & Analista', 'Colaborador']

// Sem letras e números que se confundem (O e 0, I e 1)
const CARACTERES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function gerarCodigo(): string {
  const sorteio = crypto.getRandomValues(new Uint32Array(6))
  return Array.from(sorteio, (n) => CARACTERES[n % CARACTERES.length]).join('')
}

servir('convidar-colaborador', async (req) => {
  const acesso = await exigirLideranca(req, 'convidar-colaborador', 'convidar colaboradores')
  if (acesso instanceof Response) return acesso
  const { admin, usuarioId } = acesso

  let corpo: { email?: unknown; nome?: unknown; cargo?: unknown } = {}
  try {
    corpo = await req.json()
  } catch {
    // corpo ausente ou inválido cai na validação abaixo
  }
  const email = String(corpo.email ?? '').trim().toLowerCase()
  const nome = String(corpo.nome ?? '').trim().slice(0, 80)
  const cargo = String(corpo.cargo ?? '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responder({ erro: 'Informe um e-mail válido.' })
  if (!CARGOS.includes(cargo)) return responder({ erro: 'Escolha um cargo da lista.' })

  const chaveResend = Deno.env.get('RESEND_API_KEY')
  if (!chaveResend) {
    return responder({ erro: 'Falta RESEND_API_KEY em Edge Functions > Secrets no Supabase.' })
  }

  const { data: jaExiste, error: erroBusca } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (erroBusca) throw erroBusca
  if (jaExiste) return responder({ erro: 'Este e-mail já tem acesso ao sistema.' })

  // Um convite novo invalida os anteriores do mesmo e-mail
  const { error: erroAntigos } = await admin
    .from('invite_codes')
    .update({ used: true, used_at: new Date().toISOString() })
    .eq('email', email)
    .eq('used', false)
  if (erroAntigos) throw erroAntigos

  const codigo = gerarCodigo()
  const { error: erroConvite } = await admin.from('invite_codes').insert({
    email,
    cargo,
    code: codigo,
    created_by: usuarioId,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })
  if (erroConvite) throw erroConvite

  const mensagem = emailDeConvite({
    nome,
    cargo,
    codigo,
    empresa: Deno.env.get('EMPRESA_NOME') ?? EMPRESA_PADRAO,
    app: Deno.env.get('APP_URL') ?? APP_PADRAO,
  })
  try {
    await enviarEmail(chaveResend, Deno.env.get('EMAIL_REMETENTE') ?? REMETENTE_PADRAO, email, mensagem)
  } catch (falha) {
    const detalhe = falha instanceof Error ? falha.message : String(falha)
    console.error('convidar-colaborador: envio', detalhe)
    return responder({ erro: 'O convite foi criado, mas o e-mail não saiu. Tente de novo em instantes.', detalhe })
  }

  return responder({ ok: true })
})
