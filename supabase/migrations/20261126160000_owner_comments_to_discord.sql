-- =====================================================
-- 소유자가 단 댓글도 디스코드에는 올라가게 (폰 알림은 계속 제외)
--
-- 20261126150000_development_request_comment_push.sql 위에 얹는다.
-- - 댓글 트리거는 작성자와 상관없이 함수를 부른다.
-- - 함수가 작성자가 소유자인지 직접 확인해서, 소유자면 웹 푸시는 건너뛰고 디스코드만 보낸다.
--   (호출 본문에 "소유자" 표시를 받지 않으므로 외부 호출로 조작할 수 없음)
--
-- 되돌리기: 파일 맨 아래 주석 참고.
-- =====================================================

-- 서버(Edge Function, service_role)만 부를 수 있는 소유자 확인
create or replace function public.is_push_owner_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.push_owners where user_id = p_user_id);
$$;

revoke all on function public.is_push_owner_user(uuid) from public, anon, authenticated;
grant execute on function public.is_push_owner_user(uuid) to service_role;

create or replace function private.queue_development_request_comment_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
begin
  begin
    select decrypted_secret into base_url
      from vault.decrypted_secrets where name = 'beadyo_project_url';
  exception when others then
    base_url := null;
  end;
  base_url := coalesce(base_url, 'https://qlmcwobfldgmhwhptkfz.supabase.co');

  begin
    perform net.http_post(
      url := base_url || '/functions/v1/dev-request-push',
      body := jsonb_build_object('comment_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning 'dev-request-push comment queue failed: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function private.queue_development_request_comment_push() from public, anon, authenticated;

-- =====================================================
-- 되돌리기: 소유자 댓글을 다시 아예 안 보내려면
--   20261126150000_development_request_comment_push.sql 의
--   queue_development_request_comment_push 정의(소유자면 return new)를 다시 실행하고
--   drop function if exists public.is_push_owner_user(uuid);
-- =====================================================
