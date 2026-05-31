// 수집기: 관심종목의 신규 공시(국내 DART) 감지 + 미국 IPO 캘린더 갱신
// GitHub Actions cron 으로 주기 실행한다. (node src/collector.js)
//
// 흐름:
//   1) watchlist 에서 국내 corp_code 모으기
//   2) 최근 며칠 공시 조회 → DB 에 없는 신규분만 insert → 반환
//   3) 미국 IPO 캘린더(향후 60일) upsert (캘린더 표시용)
//   반환된 신규 공시는 다음 단계(FCM 푸시)의 입력이 된다.

import { supabase } from "./db.js";
import { getDisclosures, yyyymmdd } from "./dart.js";
import { getIpoCalendar } from "./finnhub.js";
import { collectKrIpo } from "./dart_ipo.js";
import { summaryEnabled, summarizeTitle } from "./summarize.js";
import { pushConfigured, notifyDisclosures, notifyIpoDday } from "./notify.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 'YYYYMMDD' -> 'YYYY-MM-DD'
function fmtDate(s) {
  if (!s || s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// rows 중 DB 에 아직 없는 것만 insert 하고, insert 된 행을 반환
async function insertNew(table, rows, keyCol) {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r[keyCol]))];

  const { data: existing, error: selErr } = await supabase
    .from(table)
    .select(keyCol)
    .in(keyCol, ids);
  if (selErr) throw selErr;

  const have = new Set((existing || []).map((r) => r[keyCol]));
  const seen = new Set();
  const fresh = [];
  for (const r of rows) {
    if (have.has(r[keyCol]) || seen.has(r[keyCol])) continue;
    seen.add(r[keyCol]);
    fresh.push(r);
  }
  if (!fresh.length) return [];

  const { data, error } = await supabase.from(table).insert(fresh).select();
  if (error) throw error;
  return data;
}

async function collectKrDisclosures() {
  const { data: wl, error } = await supabase
    .from("watchlist")
    .select("corp_code, symbol, name")
    .eq("market", "KR")
    .not("corp_code", "is", null);
  if (error) throw error;

  const corps = [...new Map((wl || []).map((w) => [w.corp_code, w])).values()];
  if (!corps.length) return [];

  const end = new Date();
  const begin = new Date(Date.now() - 3 * 86400000);
  const rows = [];
  for (const w of corps) {
    try {
      const list = await getDisclosures({
        corpCode: w.corp_code,
        bgnDe: yyyymmdd(begin),
        endDe: yyyymmdd(end),
      });
      for (const d of list) {
        rows.push({
          market: "KR",
          symbol: w.symbol || d.stockCode || null,
          ext_id: d.receiptNo,
          title: d.reportName,
          filer: d.filerName,
          url: d.url,
          filed_at: fmtDate(d.receiptDate),
        });
      }
    } catch (e) {
      console.error(`[KR] ${w.corp_code} 공시 조회 실패: ${e.message}`);
    }
    await sleep(250); // 외부 API 예의상 간격
  }
  return insertNew("disclosures", rows, "ext_id");
}

async function refreshUsIpoCalendar() {
  const from = yyyymmdd(new Date()).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const toDate = new Date(Date.now() + 60 * 86400000);
  const to = yyyymmdd(toDate).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

  let list = [];
  try {
    list = await getIpoCalendar({ from, to });
  } catch (e) {
    console.error(`[US] IPO 캘린더 실패: ${e.message}`);
    return;
  }

  const rows = list
    .filter((it) => it.date && it.name)
    .map((it) => ({
      market: "US",
      symbol: it.symbol || null,
      name: it.name,
      kind: "ipo",
      event_date: it.date,
      exchange: it.exchange || null,
      price_range: it.priceRange || null,
    }));

  if (!rows.length) return;
  const { error } = await supabase
    .from("ipo_events")
    .upsert(rows, { onConflict: "market,name,kind,event_date", ignoreDuplicates: true });
  if (error) throw error;
}

async function main() {
  console.log("수집 시작:", new Date().toISOString());

  const newDisclosures = await collectKrDisclosures();
  console.log(`신규 공시 ${newDisclosures.length}건`);

  // 신규 공시에 AI 한 줄 요약 달기 (무료 티어 한도 고려해 간격 둠)
  if (summaryEnabled && newDisclosures.length) {
    for (const d of newDisclosures) {
      const s = await summarizeTitle(d.title);
      if (s) {
        d.summary = s;
        await supabase.from("disclosures").update({ summary: s }).eq("id", d.id);
      }
      await sleep(4000); // 약 15 RPM 한도 안에서
    }
    console.log("AI 요약 완료");
  }

  await refreshUsIpoCalendar();
  await collectKrIpo();
  console.log("IPO 캘린더 갱신 완료");

  if (pushConfigured) {
    await notifyDisclosures(newDisclosures);
    await notifyIpoDday();
    console.log("푸시 발송 완료");
  } else {
    console.log("FCM 미설정 — 푸시 건너뜀");
  }

  return newDisclosures;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("수집 실패:", e);
    process.exit(1);
  });
