// api/schedule-notify.js — ⏰ 스케줄 기반 텔레그램 알림
// Vercel Cron: 매시간 정각 호출
// 05:00 KST → 일간 브리핑 자동 생성 + 전송
// 그 외 시간 → 해당 시간의 스케줄 항목을 텔레그램 알림
// 수동: /api/schedule-notify?manual=1 또는 ?test=1 (테스트 메시지)
//       /api/schedule-notify?hour=9 (특정 시간 시뮬레이션)

import { sendTelegram, todayKST, DEFAULT_SCHEDULE, PIPELINE_LABELS, fetchHanokDay } from "./_lib/utils.js";

const esc = (t) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// KST 현재 시간
const nowKST = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return {
    hour: d.getHours(),
    minute: d.getMinutes(),
    hhmm: `${String(d.getHours()).padStart(2, "0")}:00`,
    fullTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
};

export default async function handler(req, res) {
  try {
    const { date, weekday } = todayKST();
    const kst = nowKST();
    const results = [];

    // ── test=1: 텔레그램 연결 테스트 ──
    if (req.query.test === "1") {
      const sent = await sendTelegram(
        `✅ <b>HANOK 텔레그램 연동 테스트</b>\n\n📅 ${date} ${weekday}요일 ${kst.fullTime}\n🤖 schedule-notify API 정상 작동 중\n\n🔗 <a href="https://doubley-agent.vercel.app">에이전트 열기</a>`
      );
      return res.status(200).json({
        agent: "schedule-notify",
        mode: "test",
        telegram_sent: sent,
        kst_time: kst.fullTime,
        env_check: {
          has_bot_token: !!process.env.TELEGRAM_BOT_TOKEN,
          has_chat_id: !!process.env.TELEGRAM_CHAT_ID,
          chat_id: process.env.TELEGRAM_CHAT_ID || "NOT SET",
        },
      });
    }

    // ── hour 파라미터로 시간 오버라이드 (시뮬레이션) ──
    let targetHour = kst.hour;
    let targetHHMM = kst.hhmm;
    if (req.query.hour !== undefined) {
      targetHour = parseInt(req.query.hour);
      targetHHMM = `${String(targetHour).padStart(2, "0")}:00`;
    }

    // ── 05:00 KST: 아침 루틴 안내 (v6.0: AI 브리핑은 HANOK 비서실장 06:50 보고로 이전) ──
    if (targetHour === 5) {
      const sent = await sendTelegram(
        `🌅 <b>좋은 아침입니다</b>\n📅 ${date} ${weekday}요일\n\n✝️ QT · 🙏 기도 30분 · 🏃 새벽운동\n\n📋 HANOK 비서실장 아침 보고는 06:50에 도착합니다.`
      );
      results.push({ type: "morning_routine", sent, time: "05:00" });
    }

    // ── HANOK 업무 블록 알림 (09시: 오전 블록 예고, 14시: 오후 블록 시작, 16시: 남은 일) ──
    if ([9, 14, 16].includes(targetHour)) {
      const day = await fetchHanokDay(date);
      const tasks = day?.plan?.tasks || [];
      const checks = day?.checks || {};
      const blocks = { am: { start: "09:30", end: "11:30" }, pm: { start: "14:00", end: "17:00" }, ...(day?.plan?.blocks || {}) };
      let msg = null;
      if (!day) {
        if (targetHour === 9) msg = `🏢 <b>HANOK 오전 블록 ${blocks.am.start} 시작</b>\n일정을 불러오지 못했어요. 플래너 앱에서 확인해 주세요.`;
      } else if (targetHour === 9 || targetHour === 14) {
        const key = targetHour === 9 ? "am" : "pm";
        const list = tasks.filter(t => (t.block === "pm" ? "pm" : "am") === key && !checks[t.id]?.done);
        const mins = list.reduce((a, t) => a + (Number(t.minutes) || 0), 0);
        const head = targetHour === 9 ? `오전 블록 ${blocks.am.start}–${blocks.am.end}` : `오후 블록 ${blocks.pm.start}–${blocks.pm.end}`;
        msg = list.length
          ? `🏢 <b>HANOK ${head}</b>\n할 일 ${list.length}개 · ${mins}분\n\n` + list.map(t => `• <b>${esc(t.id)}</b> ${esc(t.text)}${t.minutes ? ` (${t.minutes}분)` : ""}`).join("\n")
          : `🏢 <b>HANOK ${head}</b>\n이 블록에 남은 일이 없어요.`;
      } else {
        const left = tasks.filter(t => !checks[t.id]?.done);
        if (left.length) msg = `⏳ <b>HANOK 남은 일 ${left.length}개</b> (오후 블록 ${blocks.pm.end} 마감)\n\n` + left.map(t => `• <b>${esc(t.id)}</b> ${esc(t.text)}`).join("\n");
      }
      if (msg) {
        const sent = await sendTelegram(`${msg}\n\n🔗 <a href="https://doubley-agent.vercel.app">플래너 열기</a>`);
        results.push({ type: "hanok_block", sent, time: targetHHMM, tasks: tasks.length });
      }
    }

    // ── 매시간: 해당 시간 스케줄 알림 ──
    const matchingTasks = DEFAULT_SCHEDULE.filter(s => s.time === targetHHMM);

    if (matchingTasks.length > 0) {
      const taskLines = matchingTasks.map(s => {
        const label = PIPELINE_LABELS[s.pipeline] || s.pipeline;
        return `  ${label}\n  → <b>${s.task}</b> (R${s.round})`;
      }).join("\n\n");

      const message = `⏰ <b>${targetHHMM} 스케줄 알림</b>\n📅 ${date} ${weekday}요일\n\n${taskLines}\n\n🔗 <a href="https://doubley-agent.vercel.app">에이전트 열기</a>`;

      const sent = await sendTelegram(message);
      results.push({ type: "schedule_notify", sent, time: targetHHMM, tasks: matchingTasks.length });
    }

    // 아무 알림도 없으면 로그만
    if (results.length === 0) {
      results.push({ type: "no_tasks", time: targetHHMM, message: `${targetHHMM}에 예정된 스케줄 없음` });
    }

    return res.status(200).json({
      agent: "schedule-notify",
      timestamp: new Date().toISOString(),
      kst_time: kst.fullTime,
      target_hour: targetHour,
      target_hhmm: targetHHMM,
      date,
      weekday,
      results,
    });
  } catch (error) {
    console.error("[ScheduleNotify] Error:", error.message);
    return res.status(500).json({ error: error.message, agent: "schedule-notify" });
  }
}
