// v1 API 서버 (스타터)
// 앱은 외부 API 를 직접 호출하지 않고, 오직 이 서버만 바라본다.
// 실행: npm install  →  cp .env.example .env (값 채우기)  →  npm start

import express from "express";
import { getDisclosures, yyyymmdd } from "./dart.js";
import { getIpoCalendar, getQuote, getCompanyNews } from "./finnhub.js";

const app = express();
app.use(express.json());

// 헬스체크 (GitHub Actions cron 으로 Supabase 깨우기 + 서버 살아있음 확인)
app.get("/", (_req, res) => res.json({ ok: true, service: "stock-alert v1" }));

// 국내 공시: /api/disclosures?corp=00126380&days=7
app.get("/api/disclosures", async (req, res) => {
  try {
    const corp = req.query.corp;
    if (!corp) return res.status(400).json({ error: "corp(코드) 가 필요합니다." });
    const days = Number(req.query.days || 7);
    const end = new Date();
    const begin = new Date(Date.now() - days * 86400000);
    const list = await getDisclosures({
      corpCode: corp,
      bgnDe: yyyymmdd(begin),
      endDe: yyyymmdd(end),
    });
    res.json({ count: list.length, list });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// 미국 IPO 캘린더: /api/ipo?from=2026-05-01&to=2026-06-30
app.get("/api/ipo", async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) return res.status(400).json({ error: "from, to(YYYY-MM-DD) 가 필요합니다." });
    const list = await getIpoCalendar({ from, to });
    res.json({ count: list.length, list });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// 시세: /api/quote?symbol=AAPL
app.get("/api/quote", async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ error: "symbol 이 필요합니다." });
    res.json(await getQuote(symbol));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// 기업 뉴스(v2 용): /api/news?symbol=AAPL&from=2026-05-01&to=2026-05-31
app.get("/api/news", async (req, res) => {
  try {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) return res.status(400).json({ error: "symbol, from, to 필요" });
    res.json({ list: await getCompanyNews({ symbol, from, to }) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행: http://localhost:${PORT}`));
