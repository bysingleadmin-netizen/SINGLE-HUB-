-- Sistema SINGLE: cargos novos, CRM para o comercial, Áreas configuráveis e convites protegidos
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0009. Pode rodar mais de uma
-- vez. Nada é apagado.

begin;

-- 1. Cargos. Os oito cargos antigos viram seis: a liderança (CEO, Founder e Co-Founder) vira
-- Liderança; Social Media, Designer, Editor de Vídeo e Copywriter viram Colaborador.
-- O que cada cargo vê no menu fica no app (src/lib/permissoes.ts); aqui ficam as permissões
-- que o banco garante: dinheiro só para a Liderança, leads para Liderança, SDR e Closer.
alter table public.profiles drop constraint if exists profiles_cargo_check;
update public.profiles set cargo = 'Liderança' where cargo in ('CEO', 'Founder', 'Co-Founder');
update public.profiles set cargo = 'Colaborador'
where cargo in ('Social Media', 'Designer', 'Editor de Vídeo', 'Copywriter');
alter table public.profiles add constraint profiles_cargo_check check (
  cargo in ('Liderança', 'Gestor de Tráfego', 'SDR', 'Closer', 'Estrategista & Analista', 'Colaborador')
);
alter table public.profiles alter column cargo set default 'Colaborador';

create or replace function private.is_lideranca()
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
      and cargo = 'Liderança'
  );
$$;

-- Quem trabalha o funil de vendas
create or replace function private.pode_crm()
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
      and cargo in ('Liderança', 'SDR', 'Closer')
  );
$$;

revoke all on function private.pode_crm() from public;
grant execute on function private.pode_crm() to authenticated;

drop policy if exists "leads: lideranca" on public.leads;
drop policy if exists "leads: comercial" on public.leads;
create policy "leads: comercial" on public.leads for all to authenticated
  using ((select private.pode_crm())) with check ((select private.pode_crm()));

drop policy if exists "historico de leads: lideranca" on public.lead_historico;
drop policy if exists "historico de leads: comercial" on public.lead_historico;
create policy "historico de leads: comercial" on public.lead_historico for all to authenticated
  using ((select private.pode_crm())) with check ((select private.pode_crm()));

-- Fechar contrato é trabalho do Closer: a conversão do lead em cliente segue o CRM
create or replace function public.converter_lead(
  p_lead_id uuid, p_nome text, p_mrr numeric, p_meses integer, p_inicio date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_cliente uuid;
begin
  if not private.pode_crm() then
    raise exception 'Só a liderança e o comercial convertem leads.' using errcode = '42501';
  end if;
  if p_nome is null or trim(p_nome) = '' or p_mrr is null or p_mrr < 0
     or p_meses not in (3, 6, 12, 15) or p_inicio is null then
    raise exception 'Dados da conversão incompletos.' using errcode = '22023';
  end if;

  select * into v_lead from public.leads
  where id = p_lead_id and convertido_em is null
  for update;
  if not found then
    raise exception 'Lead não encontrado ou já convertido.' using errcode = 'P0002';
  end if;

  insert into public.clients (nome, status, mrr, data_inicio_contrato, contrato_meses, contato_nome, contato_telefone)
  values (trim(p_nome), 'ativo', p_mrr, p_inicio, p_meses, v_lead.nome, v_lead.telefone)
  returning id into v_cliente;

  update public.leads set convertido_em = now(), client_id = v_cliente where id = p_lead_id;
  insert into public.lead_historico (lead_id, etapa_de, etapa_para, user_id)
  values (p_lead_id, v_lead.etapa, 'cliente', auth.uid());
  return v_cliente;
end $$;

-- 2. Convites. A tabela invite_codes e as duas funções foram criadas pelo painel. Ninguém
-- precisa ler nem gravar a tabela direto: a Edge Function convidar-colaborador usa a chave de
-- serviço, e a tela de cadastro usa as funções abaixo. Antes, qualquer visitante sem login lia
-- todos os códigos.
do $$
begin
  if to_regclass('public.invite_codes') is null then
    return;
  end if;
  update public.invite_codes set cargo = 'Liderança' where cargo in ('CEO', 'Founder', 'Co-Founder');
  update public.invite_codes set cargo = 'Colaborador'
  where cargo in ('Social Media', 'Designer', 'Editor de Vídeo', 'Copywriter');
  alter table public.invite_codes enable row level security;
  drop policy if exists "invite_codes: anon valida" on public.invite_codes;
  drop policy if exists "invite_codes: marcar usado" on public.invite_codes;
  drop policy if exists "invite_codes: service insere" on public.invite_codes;

  -- O código só vale para a conta do próprio e-mail convidado: antes, quem tivesse um código
  -- podia trocar o cargo de qualquer usuário passando o id dele
  execute $f$
    create or replace function public.usar_codigo_convite(p_email text, p_codigo text, p_user_id uuid)
    returns text
    language plpgsql
    security definer
    set search_path = ''
    as $body$
    declare
      v_convite public.invite_codes%rowtype;
    begin
      select * into v_convite
      from public.invite_codes
      where email = lower(p_email)
        and code = upper(p_codigo)
        and used = false
        and expires_at > now()
      limit 1;

      if not found then
        return 'codigo_invalido';
      end if;
      if not exists (select 1 from auth.users where id = p_user_id and lower(email) = lower(p_email)) then
        return 'codigo_invalido';
      end if;

      update public.invite_codes set used = true, used_at = now() where id = v_convite.id;
      update public.profiles set cargo = v_convite.cargo where id = p_user_id;
      return 'ok';
    end;
    $body$
  $f$;
end $$;

-- 3. Remover colaborador. A Edge Function remover-colaborador apaga a conta no Auth; o perfil vai
-- junto (on delete cascade) e os cards ficam sem responsável (on delete set null). Faltavam
-- duas coisas: o convite que a pessoa criou travava a exclusão, e o id dela continuava nas
-- listas de responsáveis.
do $$
begin
  if to_regclass('public.invite_codes') is not null then
    alter table public.invite_codes drop constraint if exists invite_codes_created_by_fkey;
    alter table public.invite_codes add constraint invite_codes_created_by_fkey
      foreign key (created_by) references auth.users (id) on delete set null;
  end if;
end $$;

create or replace function private.tirar_dos_responsaveis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks set responsaveis = array_remove(responsaveis, old.id)
  where old.id = any (responsaveis);
  update public.content_cards set responsaveis = array_remove(responsaveis, old.id)
  where old.id = any (responsaveis);
  return old;
end;
$$;

drop trigger if exists tirar_dos_responsaveis on public.profiles;
create trigger tirar_dos_responsaveis
  after delete on public.profiles
  for each row execute function private.tirar_dos_responsaveis();

-- 4. Áreas das demandas. A área deixa de ser uma lista fixa: a equipe cria, renomeia, colore e
-- remove áreas na engrenagem ao lado do campo, como já faz com status e prioridade.
alter table public.tasks drop constraint if exists tasks_tipo_check;
alter table public.tasks add constraint tasks_tipo_check check (tipo is null or tipo <> '');

alter table public.card_options drop constraint if exists card_options_campo_check;
alter table public.card_options add constraint card_options_campo_check
  check (campo in ('situacao', 'prioridade', 'tipo_conteudo', 'area'));

-- Remover uma opção só a esconde da lista: os cards que já a usam continuam mostrando o nome dela
alter table public.card_options add column if not exists oculta boolean not null default false;

commit;
