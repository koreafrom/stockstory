-- ============================================================
--  주식 정보 앱 v1 - Supabase 스키마
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
--  (사용자 계정은 Supabase Auth 의 auth.users 를 그대로 사용)
-- ============================================================

-- 관심종목 (사용자별) -----------------------------------------
create table if not exists watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  market      text not null check (market in ('KR','US')),
  symbol      text not null,                -- KR: 종목코드(6자리) / US: 티커
  corp_code   text,                         -- KR DART 8자리 (KR 전용)
  name        text,
  created_at  timestamptz default now(),
  unique (user_id, market, symbol)
);
create index if not exists idx_watchlist_user on watchlist(user_id);

-- 공시 (전역 마켓 데이터, 중복 방지 ext_id) ---------------------
create table if not exists disclosures (
  id          uuid primary key default gen_random_uuid(),
  market      text not null,
  symbol      text,
  ext_id      text not null,                -- DART rcept_no / EDGAR accession
  title       text not null,
  filer       text,
  url         text,
  filed_at    date,
  summary     text,                         -- AI 요약(설명만, 의견 X)
  created_at  timestamptz default now(),
  unique (market, ext_id)
);
create index if not exists idx_disclosures_symbol on disclosures(symbol);
create index if not exists idx_disclosures_filed  on disclosures(filed_at desc);

-- 공모주/상장 일정 (전역) -------------------------------------
create table if not exists ipo_events (
  id           uuid primary key default gen_random_uuid(),
  market       text not null,
  symbol       text,
  name         text not null,
  kind         text not null,               -- subscribe_start/subscribe_end/refund/listing/ipo
  event_date   date not null,
  exchange     text,
  price_range  text,
  created_at   timestamptz default now(),
  unique (market, name, kind, event_date)
);
create index if not exists idx_ipo_date on ipo_events(event_date);

-- 기기 토큰 (FCM, 사용자별 여러 기기) --------------------------
create table if not exists devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  fcm_token   text not null unique,
  platform    text,
  updated_at  timestamptz default now()
);

-- 발송 로그 (중복 푸시 방지) ----------------------------------
create table if not exists sent_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  ref_type    text not null,                -- 'disclosure' | 'ipo'
  ref_id      text not null,
  sent_at     timestamptz default now(),
  unique (user_id, ref_type, ref_id)
);

-- ============================================================
--  RLS (행 수준 보안)
--  - watchlist/devices : 본인 것만
--  - disclosures/ipo_events : 로그인 사용자는 읽기 가능(공개 시장정보)
--    쓰기는 수집기(service_role 키)가 RLS 우회로 처리
-- ============================================================
alter table watchlist          enable row level security;
alter table devices            enable row level security;
alter table disclosures        enable row level security;
alter table ipo_events         enable row level security;
alter table sent_notifications enable row level security;

create policy "own watchlist" on watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own devices" on devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "read disclosures" on disclosures
  for select to authenticated using (true);

create policy "read ipo" on ipo_events
  for select to authenticated using (true);
