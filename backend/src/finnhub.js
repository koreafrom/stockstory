// Finnhub (해외주식) - 무료 티어로 IPO 캘린더 / 시세 / 기업 뉴스
// 문서: https://finnhub.io/docs/api
// 무료 티어: 분당 60회. 키 발급: https://finnhub.io/register

const FH_BASE = "https://finnhub.io/api/v1";

function key() {
  const k = process.env.FINNHUB_API_KEY;
  if (!k) throw new Error("FINNHUB_API_KEY 가 설정되지 않았습니다.");
  return k;
}

async function fhGet(path, params = {}) {
  const url = new URL(`${FH_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("token", key());
  const res = await fetch(url);
  if (res.status === 429) throw new Error("Finnhub rate limit (분당 60회 초과)");
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  return res.json();
}

// 미국 IPO 캘린더 (from/to: 'YYYY-MM-DD')
export async function getIpoCalendar({ from, to }) {
  const data = await fhGet("/calendar/ipo", { from, to });
  return (data.ipoCalendar || []).map((it) => ({
    symbol: it.symbol,
    name: it.name,
    date: it.date,              // 상장 예정일
    exchange: it.exchange,
    priceRange: it.price,       // 공모가 밴드
    shares: it.numberOfShares,
    status: it.status,          // expected / priced / withdrawn 등
  }));
}

// 현재가 (무료)
export async function getQuote(symbol) {
  const q = await fhGet("/quote", { symbol });
  return {
    symbol,
    price: q.c,                 // 현재가
    change: q.d,                // 변동
    percent: q.dp,              // 변동률(%)
    prevClose: q.pc,
  };
}

// 기업 뉴스 (무료) - 제목/출처/링크만 사용하고 전문은 재현하지 않는다.
export async function getCompanyNews({ symbol, from, to }) {
  const data = await fhGet("/company-news", { symbol, from, to });
  return (data || []).slice(0, 20).map((n) => ({
    headline: n.headline,
    source: n.source,
    url: n.url,
    datetime: n.datetime,
  }));
}
