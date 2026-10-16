-- Verificações da 0010. Rodam depois de aplicar a migration duas vezes, dentro de uma
-- transação que termina em rollback.
do $$
declare
  lider uuid;
  sdr uuid;
begin
  -- Nenhum cargo antigo sobrou, e cargo fora da lista é recusado
  if exists (select 1 from public.profiles where cargo not in
    ('Liderança', 'Gestor de Tráfego', 'SDR', 'Closer', 'Estrategista & Analista', 'Colaborador')) then
    raise exception 'sobrou cargo antigo';
  end if;
  begin
    update public.profiles set cargo = 'CEO' where id = (select id from public.profiles limit 1);
    raise exception 'cargo antigo foi aceito';
  exception when check_violation then null;
  end;

  -- Liderança é Liderança; SDR mexe no CRM mas não é liderança
  select id into lider from public.profiles where cargo = 'Liderança' limit 1;
  select id into sdr from public.profiles where cargo <> 'Liderança' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', lider, 'role', 'authenticated')::text, true);
  if not private.is_lideranca() or not private.pode_crm() then
    raise exception 'liderança perdeu acesso';
  end if;
  update public.profiles set cargo = 'SDR' where id = sdr;
  perform set_config('request.jwt.claims', json_build_object('sub', sdr, 'role', 'authenticated')::text, true);
  if private.is_lideranca() or not private.pode_crm() then
    raise exception 'SDR com acesso errado';
  end if;
  perform set_config('request.jwt.claims', null, true);
  update public.profiles set cargo = 'Colaborador' where id = sdr;
  perform set_config('request.jwt.claims', json_build_object('sub', sdr, 'role', 'authenticated')::text, true);
  if private.pode_crm() then
    raise exception 'colaborador entrou no CRM';
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- Área nova é aceita; área vazia, não
  update public.tasks set tipo = 'personalizada_teste' where id = (select id from public.tasks limit 1);
  begin
    update public.tasks set tipo = '' where id = (select id from public.tasks limit 1);
    raise exception 'área vazia foi aceita';
  exception when check_violation then null;
  end;
  insert into public.card_options (campo, chave, titulo, posicao) values ('area', 'personalizada_teste', 'Teste', 99);
  if (select oculta from public.card_options where campo = 'area' and chave = 'personalizada_teste') then
    raise exception 'opção nasceu oculta';
  end if;
end $$;

-- Apagar a conta leva o perfil e tira a pessoa das listas de responsáveis, mesmo que ela tenha
-- criado um convite
do $$
declare
  saindo uuid := gen_random_uuid();
  tarefa uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data) values (saindo, 'saindo-0010@exemplo.com', '{"nome": "Saindo"}');
  if (select cargo from public.profiles where id = saindo) <> 'Colaborador' then
    raise exception 'perfil novo não nasceu Colaborador';
  end if;
  insert into public.invite_codes (email, cargo, code, expires_at, created_by)
  values ('outro-0010@exemplo.com', 'Colaborador', 'XYZ234', now() + interval '1 hour', saindo);
  select id into tarefa from public.tasks limit 1;
  update public.tasks set responsavel_id = saindo, responsaveis = array[saindo] where id = tarefa;
  delete from auth.users where id = saindo;
  if exists (select 1 from public.profiles where id = saindo) then
    raise exception 'perfil ficou depois da conta apagada';
  end if;
  if (select responsaveis from public.tasks where id = tarefa) <> '{}'
     or (select responsavel_id from public.tasks where id = tarefa) is not null then
    raise exception 'pessoa removida continuou responsável';
  end if;
end $$;

-- Sem login, os códigos de convite não aparecem
insert into public.invite_codes (email, cargo, code, expires_at)
values ('teste-0010@exemplo.com', 'Colaborador', 'ABC234', now() + interval '1 hour');
set local role anon;
do $$
begin
  if (select count(*) from public.invite_codes) > 0 then
    raise exception 'visitante lê os códigos de convite';
  end if;
end $$;
reset role;
