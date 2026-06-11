alter table up_events
  add column if not exists show_on_startup boolean not null default false;

create index if not exists idx_up_events_show_on_startup
  on up_events (show_on_startup, sort_order)
  where is_active = true;
