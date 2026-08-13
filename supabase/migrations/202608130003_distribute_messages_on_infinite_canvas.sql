create or replace function public.place_message_on_canvas()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_number bigint;
  angle_radians double precision;
  radius_value double precision;
begin
  perform pg_advisory_xact_lock(hashtext('public.messages.canvas-placement'));
  select count(*) + 1 into item_number from public.messages;
  angle_radians := item_number * 2.399963229728653;
  radius_value := 90 + 105 * sqrt(item_number);
  new.canvas_x := round((300 + radius_value * cos(angle_radians))::numeric, 2);
  new.canvas_y := round((320 + radius_value * sin(angle_radians))::numeric, 2);
  new.rotation := ((item_number * 7) % 15) - 7;
  return new;
end;
$$;

revoke all on function public.place_message_on_canvas() from public, anon, authenticated;
drop trigger if exists place_message_on_canvas_before_insert on public.messages;
create trigger place_message_on_canvas_before_insert before insert on public.messages
for each row execute function public.place_message_on_canvas();

with positioned as (
  select id, row_number() over (order by created_at, id) as item_number from public.messages
)
update public.messages m
set canvas_x = round((300 + (90 + 105 * sqrt(p.item_number)) * cos(p.item_number * 2.399963229728653))::numeric, 2),
    canvas_y = round((320 + (90 + 105 * sqrt(p.item_number)) * sin(p.item_number * 2.399963229728653))::numeric, 2),
    rotation = ((p.item_number * 7) % 15) - 7
from positioned p where m.id = p.id;
