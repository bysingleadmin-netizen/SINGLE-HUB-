-- Sistema SINGLE: o link de aprovação vale 24 horas; o registro fica guardado
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0013. Pode rodar mais de uma
-- vez. Nada é apagado.
--
-- Dois prazos separados:
--   link_expira_em: depois dele o cliente não vê mais o material nem responde (24 horas)
--   expira_em: o pedido que venceu sem resposta é apagado pela limpeza diária (30 dias)
-- O portal agora diz "Este link expirou" em vez de "Link inválido" e mostra o nome do cliente.

begin;

alter table public.aprovacoes
  add column if not exists link_expira_em timestamptz not null default now() + interval '24 hours';

-- O pedido pelo token. Null só quando o token não existe (ou o pedido já foi apagado).
-- Com o link vencido ou o pedido respondido, o material não vai: só o aviso.
-- Do cliente vai só o nome.
create or replace function public.aprovacao_por_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'titulo', a.titulo,
    'cliente', c.nome,
    'status', a.status,
    'expirado', a.link_expira_em <= now(),
    'respondido', a.respondido_em is not null,
    'conteudo', case
      when a.status = 'pendente' and a.link_expira_em > now() then a.conteudo
      else '[]'::jsonb
    end,
    'comentario', a.comentario,
    'respondido_em', a.respondido_em,
    'link_expira_em', a.link_expira_em
  )
  from public.aprovacoes a
  left join public.clients c on c.id = a.client_id
  where a.token = p_token;
$$;

-- A resposta do cliente. Devolve 'ok', 'invalido' (token não existe), 'expirado' (passou das
-- 24 horas), 'ja_respondido' ou 'comentario_obrigatorio'. Avisa no sino quem cuida do card.
create or replace function public.responder_aprovacao(p_token uuid, p_status text, p_comentario text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.aprovacoes;
  v_comentario text := left(nullif(trim(coalesce(p_comentario, '')), ''), 2000);
  v_titulo text;
begin
  if p_status not in ('aprovado', 'revisao', 'reprovado') then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;

  select * into v from public.aprovacoes where token = p_token for update;
  if not found then
    return 'invalido';
  end if;
  if v.status <> 'pendente' then
    return 'ja_respondido';
  end if;
  if v.link_expira_em <= now() then
    return 'expirado';
  end if;
  if p_status = 'revisao' and v_comentario is null then
    return 'comentario_obrigatorio';
  end if;

  update public.aprovacoes
  set status = p_status, comentario = v_comentario, respondido_em = now()
  where id = v.id;

  v_titulo := case p_status
    when 'aprovado' then 'Material aprovado'
    when 'revisao' then 'Cliente pediu revisão'
    else 'Material reprovado'
  end;
  insert into public.notifications (user_id, tipo, titulo, mensagem, link, lida)
  select distinct pessoa, 'aprovacao', v_titulo,
    format('"%s"%s', v.titulo, coalesce(': ' || v_comentario, '')),
    '/app/conteudo?abrir=' || v.card_id, false
  from (
    select unnest(c.responsaveis) as pessoa from public.content_cards c where c.id = v.card_id
    union select c.responsavel_id from public.content_cards c where c.id = v.card_id
    union select v.created_by
  ) destinatarios
  where pessoa is not null and exists (select 1 from public.profiles p where p.id = pessoa);

  return 'ok';
end;
$$;

revoke all on function public.aprovacao_por_token(uuid) from public;
revoke all on function public.responder_aprovacao(uuid, text, text) from public;
grant execute on function public.aprovacao_por_token(uuid) to anon, authenticated;
grant execute on function public.responder_aprovacao(uuid, text, text) to anon, authenticated;

commit;
