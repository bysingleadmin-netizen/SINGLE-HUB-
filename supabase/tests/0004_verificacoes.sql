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

-- 3b. Quadro de Tarefas
do $$
begin
  insert into public.tasks (titulo, quadro) values ('Tarefa interna sem tipo', 'tarefas');
  insert into public.board_columns (quadro, chave, titulo) values ('tarefas', 'a_fazer', 'A Fazer');
  insert into public.board_columns (quadro, chave, titulo) values ('anuncios', 'pendente', 'Pendente');
  if (select quadro from public.tasks where titulo = 'Demanda antiga') is distinct from 'demandas' then
    raise exception 'demanda antiga não ficou no quadro demandas';
  end if;
  begin
    insert into public.tasks (titulo, quadro, tipo) values ('x', 'outro', 'conteudo');
    raise exception 'quadro aceitou valor inválido';
  exception when check_violation then null;
  end;
end $$;

-- 3c. Quadro de Anúncios
do $$
declare
  cliente uuid;
  campanha uuid;
begin
  insert into public.clients (nome) values ('Cliente do anúncio') returning id into cliente;
  insert into public.campaigns (nome, client_id) values ('Campanha teste', cliente) returning id into campanha;
  insert into public.campaign_tasks (campaign_id, funcao, titulo, status, posicao)
  values (campanha, 'copy', 'Coluna personalizada', 'personalizada_x', 2);
  begin
    insert into public.campaign_tasks (campaign_id, funcao, titulo, status)
    values (campanha, 'copy', 'Sem status', '');
    raise exception 'status vazio foi aceito';
  exception when check_violation then null;
  end;
end $$;

-- 4. CRM
do $$
declare
  usuario uuid := gen_random_uuid();
  lead uuid;
  cliente uuid;
begin
  insert into auth.users (id, email) values (usuario, 'ceo@single.com');
  insert into public.profiles (id, nome, email, cargo) values (usuario, 'CEO', 'ceo@single.com', 'CEO')
  on conflict (id) do update set cargo = 'CEO';
  update auth.uid_atual set id = usuario;

  insert into public.leads (nome, empresa, telefone, etapa) values ('Ana', 'Scofield', '27999990000', 'fechamento')
  returning id into lead;
  cliente := public.converter_lead(lead, 'Scofield', 2870, 12, '2026-10-01');

  if not exists (select 1 from public.clients where id = cliente and contrato_meses = 12 and mrr = 2870 and status = 'ativo') then
    raise exception 'cliente da conversão errado';
  end if;
  if (select convertido_em from public.leads where id = lead) is null then
    raise exception 'lead não ficou convertido';
  end if;
  if not exists (select 1 from public.lead_historico where lead_id = lead and etapa_para = 'cliente') then
    raise exception 'conversão sem histórico';
  end if;

  -- Converter de novo falha e não cria outro cliente
  begin
    perform public.converter_lead(lead, 'Scofield', 2870, 12, '2026-10-01');
    raise exception 'converteu duas vezes';
  exception when sqlstate 'P0002' then null;
  end;

  -- Quem não é liderança não converte
  update public.profiles set cargo = 'Designer' where id = usuario;
  insert into public.leads (nome) values ('Bia') returning id into lead;
  begin
    perform public.converter_lead(lead, 'Bia', 100, 3, '2026-10-01');
    raise exception 'designer converteu lead';
  exception when insufficient_privilege then null;
  end;
  update auth.uid_atual set id = null;
end $$;
