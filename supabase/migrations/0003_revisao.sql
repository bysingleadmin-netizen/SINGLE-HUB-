-- Sistema SINGLE: revisão (pagamentos recorrentes, quadros personalizáveis, RLS e índices)
--
-- Rode este arquivo inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez sem problema:
-- cada passo confere antes se já foi feito. Se algum passo falhar, nada é aplicado.
--
-- Ele inclui o que estava na migration 0002; quem não rodou a 0002 só precisa rodar esta.
-- O app funciona sem esta migration, com menos recursos (veja docs/INTEGRACOES.md).

begin;

-- ---------------------------------------------------------------------------
-- 1. Pagamentos recorrentes
-- ---------------------------------------------------------------------------
-- A tabela de pagamentos continua sendo client_payments, com client_id (e não cliente_id):
-- renomear quebraria as políticas e o código já publicado sem mudar nada para quem usa.

-- Dia do mês em que o cliente paga. Sem ele, vale o dia em que o contrato começou.
alter table public.clients
  add column if not exists dia_vencimento smallint
  check (dia_vencimento between 1 and 31);

alter table public.client_payments
  add column if not exists forma_pagamento text
  check (forma_pagamento in ('pix', 'dinheiro'));

-- Pago e guardado no histórico. Cobrança paga nunca é apagada.
alter table public.client_payments
  add column if not exists arquivado boolean not null default false;

update public.client_payments set arquivado = true where status = 'pago' and not arquivado;

-- Novo status "cancelado": cobrança em aberto de cliente que deixou de ser ativo.
-- O nome da restrição antiga não é garantido, então ela é localizada pela definição.
do $$
declare
  restricao record;
begin
  for restricao in
    select conname
    from pg_constraint
    where conrelid = 'public.client_payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.client_payments drop constraint %I', restricao.conname);
  end loop;
end $$;

alter table public.client_payments
  add constraint client_payments_status_check
  check (status in ('pendente', 'pago', 'atrasado', 'cancelado'));

-- ---------------------------------------------------------------------------
-- 2. Prioridade das demandas e dos conteúdos
-- ---------------------------------------------------------------------------
-- tasks.prioridade já existia no banco, criada pelo painel, sem valores garantidos.
-- Aqui ela é padronizada e content_cards ganha a mesma coluna.

alter table public.tasks add column if not exists prioridade text;
alter table public.content_cards add column if not exists prioridade text;

do $$
declare
  restricao record;
begin
  for restricao in
    select conrelid::regclass as tabela, conname
    from pg_constraint
    where conrelid in ('public.tasks'::regclass, 'public.content_cards'::regclass)
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%prioridade%'
  loop
    execute format('alter table %s drop constraint %I', restricao.tabela, restricao.conname);
  end loop;
end $$;

update public.tasks
set prioridade = case
  when lower(trim(prioridade)) in ('baixa', 'low') then 'baixa'
  when lower(trim(prioridade)) in ('alta', 'high') then 'alta'
  when lower(trim(prioridade)) in ('urgente', 'urgent', 'critica', 'crítica') then 'urgente'
  else 'media'
end
where prioridade is null or prioridade not in ('baixa', 'media', 'alta', 'urgente');

update public.content_cards set prioridade = 'media' where prioridade is null;

alter table public.tasks alter column prioridade set default 'media';
alter table public.tasks alter column prioridade set not null;
alter table public.tasks
  add constraint tasks_prioridade_check
  check (prioridade in ('baixa', 'media', 'alta', 'urgente'));

alter table public.content_cards alter column prioridade set default 'media';
alter table public.content_cards alter column prioridade set not null;
alter table public.content_cards
  add constraint content_cards_prioridade_check
  check (prioridade in ('baixa', 'media', 'alta', 'urgente'));

-- ---------------------------------------------------------------------------
-- 3. Colunas dos quadros Kanban
-- ---------------------------------------------------------------------------
-- A equipe pode renomear, criar e reordenar colunas. `chave` é o valor gravado no card
-- (tasks.status ou content_cards.etapa); renomear uma coluna não toca em nenhum card.

create table if not exists public.board_columns (
  id uuid primary key default gen_random_uuid(),
  quadro text not null check (quadro in ('demandas', 'conteudo')),
  chave text not null,
  titulo text not null,
  posicao double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (quadro, chave)
);

-- Uma coluna criada pela equipe é um status novo, então a lista fechada de status sai.
-- As chaves fixas ('concluido', 'publicado', 'arquivado'...) continuam com o mesmo significado.
do $$
declare
  restricao record;
begin
  for restricao in
    select conrelid::regclass as tabela, conname
    from pg_constraint
    where contype = 'c'
      and (
        (conrelid = 'public.tasks'::regclass and pg_get_constraintdef(oid) ilike '%status%')
        or (conrelid = 'public.content_cards'::regclass and pg_get_constraintdef(oid) ilike '%etapa%')
      )
  loop
    execute format('alter table %s drop constraint %I', restricao.tabela, restricao.conname);
  end loop;
end $$;

alter table public.tasks add constraint tasks_status_check check (status <> '');
alter table public.content_cards add constraint content_cards_etapa_check check (etapa <> '');

-- ---------------------------------------------------------------------------
-- 4. Comentários das demandas
-- ---------------------------------------------------------------------------
-- A tabela já existia no banco, criada pelo painel. Fica registrada aqui para um banco novo.

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Permissões e RLS
-- ---------------------------------------------------------------------------
-- calendar_events, event_participants, notifications e task_comments foram criadas pelo
-- painel, fora das migrations; aqui o acesso delas passa a ser o que o app espera.
-- Para as tabelas da migration 0001, ligar o RLS de novo não muda nada: é só garantia.

grant select, insert, update, delete on
  public.board_columns,
  public.task_comments,
  public.calendar_events,
  public.event_participants
to authenticated;
grant select, insert, update on public.notifications to authenticated;

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
alter table public.board_columns enable row level security;
alter table public.task_comments enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_participants enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "colunas do quadro: equipe" on public.board_columns;
create policy "colunas do quadro: equipe" on public.board_columns
  for all to authenticated using (true) with check (true);

drop policy if exists "eventos: equipe" on public.calendar_events;
create policy "eventos: equipe" on public.calendar_events
  for all to authenticated using (true) with check (true);

drop policy if exists "participantes: equipe" on public.event_participants;
create policy "participantes: equipe" on public.event_participants
  for all to authenticated using (true) with check (true);

-- Comentários: todos leem; cada um escreve em seu próprio nome e só apaga o que escreveu.
drop policy if exists "comentarios: leitura" on public.task_comments;
create policy "comentarios: leitura" on public.task_comments
  for select to authenticated using (true);

drop policy if exists "comentarios: autoria" on public.task_comments;
create policy "comentarios: autoria" on public.task_comments
  for insert to authenticated with check (author_id = (select auth.uid()));

drop policy if exists "comentarios: remocao" on public.task_comments;
create policy "comentarios: remocao" on public.task_comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- Notificações: cada pessoa lê e marca só as próprias; qualquer membro pode avisar outro,
-- porque quem cria uma tarefa avisa o responsável.
drop policy if exists "notificacoes: leitura" on public.notifications;
create policy "notificacoes: leitura" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "notificacoes: marcar" on public.notifications;
create policy "notificacoes: marcar" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "notificacoes: avisar" on public.notifications;
create policy "notificacoes: avisar" on public.notifications
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- 6. Índices
-- ---------------------------------------------------------------------------
-- Colunas usadas em filtros e ordenações. Não há workspace_id: o sistema atende uma agência só.

create index if not exists tasks_data_entrega_idx on public.tasks (data_entrega);
create index if not exists tasks_created_at_idx on public.tasks (created_at);
create index if not exists content_cards_data_entrega_idx on public.content_cards (data_entrega);
create index if not exists campaign_tasks_status_idx on public.campaign_tasks (status);
create index if not exists client_payments_data_vencimento_idx
  on public.client_payments (data_vencimento);
create index if not exists client_payments_mes_referencia_idx
  on public.client_payments (mes_referencia);
create index if not exists activity_log_user_id_idx on public.activity_log (user_id);
create index if not exists notifications_user_idx
  on public.notifications (user_id, lida, created_at desc);
create index if not exists calendar_events_data_inicio_idx on public.calendar_events (data_inicio);
create index if not exists event_participants_profile_id_idx
  on public.event_participants (profile_id);
create index if not exists task_comments_task_id_idx
  on public.task_comments (task_id, created_at);
create index if not exists board_columns_quadro_idx on public.board_columns (quadro, posicao);

commit;
