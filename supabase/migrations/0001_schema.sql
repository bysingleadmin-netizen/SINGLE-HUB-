-- Sistema SINGLE: schema inicial
-- Rode este arquivo inteiro no SQL Editor do Supabase (ou via `supabase db push`).

-- ---------------------------------------------------------------------------
-- Perfis e cargos
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  cargo text not null default 'Social Media' check (
    cargo in (
      'CEO', 'Founder', 'Co-Founder',
      'Gestor de Tráfego', 'Social Media', 'Designer', 'Editor de Vídeo', 'Copywriter'
    )
  ),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Fica fora do schema exposto pela API para não virar um endpoint RPC.
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.is_lideranca()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and cargo in ('CEO', 'Founder', 'Co-Founder')
  );
$$;

revoke all on function private.is_lideranca() from public;
grant execute on function private.is_lideranca() to authenticated;

-- Todo usuário criado no Auth ganha um perfil.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Só a liderança muda cargo. Sem usuário logado (SQL Editor) a troca é livre,
-- e é assim que o primeiro CEO é definido.
create function private.proteger_cargo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cargo is distinct from old.cargo
     and (select auth.uid()) is not null
     and not private.is_lideranca() then
    raise exception 'Apenas a liderança pode alterar cargos.';
  end if;
  return new;
end;
$$;

create trigger proteger_cargo
  before update on public.profiles
  for each row execute function private.proteger_cargo();

-- ---------------------------------------------------------------------------
-- Clientes e pagamentos
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  logo_url text,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'churn')),
  mrr numeric(12, 2) not null default 0 check (mrr >= 0),
  data_inicio_contrato date,
  instagram text,
  link_conta_anuncios text,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- sempre o primeiro dia do mês
  mes_referencia date not null check (extract(day from mes_referencia) = 1),
  valor numeric(12, 2) not null check (valor >= 0),
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado')),
  created_at timestamptz not null default now(),
  unique (client_id, mes_referencia)
);

create index client_payments_status_idx on public.client_payments (status);
create index client_payments_data_pagamento_idx on public.client_payments (data_pagamento);

-- ---------------------------------------------------------------------------
-- Demandas e conteúdo
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  client_id uuid references public.clients (id) on delete set null,
  responsavel_id uuid references public.profiles (id) on delete set null,
  tipo text not null check (tipo in ('conteudo', 'trafego', 'estrategia', 'audiovisual')),
  status text not null default 'a_fazer' check (
    status in ('a_fazer', 'em_andamento', 'aguardando_aprovacao', 'concluido', 'arquivado')
  ),
  data_entrega date,
  posicao double precision not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tasks_status_idx on public.tasks (status);
create index tasks_client_id_idx on public.tasks (client_id);
create index tasks_responsavel_id_idx on public.tasks (responsavel_id);

create table public.content_cards (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo_conteudo text not null check (
    tipo_conteudo in ('reels', 'carrossel', 'post', 'stories', 'video')
  ),
  client_id uuid references public.clients (id) on delete set null,
  responsavel_id uuid references public.profiles (id) on delete set null,
  etapa text not null default 'captar_material' check (
    etapa in ('captar_material', 'editar', 'aguardando_aprovacao', 'publicado', 'arquivado')
  ),
  data_entrega date,
  observacoes text,
  posicao double precision not null default 0,
  created_at timestamptz not null default now()
);

create index content_cards_etapa_idx on public.content_cards (etapa);
create index content_cards_client_id_idx on public.content_cards (client_id);
create index content_cards_responsavel_id_idx on public.content_cards (responsavel_id);

-- ---------------------------------------------------------------------------
-- Campanhas
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  client_id uuid not null references public.clients (id) on delete restrict,
  status text not null default 'planejamento' check (
    status in ('planejamento', 'em_execucao', 'pausada', 'finalizada')
  ),
  data_inicio date,
  data_fim date,
  orcamento numeric(12, 2) not null default 0 check (orcamento >= 0),
  estrategia text,
  proxima_otimizacao date,
  created_at timestamptz not null default now()
);

create index campaigns_client_id_idx on public.campaigns (client_id);
create index campaigns_status_idx on public.campaigns (status);

create table public.campaign_tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  funcao text not null check (
    funcao in ('copy', 'criativos', 'captacao_material', 'trafego', 'estrategia')
  ),
  titulo text not null,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido')),
  responsavel_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index campaign_tasks_campaign_id_idx on public.campaign_tasks (campaign_id);
create index campaign_tasks_responsavel_id_idx on public.campaign_tasks (responsavel_id);

-- ---------------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null,
  valor numeric(12, 2) not null check (valor >= 0),
  data date not null,
  forma_pagamento text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index expenses_data_idx on public.expenses (data);

create table public.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique check (extract(day from mes) = 1),
  meta numeric(12, 2) not null check (meta >= 0),
  created_at timestamptz not null default now()
);

create table public.traffic_metrics (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique check (extract(day from mes) = 1),
  investimento numeric(12, 2) not null default 0 check (investimento >= 0),
  leads_instagram integer not null default 0 check (leads_instagram >= 0),
  leads_whatsapp integer not null default 0 check (leads_whatsapp >= 0),
  convertidos integer not null default 0 check (convertidos >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Registro de atividade
-- ---------------------------------------------------------------------------

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  acao text not null,
  descricao text not null,
  entidade text,
  entidade_id uuid,
  created_at timestamptz not null default now()
);

create index activity_log_created_at_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------------

grant select, update on public.profiles to authenticated;
grant select, insert on public.activity_log to authenticated;
grant select, insert, update, delete on
  public.clients,
  public.client_payments,
  public.tasks,
  public.content_cards,
  public.campaigns,
  public.campaign_tasks,
  public.expenses,
  public.monthly_goals,
  public.traffic_metrics
to authenticated;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_payments enable row level security;
alter table public.tasks enable row level security;
alter table public.content_cards enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_tasks enable row level security;
alter table public.expenses enable row level security;
alter table public.monthly_goals enable row level security;
alter table public.traffic_metrics enable row level security;
alter table public.activity_log enable row level security;

-- Perfis: todos leem; cada um edita o próprio; a liderança edita qualquer um.
create policy "perfis: leitura" on public.profiles
  for select to authenticated using (true);

create policy "perfis: edicao" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_lideranca()))
  with check (id = (select auth.uid()) or (select private.is_lideranca()));

-- Operacional: qualquer membro autenticado lê e escreve.
create policy "clientes: equipe" on public.clients
  for all to authenticated using (true) with check (true);

create policy "demandas: equipe" on public.tasks
  for all to authenticated using (true) with check (true);

create policy "conteudo: equipe" on public.content_cards
  for all to authenticated using (true) with check (true);

create policy "campanhas: equipe" on public.campaigns
  for all to authenticated using (true) with check (true);

create policy "tarefas de campanha: equipe" on public.campaign_tasks
  for all to authenticated using (true) with check (true);

-- Financeiro: somente liderança.
create policy "pagamentos: lideranca" on public.client_payments
  for all to authenticated
  using ((select private.is_lideranca()))
  with check ((select private.is_lideranca()));

create policy "despesas: lideranca" on public.expenses
  for all to authenticated
  using ((select private.is_lideranca()))
  with check ((select private.is_lideranca()));

create policy "metas: lideranca" on public.monthly_goals
  for all to authenticated
  using ((select private.is_lideranca()))
  with check ((select private.is_lideranca()));

create policy "metricas de trafego: lideranca" on public.traffic_metrics
  for all to authenticated
  using ((select private.is_lideranca()))
  with check ((select private.is_lideranca()));

-- Atividade: leitura para todos, cada um registra em seu próprio nome, sem edição.
create policy "atividade: leitura" on public.activity_log
  for select to authenticated using (true);

create policy "atividade: registro" on public.activity_log
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "logos: equipe le" on storage.objects
  for select to authenticated using (bucket_id = 'logos');

create policy "logos: equipe envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'logos');

create policy "logos: equipe atualiza" on storage.objects
  for update to authenticated using (bucket_id = 'logos') with check (bucket_id = 'logos');

create policy "logos: equipe remove" on storage.objects
  for delete to authenticated using (bucket_id = 'logos');

-- Avatares ficam em uma pasta com o id do usuário: avatars/<uid>/arquivo
create policy "avatars: equipe le" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

create policy "avatars: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: dono atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: dono remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
