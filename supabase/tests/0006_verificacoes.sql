-- Verificações da 0006. Rodam depois de aplicar a migration duas vezes.
do $$
declare
  cliente uuid;
  outro uuid;
begin
  insert into public.clients (nome, asaas_customer_id) values ('Cliente Asaas', 'cus_1') returning id into cliente;
  insert into public.clients (nome) values ('Sem Asaas 1'), ('Sem Asaas 2');

  -- O mesmo cliente do Asaas não pode estar em dois clientes daqui
  begin
    insert into public.clients (nome, asaas_customer_id) values ('Duplicado', 'cus_1');
    raise exception 'asaas_customer_id repetido foi aceito';
  exception when unique_violation then null;
  end;

  insert into public.receitas_asaas (asaas_id, cliente_id, asaas_customer_id, valor, status, vinculado)
  values ('pay_1', cliente, 'cus_1', 2870, 'RECEIVED', true);

  -- O webhook repete eventos: a cobrança é única pelo asaas_id
  begin
    insert into public.receitas_asaas (asaas_id) values ('pay_1');
    raise exception 'cobrança repetida foi aceita';
  exception when unique_violation then null;
  end;

  -- Cliente excluído deixa a cobrança sem vínculo, sem apagá-la
  insert into public.clients (nome) values ('Some') returning id into outro;
  insert into public.receitas_asaas (asaas_id, cliente_id, vinculado) values ('pay_2', outro, true);
  delete from public.clients where id = outro;
  if (select cliente_id from public.receitas_asaas where asaas_id = 'pay_2') is not null then
    raise exception 'cobrança continuou presa ao cliente excluído';
  end if;
end $$;
