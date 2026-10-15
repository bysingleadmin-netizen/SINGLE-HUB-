-- Verificações da 0008. Rodam depois de aplicar a migration duas vezes.
do $$
declare
  cliente uuid;
  campanha uuid;
  interna uuid;
begin
  -- Lead novo nasce frio; temperatura fora da lista é recusada
  insert into public.leads (nome) values ('Lead novo');
  if (select temperatura from public.leads where nome = 'Lead novo') <> 'frio' then
    raise exception 'lead não nasceu frio';
  end if;
  begin
    update public.leads set temperatura = 'fervendo' where nome = 'Lead novo';
    raise exception 'temperatura inválida foi aceita';
  exception when check_violation then null;
  end;
  update public.leads set segmento = 'Odontologia', cidade = 'Vitória', temperatura = 'quente' where nome = 'Lead novo';

  -- Campanha ganha plataforma padrão e histórico
  insert into public.clients (nome) values ('Cliente 0008') returning id into cliente;
  insert into public.campaigns (nome, client_id) values ('Campanha 0008', cliente) returning id into campanha;
  if (select plataforma from public.campaigns where id = campanha) <> 'Meta Ads' then
    raise exception 'plataforma padrão ausente';
  end if;
  insert into public.campaign_historico (campaign_id, tipo, descricao, valor_anterior, valor_novo)
  values (campanha, 'orcamento', 'Subiu o orçamento', '50', '80');
  begin
    insert into public.campaign_historico (campaign_id, tipo, descricao) values (campanha, 'outro', 'x');
    raise exception 'tipo de histórico inválido foi aceito';
  exception when check_violation then null;
  end;

  -- Demanda de anúncio sem campanha, só com o cliente
  insert into public.campaign_tasks (titulo, funcao, status, client_id)
  values ('Subir criativo', 'trafego', 'a_fazer', cliente);

  -- Excluir a campanha leva o histórico
  delete from public.campaigns where id = campanha;
  if exists (select 1 from public.campaign_historico where campaign_id = campanha) then
    raise exception 'histórico ficou sem campanha';
  end if;

  -- Nenhuma tarefa interna sobrou
  if exists (select 1 from public.tasks where quadro = 'tarefas') then
    raise exception 'tarefa interna não foi para Demandas';
  end if;
  if (select status from public.tasks where titulo = 'Interna em coluna própria') <> 'a_fazer' then
    raise exception 'tarefa de coluna só de Tarefas não caiu na primeira coluna';
  end if;
  if exists (select 1 from public.card_subtarefas where quadro = 'tarefas') then
    raise exception 'subtarefa ficou no quadro de Tarefas';
  end if;
end $$;
