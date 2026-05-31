// DART (금융감독원 전자공시) 공시 목록 조회
// 문서: https://opendart.fss.or.kr/guide/main.do?apiGrpCd=DS001
//
// 주의: DART 는 종목코드(예: 005930)가 아니라 8자리 corp_code 를 사용한다.
// 전 종목 매핑은 corpCode.xml(무료) 을 한 번 받아 DB 에 저장해두고 변환한다.

const DART_BASE = "https://opendart.fss.or.kr/api";

// YYYYMMDD 포맷 헬퍼
export function yyyymmdd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// 특정 기업의 기간 내 공시 목록
// corpCode: 8자리 문자열, bgnDe/endDe: 'YYYYMMDD'
export async function getDisclosures({ corpCode, bgnDe, endDe, pblntfTy, pageNo, pageCount = 20 }) {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY 가 설정되지 않았습니다.");

  const url = new URL(`${DART_BASE}/list.json`);
  url.searchParams.set("crtfc_key", key);
  if (corpCode) url.searchParams.set("corp_code", corpCode);
  if (bgnDe) url.searchParams.set("bgn_de", bgnDe);
  if (endDe) url.searchParams.set("end_de", endDe);
  if (pblntfTy) url.searchParams.set("pblntf_ty", pblntfTy); // A정기 B주요사항 C발행 D지분 ...
  if (pageNo) url.searchParams.set("page_no", String(pageNo));
  url.searchParams.set("page_count", String(pageCount));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`DART HTTP ${res.status}`);
  const data = await res.json();

  // status '000' = 정상, '013' = 조회 데이터 없음
  if (data.status !== "000") {
    if (data.status === "013") return [];
    throw new Error(`DART error ${data.status}: ${data.message}`);
  }

  return (data.list || []).map((it) => ({
    corpName: it.corp_name,
    stockCode: it.stock_code,
    reportName: it.report_nm,       // 보고서명 (예: 주요사항보고서(...))
    receiptNo: it.rcept_no,         // 접수번호 (고유 id 로 사용 → 신규 감지)
    filerName: it.flr_nm,
    receiptDate: it.rcept_dt,       // YYYYMMDD
    // 공시 원문 링크
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${it.rcept_no}`,
  }));
}
