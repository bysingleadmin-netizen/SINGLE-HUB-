-- Verificações da 0013. Rodam depois de aplicar a migration duas vezes, dentro de uma
-- transação que termina em rollback.
do $$
declare
  card uuid;
  pessoa uuid;
  pedido public.aprovacoes;
  vencido public.aprovacoes;
begin
  select id into card from public.content_cards limit 1;
  select id into pessoa from public.profiles limit 1;
  update public.content_cards set responsaveis = array[pessoa] where id = card;

  insert into public.aprovacoes (card_id, titulo, conteudo, created_by)
  values (card, 'Post teste 0013', '[{"tipo": "copy", "valor": "Texto", "label": "Legenda"}]', pessoa)
  returning * into pedido;
  insert into public.aprovacoes (card_id, titulo, expira_em)
  values (card, 'Vencido', now() - interval '1 day')
  returning * into vencido;

  -- Conteúdo precisa ser uma lista; status fora da lista é recusado
  begin
    insert into public.aprovacoes (card_id, conteudo) values (card, '{}');
    raise exception 'conteúdo fora de lista foi aceito';
  exception when check_violation then null;
  end;

  -- Leitura pelo token: acha o válido, não acha o expirado nem um token qualquer
  if public.aprovacao_por_token(pedido.token) ->> 'titulo' <> 'Post teste 0013' then
    raise exception 'pedido válido não foi encontrado';
  end if;
  if public.aprovacao_por_token(vencido.token) is not null
     or public.aprovacao_por_token(gen_random_uuid()) is not null then
    raise exception 'pedido expirado ou inexistente foi devolvido';
  end if;
  if public.aprovacao_por_token(pedido.token) ? 'card_id'
     or public.aprovacao_por_token(pedido.token) ? 'client_id' then
    raise exception 'portal recebe ids de outras tabelas';
  end if;

  -- Respostas
  if public.responder_aprovacao(pedido.token, 'revisao', '  ') <> 'comentario_obrigatorio' then
    raise exception 'revisão sem comentário foi aceita';
  end if;
  if public.responder_aprovacao(vencido.token, 'aprovado', null) <> 'invalido' then
    raise exception 'pedido expirado foi respondido';
  end if;
  if public.responder_aprovacao(pedido.token, 'revisao', 'Trocar a foto') <> 'ok' then
    raise exception 'revisão não foi gravada';
  end if;
  if public.responder_aprovacao(pedido.token, 'aprovado', null) <> 'ja_respondido' then
    raise exception 'pedido respondido duas vezes';
  end if;
  select * into pedido from public.aprovacoes where id = pedido.id;
  if pedido.status <> 'revisao' or pedido.comentario <> 'Trocar a foto' or pedido.respondido_em is null then
    raise exception 'resposta gravada errada';
  end if;
  begin
    perform public.responder_aprovacao(pedido.token, 'qualquer', null);
    raise exception 'resposta inválida foi aceita';
  exception when invalid_parameter_value then null;
  end;

  -- Quem cuida do card recebe o aviso, uma vez só
  if (select count(*) from public.notifications
      where user_id = pessoa and tipo = 'aprovacao' and link = '/app/conteudo?abrir=' || card) <> 1 then
    raise exception 'aviso da resposta não chegou (ou chegou repetido)';
  end if;

  -- Excluir o card leva os pedidos dele
  delete from public.content_cards where id = card;
  if exists (select 1 from public.aprovacoes where card_id = card) then
    raise exception 'pedido ficou sem card';
  end if;
end $$;

-- Visitante sem login: não lê a tabela, mas chama as duas funções
insert into public.aprovacoes (card_id, titulo)
values ((select id from public.content_cards limit 1), 'Visitante 0013');
set local role anon;
do $$
begin
  if (select count(*) from public.aprovacoes) > 0 then
    raise exception 'visitante lê a tabela de aprovações';
  end if;
end $$;
reset role;
do $$
begin
  if not has_function_privilege('anon', 'public.aprovacao_por_token(uuid)', 'execute')
     or not has_function_privilege('anon', 'public.responder_aprovacao(uuid, text, text)', 'execute') then
    raise exception 'visitante não chama as funções do portal';
  end if;
  if not exists (
    select 1 from cron.job where jobname = 'limpar-aprovacoes' and command like '%status = ''pendente''%'
  ) then
    raise exception 'limpeza não foi agendada (ou apagaria os respondidos)';
  end if;
end $$;
