// 국내 공모주(IPO) 수집
// DART 발행공시(pblntf_ty=C) 중 "증권신고서(지분증권)" = 신규 IPO 등록을 잡는다.
//
// 한계(정직하게): DART 는 IPO '등록 사실 + 원문 링크'까지 무료로 준다.
//   정확한 청약일/상장일/공모가는 신고서 본문 파싱(또는 KRX KIND) 필요 → 이후 보강.
//   그래서 event_date 는 '신고서 제출일'이고, kind='filing' 으로 저장한다.

import { getDisclosures, yyyymmdd } from "./dart.js";
import { supabase } from "./db.js";

function fmtDate(s) {
  return s && s.length === 8
    ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
    : null;
}

export async function collectKrIpo() {
  const end = new Date();
  const begin = new Date(Date.now() - 5 * 86400000);

  let list = [];
  try {
    list = await getDisclosures({
      bgnDe: yyyymmdd(begin),
      endDe: yyyymmdd(end),
      pblntfTy: "C", // 발행공시
      pageCount: 100,
    });
  } catch (e) {
    console.error(`[KR IPO] 조회 실패: ${e.message}`);
    return;
  }

  const rows = list
    .filter(
      (d) =>
        d.reportName &&
        d.reportName.includes("증권신고서") &&
        d.reportName.includes("지분증권")
    )
    .map((d) => ({
      market: "KR",
      symbol: d.stockCode || null,
      name: d.corpName,
      kind: "filing",
      event_date: fmtDate(d.receiptDate),
      exchange: null,
      price_range: null,
      url: d.url,
    }))
    .filter((r) => r.event_date && r.name);

  if (!rows.length) {
    console.log("KR 공모주 신규 없음");
    return;
  }

  const { error } = await supabase
    .from("ipo_events")
    .upsert(rows, { onConflict: "market,name,kind,event_date", ignoreDuplicates: true });
  if (error) throw error;
  console.log(`KR 공모주 신고서 ${rows.length}건 반영`);
}
