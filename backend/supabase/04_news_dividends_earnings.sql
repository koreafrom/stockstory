-- 04: 뉴스 / 배당 / 실적 표 추가
-- (해외=Finnhub 무료로 수집. 배당·실적은 무료 한도에서 막히면 빈 상태로 둔다.)

create table if not exists news (
  id           uuid primary key default gen_random_uuid(),
  market       text not null,
  symbol       text,
  ext_id       text not null,         -- 기사 url 기반 식별자(중복 방지)
  headline     text not null,
  source       text,
  url          text,
  published_at timestamptz,
  created_at   timestamptz default now(),
  unique (ext_id)
);
create index if not exists idx_news_symbol on news(symbol);
create index if not exists idx_news_pub on news(published_at desc);

create table if not exists dividends (
  id          uuid primary key default gen_random_uuid(),
  market      text not null,
  symbol      text not null,
  name        text,
  ex_date     date,                   -- 배당락일
  pay_date    date,                   -- 지급일
  amount      numeric,                -- 주당 배당금
  yield_pct   numeric,                -- 연 환산 수익률(%)
  freq        text,                   -- 분기/월/연 등(있으면)
  created_at  timestamptz default now(),
  unique (market, symbol, ex_date)
);
create index if not exists idx_div_ex on dividends(ex_date);
create index if not exists idx_div_symbol on dividends(symbol);

create table if not exists earnings (
  id           uuid primary key default gen_random_uuid(),
  market       text not null,
  symbol       text not null,
  name         text,
  report_date  date not null,         -- 실적 발표 예정일
  period       text,                  -- 분기 표기(예: 2026Q1)
  eps_estimate numeric,
  hour         text,                  -- bmo(개장전)/amc(마감후) 등
  created_at   timestamptz default now(),
  unique (market, symbol, report_date)
);
create index if not exists idx_earn_date on earnings(report_date);
create index if not exists idx_earn_symbol on earnings(symbol);

-- RLS: 로그인 사용자는 읽기만
alter table news      enable row level security;
alter table dividends enable row level security;
alter table earnings  enable row level security;

drop policy if exists "read news" on news;
create policy "read news" on news for select to authenticated using (true);
drop policy if exists "read dividends" on dividends;
create policy "read dividends" on dividends for select to authenticated using (true);
drop policy if exists "read earnings" on earnings;
create policy "read earnings" on earnings for select to authenticated using (true);

-- 권한(새 표에도 부여)
grant select, insert, update, delete on news, dividends, earnings to service_role;
grant select on news, dividends, earnings to authenticated, anon;
