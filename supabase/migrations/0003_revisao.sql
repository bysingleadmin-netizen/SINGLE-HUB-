-- Sistema SINGLE: revisão (pagamentos recorrentes, quadros personalizáveis, subtarefas,
-- opções configuráveis, arquivo automático dos cards concluídos, RLS e índices)
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
-- Aqui ela é padronizada e content_cards ganha a mesma coluna. A lista não é fechada: a equipe
-- pode criar prioridades novas (seção 4c), que são gravadas com a chave 'personalizada_...'.

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
where prioridade is null
  or (prioridade not in ('baixa', 'media', 'alta', 'urgente') and prioridade not like 'personalizada\_%');

update public.content_cards set prioridade = 'media' where prioridade is null;

alter table public.tasks alter column prioridade set default 'media';
alter table public.tasks alter column prioridade set not null;
alter table public.tasks add constraint tasks_prioridade_check check (prioridade <> '');

alter table public.content_cards alter column prioridade set default 'media';
alter table public.content_cards alter column prioridade set not null;
alter table public.content_cards
  add constraint content_cards_prioridade_check check (prioridade <> '');

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
-- 4b. Status do card e anexos
-- ---------------------------------------------------------------------------
-- `situacao` é como o card está dentro da coluna: travado, em andamento, feito ou um status
-- criado pela equipe (seção 4c). É diferente da coluna do quadro (tasks.status,
-- content_cards.etapa). Sem valor = sem status.

alter table public.tasks add column if not exists situacao text;
alter table public.content_cards add column if not exists situacao text;

-- Links e imagens anexados aos cards. Uma tabela só para os dois quadros; `quadro` diz de
-- qual deles é o card. As imagens ficam no bucket `anexos`, e aqui fica a URL pública.
create table if not exists public.card_attachments (
  id uuid primary key default gen_random_uuid(),
  quadro text not null check (quadro in ('demandas', 'conteudo')),
  card_id uuid not null,
  tipo text not null check (tipo in ('link', 'imagem')),
  url text not null,
  nome text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do nothing;

drop policy if exists "anexos: equipe le" on storage.objects;
create policy "anexos: equipe le" on storage.objects
  for select to authenticated using (bucket_id = 'anexos');

drop policy if exists "anexos: equipe envia" on storage.objects;
create policy "anexos: equipe envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'anexos');

drop policy if exists "anexos: equipe remove" on storage.objects;
create policy "anexos: equipe remove" on storage.objects
  for delete to authenticated using (bucket_id = 'anexos');

-- ---------------------------------------------------------------------------
-- 4c. Opções configuráveis, subtarefas e ciclo de vida dos cards
-- ---------------------------------------------------------------------------
-- Status do card, prioridade e tipo de conteúdo são listas que a equipe edita. `chave` é o
-- valor gravado no card; renomear uma opção não toca em nenhum card. As chaves de fábrica
-- mantêm o comportamento: 'feito' continua fazendo o card andar de coluna.
create table if not exists public.card_options (
  id uuid primary key default gen_random_uuid(),
  campo text not null check (campo in ('situacao', 'prioridade', 'tipo_conteudo')),
  chave text not null,
  titulo text not null,
  posicao double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (campo, chave)
);

-- Uma opção criada pela equipe é um valor novo, então as listas fechadas saem.
-- (As de prioridade já saíram na seção 2.)
do $$
declare
  restricao record;
begin
  for restricao in
    select conrelid::regclass as tabela, conname
    from pg_constraint
    where contype = 'c'
      and (
        (conrelid in ('public.tasks'::regclass, 'public.content_cards'::regclass)
          and pg_get_constraintdef(oid) ilike '%situacao%')
        or (conrelid = 'public.content_cards'::regclass
          and pg_get_constraintdef(oid) ilike '%tipo_conteudo%')
      )
  loop
    execute format('alter table %s drop constraint %I', restricao.tabela, restricao.conname);
  end loop;
end $$;

alter table public.tasks add constraint tasks_situacao_check check (situacao <> '');
alter table public.content_cards
  add constraint content_cards_situacao_check check (situacao <> '');
alter table public.content_cards
  add constraint content_cards_tipo_conteudo_check check (tipo_conteudo <> '');

-- Subtarefas: uma caixa de marcar e um texto. Uma tabela só para os dois quadros, como os anexos.
create table if not exists public.card_subtarefas (
  id uuid primary key default gen_random_uuid(),
  quadro text not null check (quadro in ('demandas', 'conteudo')),
  card_id uuid not null,
  titulo text not null check (titulo <> ''),
  concluida boolean not null default false,
  posicao double precision not null default 0,
  created_at timestamptz not null default now()
);

-- Ciclo de vida: o card concluído fica 7 dias no quadro, vai para Arquivados e é excluído
-- 30 dias depois de arquivado. O app grava as duas datas ao mover o card.
alter table public.tasks add column if not exists concluded_at timestamptz;
alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.content_cards add column if not exists concluded_at timestamptz;
alter table public.content_cards add column if not exists archived_at timestamptz;

-- O que já estava concluído ou arquivado antes desta migration começa a contar de agora:
-- nada é arquivado nem excluído no dia em que ela roda.
update public.tasks set concluded_at = now()
where concluded_at is null and status = 'concluido';
update public.content_cards set concluded_at = now()
where concluded_at is null and etapa = 'publicado';
update public.tasks set archived_at = now()
where archived_at is null and status = 'arquivado';
update public.content_cards set archived_at = now()
where archived_at is null and etapa = 'arquivado';

-- Rotina diária. ATENÇÃO: ela EXCLUI de vez os cards arquivados há mais de 30 dias, com as
-- subtarefas, os anexos e os comentários deles. As imagens já enviadas continuam no bucket
-- `anexos` do Storage; só o registro do anexo é apagado.
create or replace function public.limpar_cards()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Concluído há mais de 7 dias: sai do quadro. O prazo de exclusão conta do fim dos 7 dias.
  update public.tasks
  set status = 'arquivado', archived_at = concluded_at + interval '7 days'
  where status <> 'arquivado' and concluded_at < now() - interval '7 days';

  update public.content_cards
  set etapa = 'arquivado', archived_at = concluded_at + interval '7 days'
  where etapa <> 'arquivado' and concluded_at < now() - interval '7 days';

  -- Arquivado há mais de 30 dias: excluído, junto com o que pertence ao card.
  with excluidos as (
    delete from public.tasks
    where status = 'arquivado' and archived_at < now() - interval '30 days'
    returning id
  ), sem_subtarefas as (
    delete from public.card_subtarefas
    where quadro = 'demandas' and card_id in (select id from excluidos)
  )
  delete from public.card_attachments
  where quadro = 'demandas' and card_id in (select id from excluidos);

  with excluidos as (
    delete from public.content_cards
    where etapa = 'arquivado' and archived_at < now() - interval '30 days'
    returning id
  ), sem_subtarefas as (
    delete from public.card_subtarefas
    where quadro = 'conteudo' and card_id in (select id from excluidos)
  )
  delete from public.card_attachments
  where quadro = 'conteudo' and card_id in (select id from excluidos);
end $$;

-- Só a rotina agendada chama a função; ninguém a chama pela API.
revoke all on function public.limpar_cards() from public, anon, authenticated;

-- Agenda para todo dia às 03:00 (UTC) com pg_cron. Se a extensão não puder ser ligada, o resto
-- da migration vale do mesmo jeito: o app esconde sozinho os cards concluídos há mais de 7 dias,
-- e a exclusão fica sem acontecer até a rotina ser agendada (Database > Extensions > pg_cron).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('limpar-cards', '0 3 * * *', 'select public.limpar_cards()');
exception when others then
  raise notice 'pg_cron indisponível (%): a limpeza automática dos cards não foi agendada.', sqlerrm;
end $$;

-- Tempo real: o Dashboard acompanha os status dos cards sem recarregar. Para isso as tabelas
-- precisam estar na publicação do Realtime do Supabase. Fora do Supabase (sem a publicação),
-- o passo é pulado.
do $$
declare
  tabela text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tabela in array array['tasks', 'content_cards', 'card_options'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabela
      ) then
        execute format('alter publication supabase_realtime add table public.%I', tabela);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Permissões e RLS
-- ---------------------------------------------------------------------------
-- calendar_events, event_participants, notifications e task_comments foram criadas pelo
-- painel, fora das migrations; aqui o acesso delas passa a ser o que o app espera.
-- Para as tabelas da migration 0001, ligar o RLS de novo não muda nada: é só garantia.

grant select, insert, update, delete on
  public.board_columns,
  public.card_attachments,
  public.card_options,
  public.card_subtarefas,
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
alter table public.card_attachments enable row level security;
alter table public.card_options enable row level security;
alter table public.card_subtarefas enable row level security;
alter table public.task_comments enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_participants enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "colunas do quadro: equipe" on public.board_columns;
create policy "colunas do quadro: equipe" on public.board_columns
  for all to authenticated using (true) with check (true);

drop policy if exists "anexos dos cards: equipe" on public.card_attachments;
create policy "anexos dos cards: equipe" on public.card_attachments
  for all to authenticated using (true) with check (true);

drop policy if exists "opcoes dos cards: equipe" on public.card_options;
create policy "opcoes dos cards: equipe" on public.card_options
  for all to authenticated using (true) with check (true);

drop policy if exists "subtarefas dos cards: equipe" on public.card_subtarefas;
create policy "subtarefas dos cards: equipe" on public.card_subtarefas
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
create index if not exists card_attachments_card_idx
  on public.card_attachments (quadro, card_id, created_at);
create index if not exists card_subtarefas_card_idx
  on public.card_subtarefas (quadro, card_id, posicao);
create index if not exists tasks_concluded_at_idx on public.tasks (concluded_at);
create index if not exists content_cards_concluded_at_idx on public.content_cards (concluded_at);

commit;
