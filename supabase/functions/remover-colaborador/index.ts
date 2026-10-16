// Edge Function: tira um colaborador da equipe.
//
// Apaga a conta no Auth (exige a chave de serviço, por isso não pode ser feito no navegador). O
// perfil vai junto, as demandas e conteúdos dele ficam sem responsável e os convites pendentes
// do e-mail deixam de valer. Depois, a pessoa recebe um e-mail avisando que o acesso foi
// revogado. Só a liderança remove, e ninguém remove a si mesmo.
//
// Publicar: supabase functions deploy remover-colaborador --project-ref <ref do projeto>
// Segredos: RESEND_API_KEY para o e-mail de aviso. Sem ele, a remoção acontece e o app avisa que
// o e-mail não saiu.

import { exigirLideranca, responder, servir } from '../_shared/acesso.ts'
import { EMPRESA_PADRAO, REMETENTE_PADRAO, emailDeAcessoRevogado, enviarEmail } from '../_shared/emails.ts'

servir('remover-colaborador', async (req) => {
  const acesso = await exigirLideranca(req, 'remover-colaborador', 'remover colaboradores')
  if (acesso instanceof Response) return acesso
  const { admin, usuarioId } = acesso

  let id = ''
  try {
    id = String((await req.json()).id ?? '')
  } catch {
    // corpo ausente ou inválido cai na validação abaixo
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return responder({ erro: 'Colaborador não informado.' })
  if (id === usuarioId) return responder({ erro: 'Você não pode remover a si mesmo.' })

  const { data: perfil, error: erroPerfil } = await admin
    .from('profiles')
    .select('nome, email')
    .eq('id', id)
    .maybeSingle()
  if (erroPerfil) throw erroPerfil
  if (!perfil) return responder({ erro: 'Este colaborador não existe mais.' })

  const { error: erroConta } = await admin.auth.admin.deleteUser(id)
  if (erroConta) {
    console.error('remover-colaborador: deleteUser', erroConta.status, erroConta.message)
    return responder({ erro: `O Supabase não conseguiu apagar a conta: ${erroConta.message}`, detalhe: erroConta.message })
  }

  // Convite pendente do mesmo e-mail não pode trazer a pessoa de volta
  const { error: erroConvites } = await admin
    .from('invite_codes')
    .update({ used: true, used_at: new Date().toISOString() })
    .eq('email', perfil.email.toLowerCase())
    .eq('used', false)
  if (erroConvites) console.error('remover-colaborador: convites', erroConvites.message)

  const chaveResend = Deno.env.get('RESEND_API_KEY')
  let emailEnviado = false
  if (chaveResend) {
    try {
      await enviarEmail(
        chaveResend,
        Deno.env.get('EMAIL_REMETENTE') ?? REMETENTE_PADRAO,
        perfil.email,
        emailDeAcessoRevogado({ nome: perfil.nome, empresa: Deno.env.get('EMPRESA_NOME') ?? EMPRESA_PADRAO }),
      )
      emailEnviado = true
    } catch (falha) {
      console.error('remover-colaborador: envio', falha instanceof Error ? falha.message : falha)
    }
  } else {
    console.error('remover-colaborador: RESEND_API_KEY ausente, e-mail não enviado')
  }

  return responder({ ok: true, emailEnviado })
})
