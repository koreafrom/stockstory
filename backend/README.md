# stock-alert backend (v1 스타터)

국내·해외 공시/공모주 정보를 **서버가 수집**해서 앱에 뿌려주는 최소 백엔드입니다.
앱은 외부 API 를 직접 부르지 않고 이 서버만 호출합니다 (키 보호 + rate limit 통제).

## 1. 무료 키 발급 (둘 다 0원)

- DART 인증키: https://opendart.fss.or.kr → 인증키 신청
- Finnhub 키: https://finnhub.io/register
- SEC EDGAR: 키 불필요 (User-Agent 헤더에 연락처만)

## 2. 실행

```bash
npm install
cp .env.example .env      # 값 채우기
npm start                 # node 20+ 필요 (--env-file 사용)
```

확인:

```bash
curl "http://localhost:3000/"
curl "http://localhost:3000/api/disclosures?corp=00126380&days=7"   # 삼성전자 corp_code 예시
curl "http://localhost:3000/api/ipo?from=2026-05-01&to=2026-06-30"
curl "http://localhost:3000/api/quote?symbol=AAPL"
```

> DART 는 종목코드가 아니라 8자리 `corp_code` 를 씁니다. 전 종목 매핑(`corpCode.xml`)을
> DART 에서 한 번 받아 DB 에 저장해두고 종목코드↔corp_code 변환에 사용하세요.

## 3. 다음 단계 (기획서 2~3단계)

이 스타터는 "조회" 까지입니다. v1 을 완성하려면:

1. **DB (Supabase)**: `users / watchlist / disclosures / ipo_events / devices` 테이블 생성
2. **수집기**: 관심종목들의 신규 공시·IPO 일정을 폴링 → DB 저장 → `receiptNo`(접수번호) 등으로 신규분만 감지
3. **푸시 (FCM)**: 신규 공시·D-day 발생 시 해당 사용자 기기 토큰으로 발송
4. **스케줄러 (GitHub Actions cron, 무료)**: 수집기를 주기 실행 + `/` 헬스체크로 Supabase 일시정지 방지

## 비용

전부 무료입니다. 유일한 예외는 iOS 출시 시 Apple Developer 연 99달러 — v1 은 Android 먼저 권장.
