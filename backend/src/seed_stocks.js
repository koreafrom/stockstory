// 종목 마스터 채우기: 국내(DART corpCode) + 미국(Finnhub symbols)
// 실행: npm run seed   (가끔 한 번씩, 월 1회 정도면 충분)

import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { supabase } from "./db.js";

// Supabase upsert 를 청크로 나눠 적재
async function upsertChunked(rows, size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase
      .from("stocks")
      .upsert(chunk, { onConflict: "market,symbol" });
    if (error) throw error;
  }
}

// 국내: DART 전체 기업코드(zip 안의 XML) → 상장사(stock_code 있는 것)만
async function seedKr() {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY 가 필요합니다.");

  const res = await fetch(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${key}`
  );
  if (!res.ok) throw new Error(`DART corpCode HTTP ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buf);
  const entry = zip
    .getEntries()
    .find((e) => e.entryName.toUpperCase().endsWith(".XML"));
  if (!entry) throw new Error("zip 안에서 CORPCODE.xml 을 찾지 못했습니다.");

  const xml = entry.getData().toString("utf8");
  // parseTagValue:false → 숫자형 값(예: corp_code '00126380')의 앞자리 0 보존
  const parser = new XMLParser({ parseTagValue: false, trimValues: true });
  const parsed = parser.parse(xml);
  const listRaw = parsed?.result?.list ?? [];
  const list = Array.isArray(listRaw) ? listRaw : [listRaw];

  const rows = [];
  for (const it of list) {
    const stock = String(it.stock_code ?? "").trim();
    if (!stock) continue; // 상장사만 (비상장은 stock_code 가 비어 있음)
    rows.push({
      market: "KR",
      symbol: stock,
      name: String(it.corp_name ?? "").trim(),
      corp_code: String(it.corp_code ?? "").trim().padStart(8, "0"),
    });
  }
  await upsertChunked(rows);
  console.log(`KR 상장사 ${rows.length}건 적재`);
}

// 미국: Finnhub 심볼 목록 → 보통주만
async function seedUs() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY 가 필요합니다.");

  const res = await fetch(
    `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${key}`
  );
  if (res.status === 429) throw new Error("Finnhub rate limit");
  if (!res.ok) throw new Error(`Finnhub symbol HTTP ${res.status}`);

  const list = await res.json();
  const rows = [];
  for (const it of list) {
    if (it.type && it.type !== "Common Stock") continue;
    const symbol = String(it.symbol ?? "").trim();
    if (!symbol || symbol.includes(".")) continue; // 단순화: 일반 티커만
    const name = String(it.description ?? "").trim() || symbol;
    rows.push({ market: "US", symbol, name, corp_code: null });
  }
  await upsertChunked(rows);
  console.log(`US 종목 ${rows.length}건 적재`);
}

async function main() {
  console.log("종목 마스터 적재 시작:", new Date().toISOString());
  await seedKr();
  await seedUs();
  console.log("완료");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("seed 실패:", e);
    process.exit(1);
  });
