-- ipo_events 에 원문 링크 컬럼 추가 (국내 공모 신고서 링크용)
-- 이미 schema.sql 을 실행했다면 이 파일만 추가로 실행하세요.

alter table ipo_events add column if not exists url text;
