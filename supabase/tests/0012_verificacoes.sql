-- Verificações da 0012. Rodam depois de aplicar a migration duas vezes, dentro de uma
-- transação que termina em rollback.
do $$
declare
  cliente uuid;
  saindo uuid := gen_random_uuid();
begin
  -- Cliente com contato antigo ganha a lista com esse contato, uma vez só
  if exists (
    select 1 from public.clients
    where contato_nome is not null and jsonb_array_length(contatos) <> 1
  ) then
    raise exception 'contato antigo não virou lista de um contato';
  end if;

  -- Contatos precisam ser uma lista
  insert into public.clients (nome, status, mrr) values ('Cliente 0012', 'ativo', 0) returning id into cliente;
  if (select contatos from public.clients where id = cliente) <> '[]'::jsonb
     or (select responsaveis from public.clients where id = cliente) <> '{}' then
    raise exception 'cliente novo não nasceu sem contatos e sem responsáveis';
  end if;
  begin
    update public.clients set contatos = '{"nome": "x"}'::jsonb where id = cliente;
    raise exception 'contatos fora de lista foram aceitos';
  exception when check_violation then null;
  end;

  -- Quem sai da equipe deixa de ser responsável pelo cliente
  insert into auth.users (id, email, raw_user_meta_data) values (saindo, 'saindo-0012@exemplo.com', '{"nome": "Saindo"}');
  update public.clients set responsaveis = array[saindo], area_atuacao = 'Odontologia' where id = cliente;
  delete from auth.users where id = saindo;
  if (select responsaveis from public.clients where id = cliente) <> '{}' then
    raise exception 'pessoa removida continuou responsável pelo cliente';
  end if;
end $$;
