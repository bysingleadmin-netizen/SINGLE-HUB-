-- Verificações da migration 0004, rodadas pelo validador local depois de aplicá-la duas vezes.
-- Cada bloco lança exceção se o banco não estiver como a migration promete.

-- 1. Contrato
do $$
begin
  insert into public.clients (nome, contrato_meses) values ('Contrato ok', 12);
  begin
    insert into public.clients (nome, contrato_meses) values ('Contrato inválido', 7);
    raise exception 'contrato_meses aceitou 7';
  exception when check_violation then null;
  end;
end $$;

-- 2. Pagamentos parciais
do $$
declare
  cliente uuid;
  pago numeric;
begin
  insert into public.clients (nome) values ('Pagador') returning id into cliente;
  insert into public.client_payments (client_id, mes_referencia, valor, data_vencimento, status, data_pagamento, valor_pago)
  values (cliente, '2026-09-01', 1000, '2026-09-10', 'pago', '2026-09-09', 1000);
  select valor_pago into pago from public.client_payments where client_id = cliente;
  if pago <> 1000 then raise exception 'valor_pago errado: %', pago; end if;
  begin
    update public.client_payments set valor_pago = -1 where client_id = cliente;
    raise exception 'valor_pago aceitou negativo';
  exception when check_violation then null;
  end;
end $$;

-- Cobrança paga antes da 0004 ganha valor_pago e pago_em
do $$
begin
  if not exists (select 1 from public.client_payments
                 where client_id = '00000000-0000-0000-0000-0000000000aa'
                   and valor_pago = 700 and pago_em = '2026-08-08') then
    raise exception 'cobrança paga antiga não ganhou valor_pago';
  end if;
end $$;

-- 3a. Cor das opções
do $$
begin
  insert into public.card_options (campo, chave, titulo, cor) values ('situacao', 'cor_ok', 'Cor ok', '#4a9eff');
  begin
    insert into public.card_options (campo, chave, titulo, cor) values ('situacao', 'cor_ruim', 'Cor ruim', 'azul');
    raise exception 'cor aceitou texto livre';
  exception when check_violation then null;
  end;
end $$;
