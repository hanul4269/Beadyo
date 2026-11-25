-- =====================================================
-- 개발요청 댓글 → 관리자 웹 푸시 + 디스코드 알림
--
-- 20261126140000_development_request_push.sql 위에 얹는다.
-- 흐름: development_request_comments INSERT
--       → 트리거가 pg_net으로 dev-request-push 함수 호출 (comment_id만 전달)
--       → 함수가 등록된 기기와 디스코드로 발송
-- 댓글 1건당 1번만·생성 10분 이내만 발송 (development_request_comment_push_log 기본키).
-- 소유자가 직접 단 댓글은 알리지 않는다.
--
-- 되돌리기: 파일 맨 아래 주석 참고.
-- =====================================================

create table if not exists public.development_request_comment_push_log (
  comment_id bigint primary key references public.development_request_comments(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.development_request_comment_push_log enable row level security;
revoke all on table public.development_request_comment_push_log from public, anon, authenticated;

create or replace function private.queue_development_request_comment_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
begin
  if private.is_push_owner() then
    return new;
  end if;

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

drop trigger if exists development_request_comments_push on public.development_request_comments;
create trigger development_request_comments_push
  after insert on public.development_request_comments
  for each row execute function private.queue_development_request_comment_push();

-- =====================================================
-- 되돌리기 (필요할 때 SQL Editor에서 실행)
--
-- 댓글 알림만 즉시 정지:
--   drop trigger if exists development_request_comments_push on public.development_request_comments;
--
-- 완전 제거:
--   drop trigger if exists development_request_comments_push on public.development_request_comments;
--   drop function if exists private.queue_development_request_comment_push();
--   drop table if exists public.development_request_comment_push_log;
-- =====================================================
