-- =====================================================
-- 개발 요청 게시판: 작성자 수정/삭제 권한 추가
-- add_development_requests.sql을 이미 실행한 경우 이 파일만 실행하세요.
-- =====================================================

create or replace function public.guard_development_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_beadyo_editor() and (
    new.id is distinct from old.id
    or new.requester_id is distinct from old.requester_id
    or new.requester_name is distinct from old.requester_name
    or new.requester_avatar is distinct from old.requester_avatar
    or new.status is distinct from old.status
    or new.created_at is distinct from old.created_at
  ) then
    raise exception '요청자는 요청 내용만 수정할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists development_requests_guard_update on public.development_requests;
create trigger development_requests_guard_update
before update on public.development_requests
for each row execute function public.guard_development_request_update();

drop policy if exists "본인 요청 수정" on public.development_requests;
create policy "본인 요청 수정" on public.development_requests
  for update to authenticated
  using (requester_id = auth.uid())
  with check (requester_id = auth.uid());

drop policy if exists "본인 요청 삭제" on public.development_requests;
create policy "본인 요청 삭제" on public.development_requests
  for delete to authenticated
  using (requester_id = auth.uid());

drop policy if exists "편집자 요청 삭제" on public.development_requests;
create policy "편집자 요청 삭제" on public.development_requests
  for delete to authenticated
  using (public.is_beadyo_editor());

grant select, insert, update, delete on table public.development_requests to authenticated;
