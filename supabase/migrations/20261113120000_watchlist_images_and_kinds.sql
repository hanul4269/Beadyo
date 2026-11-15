-- 같이 본 작품: 대표 포스터 칸 추가, 종류에 드라마·예능 추가
alter table public.watchlist_entries add column image_url text;
alter table public.watchlist_entries add constraint watchlist_image_url_check
    check (image_url is null or image_url ~* '^https?://[^[:space:]]+$');
alter table public.watchlist_entries drop constraint watchlist_kind_check;
alter table public.watchlist_entries add constraint watchlist_kind_check
    check (kind in ('영화', '애니메이션', '드라마', '예능', '기타'));
