-- Sistema SINGLE: portal de aprovação de materiais (link mágico)
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0012. Pode rodar mais de uma
-- vez. Nada é apagado.
--
-- A equipe gera, num card de Conteúdo, um pedido de aprovação com os materiais (textos,
-- imagens, vídeos e links). O cliente abre /aprovar/<token>, sem login, e aprova, pede revisão
-- ou reprova. Quem não está logado não lê a tabela: só as duas funções abaixo, que acham o
-- pedido pelo token e não devolvem nada de outras tabelas.

begin;

create table if not exists public.aprovacoes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.content_cards (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  token uuid not null unique default gen_random_uuid(),
  -- Título do card quando o link foi gerado: o portal não lê content_cards
  titulo text not null default '',
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'revisao', 'reprovado')),
  -- Lista de { tipo: 'copy' | 'imagem' | 'video' | 'link', valor, label }
  conteudo jsonb not null default '[]'::jsonb check (jsonb_typeof(conteudo) = 'array'),
  comentario text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  respondido_em timestamptz,
  expira_em timestamptz not null default now() + interval '30 days'
);

create index if not exists aprovacoes_card_idx on public.aprovacoes (card_id);

alter table public.aprovacoes enable row level security;

-- A equipe (toda conta logada é da equipe: o cadastro é só por convite) vê e gera os pedidos.
-- Visitante sem login não tem política nenhuma: não lê nem grava a tabela direto.
drop policy if exists "aprovacoes: equipe" on public.aprovacoes;
create policy "aprovacoes: equipe" on public.aprovacoes for all to authenticated
  using (true) with check (true);

-- O pedido pelo token, enquanto não expirou. Null quando não existe ou expirou.
create or replace function public.aprovacao_por_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'titulo', a.titulo,
    'status', a.status,
    'conteudo', a.conteudo,
    'comentario', a.comentario,
    'respondido_em', a.respondido_em,
    'expira_em', a.expira_em
  )
  from public.aprovacoes a
  where a.token = p_token and a.expira_em > now();
$$;

-- A resposta do cliente. Devolve 'ok', 'invalido' (não existe ou expirou), 'ja_respondido' ou
-- 'comentario_obrigatorio' (pedir revisão sem dizer o quê). Avisa no sino quem cuida do card.
create or replace function public.responder_aprovacao(p_token uuid, p_status text, p_comentario text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.aprovacoes;
  v_comentario text := nullif(trim(coalesce(p_comentario, '')), '');
  v_titulo text;
begin
  if p_status not in ('aprovado', 'revisao', 'reprovado') then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;
  if v_comentario is not null and char_length(v_comentario) > 2000 then
    v_comentario := left(v_comentario, 2000);
  end if;

  select * into v from public.aprovacoes
  where token = p_token and expira_em > now()
  for update;
  if not found then
    return 'invalido';
  end if;
  if v.status <> 'pendente' then
    return 'ja_respondido';
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

-- Limpeza diária dos pedidos expirados, às 03:30 (UTC), com pg_cron (ligado desde a 0003)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'limpar-aprovacoes',
    '30 3 * * *',
    'delete from public.aprovacoes where expira_em < now()'
  );
exception when others then
  raise notice 'pg_cron indisponível (%): a limpeza das aprovações não foi agendada.', sqlerrm;
end $$;

-- Tempo real: o selo de aprovação no card muda assim que o cliente responde
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'aprovacoes'
     ) then
    alter publication supabase_realtime add table public.aprovacoes;
  end if;
end $$;

commit;
