-- ============================================================
--  종목 마스터 (검색/추가용) - 02_stocks.sql
--  schema.sql 을 이미 실행했다면, 이 파일만 추가로 실행하세요.
--  데이터 채우기는 백엔드 seed 스크립트로 (다음 단계).
-- ============================================================

create table if not exists stocks (
  market     text not null,            -- 'KR' | 'US'
  symbol     text not null,            -- KR: 6자리 종목코드 / US: 티커
  name       text not null,
  corp_code  text,                     -- KR DART 8자리 (KR 전용)
  primary key (market, symbol)
);

create index if not exists idx_stocks_name on stocks(name);

-- 로그인 사용자는 검색(읽기)만 가능. 채우기는 service_role 이 RLS 우회로 처리.
alter table stocks enable row level security;

create policy "read stocks" on stocks
  for select to authenticated using (true);
