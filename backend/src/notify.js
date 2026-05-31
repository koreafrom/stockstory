// FCM 푸시 발송 (firebase-admin, HTTP v1)
// 발송은 무료. 인증은 Firebase 서비스 계정 JSON 으로 처리한다.
//
// 환경변수 FCM_SERVICE_ACCOUNT = 서비스계정 JSON 을 base64 로 인코딩한 값
//   생성: base64 -w0 serviceAccount.json   (mac: base64 -i serviceAccount.json)

import admin from "firebase-admin";
import { supabase } from "./db.js";

export const pushConfigured = !!process.env.FCM_SERVICE_ACCOUNT;

let _messaging = null;
function getMessaging() {
  if (_messaging) return _messaging;
  if (!process.env.FCM_SERVICE_ACCOUNT) {
    throw new Error("FCM_SERVICE_ACCOUNT 가 설정되지 않았습니다.");
  }
  const sa = JSON.parse(
    Buffer.from(process.env.FCM_SERVICE_ACCOUNT, "base64").toString("utf8")
  );
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  _messaging = admin.messaging();
  return _messaging;
}

// ---- 저수준 발송 ----------------------------------------------------------
// tokens 로 푸시. 잘못된 토큰 목록을 반환(호출측에서 DB 정리).
export async function sendToTokens(tokens, { title, body, data = {} }) {
  if (!tokens.length) return { successCount: 0, invalidTokens: [] };
  const messaging = getMessaging();
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
  );

  let successCount = 0;
  const invalidTokens = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const resp = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: stringData,
    });
    successCount += resp.successCount;
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-argument")
        ) {
          invalidTokens.push(batch[idx]);
        }
      }
    });
  }
  return { successCount, invalidTokens };
}

// ---- DB 헬퍼 --------------------------------------------------------------
async function watchersOf(market, symbol) {
  const { data, error } = await supabase
    .from("watchlist")
    .select("user_id")
    .eq("market", market)
    .eq("symbol", symbol);
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.user_id))];
}

async function tokensOf(userId) {
  const { data, error } = await supabase
    .from("devices")
    .select("fcm_token")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((r) => r.fcm_token);
}

async function alreadySent(userId, refType, refId) {
  const { data } = await supabase
    .from("sent_notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("ref_type", refType)
    .eq("ref_id", refId)
    .maybeSingle();
  return !!data;
}

async function markSent(userId, refType, refId) {
  await supabase
    .from("sent_notifications")
    .insert({ user_id: userId, ref_type: refType, ref_id: refId });
}

async function deleteTokens(tokens) {
  if (!tokens.length) return;
  await supabase.from("devices").delete().in("fcm_token", tokens);
}

// 한 사용자에게 1건 발송 + 중복방지 + 죽은토큰 정리
async function pushOnce(userId, refType, refId, payload) {
  if (await alreadySent(userId, refType, refId)) return;
  const tokens = await tokensOf(userId);
  if (!tokens.length) {
    await markSent(userId, refType, refId); // 기기 없어도 기록(추후 재발송 방지)
    return;
  }
  const { invalidTokens } = await sendToTokens(tokens, payload);
  await deleteTokens(invalidTokens);
  await markSent(userId, refType, refId);
}

// ---- 고수준: 수집기에서 호출 ----------------------------------------------
export async function notifyDisclosures(newDisclosures) {
  for (const d of newDisclosures) {
    if (!d.symbol) continue;
    const users = await watchersOf(d.market, d.symbol);
    for (const userId of users) {
      await pushOnce(userId, "disclosure", d.ext_id, {
        title: `${d.symbol} 새 공시`,
        body: (d.summary && d.summary.length > 0) ? d.summary : d.title,
        data: { type: "disclosure", ext_id: d.ext_id, url: d.url || "" },
      });
    }
  }
}

// 오늘이 이벤트일(상장일 등)인 IPO 를 관심 사용자에게 알림
export async function notifyIpoDday() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: events, error } = await supabase
    .from("ipo_events")
    .select("*")
    .eq("event_date", today)
    .not("symbol", "is", null);
  if (error) throw error;

  for (const ev of events || []) {
    const users = await watchersOf(ev.market, ev.symbol);
    for (const userId of users) {
      await pushOnce(userId, "ipo", String(ev.id), {
        title: `${ev.name} 상장일`,
        body: `오늘 ${ev.exchange || ""} 상장 예정`.trim(),
        data: { type: "ipo", ipo_id: String(ev.id) },
      });
    }
  }
}
