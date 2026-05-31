// Vercel 서버리스 함수: 주요 지수/코인/환율 시세 중계
// 앱은 이 엔드포인트(/api/indices)만 호출한다 → CORS 해결 + 야후 직접 호출 회피
//
// 야후 파이낸스는 비공식 엔드포인트라 막힐 수 있다. 그 경우 이 파일만 고치면 된다.
// (앱 코드는 건드릴 필요 없음)

// 표시할 항목: [야후심볼, 한글이름]
const SYMBOLS = [
  ["^KS11", "코스피"],
  ["^KQ11", "코스닥"],
  ["^GSPC", "S&P500"],
  ["^IXIC", "나스닥"],
  ["^DJI", "다우"],
  ["BTC-USD", "비트코인"],
  ["KRW=X", "달러/원"],
];

export default async function handler(req, res) {
  // CORS 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") return res.status(200).end();

  const symbols = SYMBOLS.map(([s]) => s).join(",");
  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
    encodeURIComponent(symbols);

  try {
    const r = await fetch(url, {
      headers: {
        // 야후가 봇 차단을 하므로 일반 브라우저처럼 보이게 함
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!r.ok) throw new Error("Yahoo HTTP " + r.status);
    const data = await r.json();
    const quotes = data?.quoteResponse?.result || [];

    const nameMap = Object.fromEntries(SYMBOLS);
    const list = quotes.map((q) => ({
      symbol: q.symbol,
      name: nameMap[q.symbol] || q.shortName || q.symbol,
      price: q.regularMarketPrice ?? null,
      change: q.regularMarketChange ?? null,
      percent: q.regularMarketChangePercent ?? null,
    }));

    // 60초 캐시 (과한 호출 방지)
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.status(200).json({ ok: true, list, at: Date.now() });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e.message || e), list: [] });
  }
}
