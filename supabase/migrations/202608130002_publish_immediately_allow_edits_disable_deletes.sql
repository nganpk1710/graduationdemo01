-- Production migration applied to Supabase.
-- Messages publish immediately, may be edited publicly, and cannot be deleted.

update public.messages set moderation_status = 'approved' where moderation_status <> 'approved';
alter table public.messages alter column moderation_status set default 'approved';

drop policy if exists "Public can read approved messages" on public.messages;
drop policy if exists "Admins can read all messages" on public.messages;
drop policy if exists "Guests can submit pending messages" on public.messages;
drop policy if exists "Admins can update messages" on public.messages;
drop policy if exists "Admins can delete messages" on public.messages;

create policy "Anyone can read published messages" on public.messages for select
to anon, authenticated using (moderation_status = 'approved');
create policy "Anyone can publish messages" on public.messages for insert
to anon, authenticated with check (moderation_status = 'approved');
create policy "Anyone can edit published messages" on public.messages for update
to anon, authenticated using (moderation_status = 'approved') with check (moderation_status = 'approved');

revoke all privileges on public.messages from anon, authenticated;
grant select, insert on public.messages to anon, authenticated;
grant update (sender_name, content, card_type, card_style, canvas_x, canvas_y, rotation)
on public.messages to anon, authenticated;

drop policy if exists "Admins can update message images" on storage.objects;
drop policy if exists "Admins can delete message images" on storage.objects;
drop policy if exists "Guests can upload linked message images" on storage.objects;
drop policy if exists "Guests can upload message images" on storage.objects;
create policy "Anyone can upload linked published message images" on storage.objects for insert
to anon, authenticated with check (
  bucket_id = 'message-images'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (select 1 from public.messages m where m.image_path = name and m.moderation_status = 'approved')
);
revoke delete, update on storage.objects from anon, authenticated;
