-- Sistema SINGLE: perfil do lead, histórico das campanhas, demandas de anúncio sem campanha e
-- fim do quadro de Tarefas internas
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0007. Pode rodar mais de uma
-- vez. Nada é apagado: as tarefas internas passam para o quadro de Demandas.

begin;

-- 1. Perfil do lead (CRM)
alter table public.leads
  add column if not exists instagram text,
  add column if not exists segmento text,
  add column if not exists faturamento_medio text,
  add column if not exists tamanho_equipe text,
  add column if not exists cidade text,
  add column if not exists observacoes text,
  add column if not exists temperatura text not null default 'frio';
alter table public.leads drop constraint if exists leads_temperatura_check;
alter table public.leads add constraint leads_temperatura_check
  check (temperatura in ('frio', 'morno', 'quente'));

-- 2. Campanhas: plataforma, objetivo e o histórico de otimizações
alter table public.campaigns
  add column if not exists plataforma text not null default 'Meta Ads',
  add column if not exists objetivo text;

create table if not exists public.campaign_historico (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  tipo text not null check (tipo in ('orcamento', 'criativo', 'segmentacao', 'pausar', 'nota', 'desativar')),
  descricao text not null check (descricao <> ''),
  valor_anterior text,
  valor_novo text,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists campaign_historico_campaign_idx
  on public.campaign_historico (campaign_id, created_at desc);

-- Como as campanhas: a equipe toda lê e registra
grant select, insert, update, delete on public.campaign_historico to authenticated;
alter table public.campaign_historico enable row level security;
drop policy if exists "historico de campanha: equipe" on public.campaign_historico;
create policy "historico de campanha: equipe" on public.campaign_historico
  for all to authenticated using (true) with check (true);

-- 3. Demanda de anúncio sem campanha: a campanha vira opcional e o cliente pode ficar na própria
-- demanda. Excluir a campanha continua levando as demandas dela.
alter table public.campaign_tasks alter column campaign_id drop not null;
alter table public.campaign_tasks
  add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists campaign_tasks_client_id_idx on public.campaign_tasks (client_id);

-- 4. Fim do quadro de Tarefas internas: os cards vão para Demandas, com anexos e subtarefas.
-- Card numa coluna que só existia em Tarefas cai na primeira coluna de Demandas.
update public.tasks t
set status = 'a_fazer'
where t.quadro = 'tarefas'
  and t.status not in ('a_fazer', 'em_andamento', 'aguardando_aprovacao', 'concluido', 'arquivado')
  and not exists (
    select 1 from public.board_columns c where c.quadro = 'demandas' and c.chave = t.status
  );
update public.card_attachments a set quadro = 'demandas'
where a.quadro = 'tarefas' and exists (select 1 from public.tasks t where t.id = a.card_id);
update public.card_subtarefas s set quadro = 'demandas'
where s.quadro = 'tarefas' and exists (select 1 from public.tasks t where t.id = s.card_id);
update public.tasks set quadro = 'demandas' where quadro = 'tarefas';

-- O Dashboard e as campanhas acompanham o histórico em tempo real
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_historico'
     ) then
    alter publication supabase_realtime add table public.campaign_historico;
  end if;
end $$;

commit;
