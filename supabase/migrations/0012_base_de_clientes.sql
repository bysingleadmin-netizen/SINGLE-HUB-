-- Sistema SINGLE: Base de Clientes com área de atuação, responsáveis da SINGLE e vários contatos
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0011. Pode rodar mais de uma
-- vez. Nada é apagado.

begin;

-- 1. Área de atuação do cliente (odontologia, varejo...) e quem da SINGLE cuida dele
alter table public.clients add column if not exists area_atuacao text;
alter table public.clients add column if not exists responsaveis uuid[] not null default '{}';
create index if not exists clients_responsaveis_idx on public.clients using gin (responsaveis);

-- 2. Contatos do cliente: lista de { nome, funcao, email, telefone }. O primeiro continua
-- gravado em contato_nome, contato_email e contato_telefone, que o resto do app e a conversão
-- de lead leem.
alter table public.clients add column if not exists contatos jsonb not null default '[]'::jsonb;
alter table public.clients drop constraint if exists clients_contatos_check;
alter table public.clients add constraint clients_contatos_check check (jsonb_typeof(contatos) = 'array');
update public.clients
set contatos = jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
  'nome', coalesce(contato_nome, ''),
  'email', contato_email,
  'telefone', contato_telefone
)))
where contatos = '[]'::jsonb
  and (contato_nome is not null or contato_email is not null or contato_telefone is not null);

-- 3. Quem sai da equipe deixa de ser responsável também pelos clientes
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
  update public.clients set responsaveis = array_remove(responsaveis, old.id)
  where old.id = any (responsaveis);
  return old;
end;
$$;

commit;
