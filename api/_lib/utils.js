// api/_lib/utils.js — 기획·분석부 공유 유틸리티

export const callClaude = async (system, userMessage, maxTokens = 2000) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude API HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

// Web search 포함 Claude 호출 (리서처 팩트체크용)
export const callClaudeWithSearch = async (system, userMessage, maxTokens = 3000) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude API HTTP ${res.status}`);
  }
  const data = await res.json();
  // web search 결과를 포함한 전체 텍스트 추출
  const textBlocks = (data.content || []).filter(b => b.type === "text").map(b => b.text);
  return textBlocks.join("\n") || "";
};

export const sendKakao = async (text) => {
  const token = process.env.KAKAO_ACCESS_TOKEN;
  if (!token) {
    console.log("[Kakao] No token, skipping notification");
    return false;
  }
  try {
    const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body: new URLSearchParams({
        template_object: JSON.stringify({
          object_type: "text",
          text: text.slice(0, 1000),
          link: { web_url: "https://doubley-agent.vercel.app", mobile_web_url: "https://doubley-agent.vercel.app" },
          button_title: "에이전트 열기",
        }),
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[Kakao] Send error:", e.message);
    return false;
  }
};

export const sendTelegram = async (text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log("[Telegram] No token/chatId, skipping notification");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("[Telegram] API error:", data.description);
    return data.ok;
  } catch (e) {
    console.error("[Telegram] Send error:", e.message);
    return false;
  }
};

export const todayKST = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return { date: `${y}-${m}-${day}`, weekday: weekdays[d.getDay()], dayIndex: d.getDay() };
};

export const PIPELINES = {
  월: { main: "스포츠 (KBO 파워랭킹)", sub: "경제", novel: "웹소설 1화" },
  화: { main: "정치", sub: "라이프", novel: "웹소설 2화", music: true },
  수: { main: "경제 + 롱폼", sub: "스포츠", novel: "웹소설 3화" },
  목: { main: "스포츠", sub: "자기계발", novel: "웹소설 4화" },
  금: { main: "라이프", sub: "경제", novel: "웹소설 5화 (클리프행어)", music: true },
  토: { main: "— (예약발행)", sub: "—", novel: "휴재 (독자 피드백 분석)" },
  일: { main: "— (휴식)", sub: "—", novel: "다음주 개요 자동생성" },
};

// Vercel KV 대신 간단한 파일 저장소 (또는 환경변수 기반)
// 프로덕션에서는 Vercel KV 또는 Upstash Redis 사용 권장
export const saveResult = async (key, data) => {
  // 임시: 환경변수로는 저장 불가 → 로그로 남기고 프론트에서 fetch
  console.log(`[SAVE] ${key}:`, JSON.stringify(data).slice(0, 200));
  return data;
};

// ── CEO 일일 스케줄 (프론트 StrategistTab과 동기화) ──
export const DEFAULT_SCHEDULE = [
  // v6.1: HANOK 업무 알림(09시·14시·16시)은 schedule-notify가 플래너 연동 일정으로 직접 보냅니다.
  { id: "self_1", pipeline: "_self", time: "23:00", task: "2가지 아이디어 정리", round: 1 },
];

// ── HANOK 플래너 연동 (Apps Script) ──
export const fetchHanokDay = async (date) => {
  const url = process.env.HANOK_SYNC_URL;
  const token = process.env.HANOK_SYNC_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url}?token=${encodeURIComponent(token)}&date=${date}`, { redirect: "follow" });
    const j = await r.json();
    return j && j.ok ? j : null;
  } catch (e) {
    console.error("[HanokSync]", e.message);
    return null;
  }
};

export const PIPELINE_LABELS = {
  politics: "🎙️ 정치 (BluntEdge)",
  sports: "⚽ 스포츠 (EdgeStats)",
  economy: "📈 경제 (MarketEdge)",
  life: "☕ 라이프 (onedo4u)",
  culture: "🎨 문화예술",
  philosophy: "📜 철학",
  novel: "📖 웹소설",
  music: "🎵 음원",
  _self: "💡 자기계발",
};
