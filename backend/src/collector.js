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
import {
  getIpoCalendar,
  getCompanyNews,
  getDividends,
  getDividendYield,
  getEarningsCalendar,
} from "./finnhub.js";
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

// 관심종목의 미국 심볼 모으기 (뉴스/배당/실적 공용)
async function usWatchSymbols() {
  const { data, error } = await supabase
    .from("watchlist")
    .select("symbol, name")
    .eq("market", "US");
  if (error) throw error;
  return [...new Map((data || []).map((w) => [w.symbol, w])).values()];
}

const ymd = (d) => yyyymmdd(d).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

// 해외 뉴스 수집 (최근 7일) → news 표
async function collectUsNews(symbols) {
  if (!symbols.length) return 0;
  const from = ymd(new Date(Date.now() - 7 * 86400000));
  const to = ymd(new Date());
  const rows = [];
  for (const w of symbols) {
    try {
      const list = await getCompanyNews({ symbol: w.symbol, from, to });
      for (const n of list) {
        if (!n.url || !n.headline) continue;
        rows.push({
          market: "US",
          symbol: w.symbol,
          ext_id: n.url,
          headline: n.headline,
          source: n.source || null,
          url: n.url,
          published_at: n.datetime ? new Date(n.datetime * 1000).toISOString() : null,
        });
      }
    } catch (e) {
      console.error(`[US] ${w.symbol} 뉴스 실패: ${e.message}`);
    }
    await sleep(250);
  }
  const inserted = await insertNew("news", rows, "ext_id");
  return inserted.length;
}

// 해외 배당 수집 → dividends 표 (무료 한도면 0건)
async function collectUsDividends(symbols) {
  if (!symbols.length) return 0;
  const from = ymd(new Date(Date.now() - 30 * 86400000));
  const to = ymd(new Date(Date.now() + 90 * 86400000));
  const rows = [];
  for (const w of symbols) {
    try {
      const divs = await getDividends({ symbol: w.symbol, from, to });
      if (!divs.length) { await sleep(250); continue; }
      const yld = await getDividendYield(w.symbol);
      for (const d of divs) {
        if (!d.exDate) continue;
        rows.push({
          market: "US",
          symbol: w.symbol,
          name: w.name || null,
          ex_date: d.exDate,
          pay_date: d.payDate,
          amount: d.amount,
          yield_pct: yld,
          freq: d.freq,
        });
      }
    } catch (e) {
      console.error(`[US] ${w.symbol} 배당 실패: ${e.message}`);
    }
    await sleep(300);
  }
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("dividends")
    .upsert(rows, { onConflict: "market,symbol,ex_date", ignoreDuplicates: false });
  if (error) throw error;
  return rows.length;
}

// 해외 실적 일정 수집 → earnings 표 (무료 한도면 0건)
async function collectUsEarnings(symbols) {
  if (!symbols.length) return 0;
  const from = ymd(new Date(Date.now() - 7 * 86400000));
  const to = ymd(new Date(Date.now() + 90 * 86400000));
  const rows = [];
  for (const w of symbols) {
    try {
      const list = await getEarningsCalendar({ symbol: w.symbol, from, to });
      for (const e of list) {
        if (!e.date) continue;
        rows.push({
          market: "US",
          symbol: w.symbol,
          name: w.name || null,
          report_date: e.date,
          period: e.period,
          eps_estimate: e.epsEstimate,
          hour: e.hour,
        });
      }
    } catch (e) {
      console.error(`[US] ${w.symbol} 실적 실패: ${e.message}`);
    }
    await sleep(300);
  }
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("earnings")
    .upsert(rows, { onConflict: "market,symbol,report_date", ignoreDuplicates: false });
  if (error) throw error;
  return rows.length;
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

  // 해외 관심종목: 뉴스/배당/실적 수집 (무료 한도에서 막히면 0건)
  try {
    const usSyms = await usWatchSymbols();
    const newsN = await collectUsNews(usSyms);
    const divN = await collectUsDividends(usSyms);
    const earnN = await collectUsEarnings(usSyms);
    console.log(`해외 뉴스 ${newsN}건 / 배당 ${divN}건 / 실적 ${earnN}건`);
  } catch (e) {
    console.error("해외 부가정보 수집 일부 실패:", e.message);
  }

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
