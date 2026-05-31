// AI 공시 요약 (Gemini 무료 티어)
// 공시 '제목'을 일반 투자자가 이해할 한 줄 설명으로 바꾼다.
// 중요: 투자 의견/추천 금지 — 유사투자자문 리스크 회피. 설명만.
//
// 키 발급: https://aistudio.google.com/apikey  → GEMINI_API_KEY

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const summaryEnabled = !!process.env.GEMINI_API_KEY;

const SYSTEM = `너는 한국 주식 공시를 일반 투자자가 이해하기 쉽게 풀어주는 도우미다.
규칙:
- 공시 제목을 보고 "무슨 내용인지"를 한 문장(40자 내외)으로 중립적으로 설명한다.
- 투자 의견, 주가 전망, 매수/매도 추천은 절대 하지 않는다.
- 과장·감정 표현 없이 사실만. 불확실하면 제목을 그대로 풀어 쓴다.
- 한국어로, 군더더기 없이 핵심만.`;

export async function summarizeTitle(title) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !title) return null;
  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `공시 제목: ${title}` }] }],
        generationConfig: { maxOutputTokens: 80, temperature: 0.2 },
      }),
    });
    if (res.status === 429) {
      console.error("Gemini rate limit (무료 한도 초과)");
      return null;
    }
    if (!res.ok) {
      console.error(`Gemini HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (e) {
    console.error(`요약 실패: ${e.message}`);
    return null;
  }
}
