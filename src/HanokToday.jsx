import { useState, useEffect, useCallback } from "react";

// HANOK 오늘 업무 — 비서실장이 06:50에 Drive '플래너 연동' 폴더에 올린 CEO 일정을
// Apps Script 연동 주소로 읽어 오고, 체크·메모를 다시 Drive에 기록합니다.
// 다음 날 아침 비서실장이 체크·메모를 읽어 완료로 반영합니다.

const P = {
  bg: "#1a1a18", surface: "#242422", surface2: "#2e2c28",
  border: "#3a3a36", gold: "#C4A86C", goldDim: "#c4a86c22",
  text: "#e8e4dc", textMuted: "#9a9690", textDim: "#6a6660",
  green: "#6dcc7a", greenDim: "#6dcc7a22", red: "#e07070", blue: "#7aabcc",
};

const LS_URL = "hanok_sync_url";
const LS_TOKEN = "hanok_sync_token";
const lsGet = (k, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const cacheKey = (date) => `hanok_cache_${date}`;

const kstDate = (offsetDays = 0) => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const kstMinutes = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return d.getHours() * 60 + d.getMinutes();
};
const toMin = (hhmm) => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return h * 60 + (m || 0); };

const DEFAULT_BLOCKS = {
  am: { start: "09:30", end: "11:30", minutes: 120 },
  pm: { start: "14:00", end: "17:00", minutes: 180 },
};

function Settings({ onSaved }) {
  const [url, setUrl] = useState(lsGet(LS_URL));
  const [token, setToken] = useState(lsGet(LS_TOKEN));
  const ok = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url.trim()) && token.trim().length >= 8;
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: P.gold }}>HANOK 연동 설정</div>
      <div style={{ fontSize: 12, color: P.textMuted, lineHeight: 1.6 }}>
        Apps Script 연동 주소와 연동 비밀번호를 한 번만 넣으면 이 기기에 저장됩니다.
      </div>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec"
        style={inp} />
      <input value={token} onChange={e => setToken(e.target.value)} placeholder="연동 비밀번호" type="password" style={inp} />
      <button disabled={!ok} onClick={() => { lsSet(LS_URL, url.trim()); lsSet(LS_TOKEN, token.trim()); onSaved(); }}
        style={{ ...btn, opacity: ok ? 1 : 0.4 }}>저장</button>
    </div>
  );
}

const inp = { background: P.bg, border: `1px solid ${P.border}`, borderRadius: 8, padding: "9px 10px", color: P.text, fontSize: 13, fontFamily: "inherit" };
const btn = { background: P.gold, border: "none", borderRadius: 8, padding: "9px 14px", color: "#1a1a18", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" };

function TaskRow({ t, check, onToggle, onNote, busy }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(check?.note || "");
  useEffect(() => { setNote(check?.note || ""); }, [check?.note]);
  const done = !!check?.done;
  const sentNote = !!check?.note;
  return (
    <div style={{ background: P.surface2, border: `1px solid ${done ? P.green + "55" : P.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <button onClick={() => onToggle(t.id, !done)} disabled={busy} aria-label={done ? "완료 취소" : "완료"}
          style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 6, border: `1.5px solid ${done ? P.green : P.textDim}`, background: done ? P.green : "transparent", color: "#1a1a18", cursor: "pointer", fontWeight: 800, lineHeight: "20px" }}>
          {done ? "✓" : ""}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: done ? P.textMuted : P.text, textDecoration: done ? "line-through" : "none", lineHeight: 1.5, wordBreak: "keep-all", overflowWrap: "anywhere" }}>
            <span style={{ color: P.gold, fontWeight: 700, marginRight: 6 }}>{t.id}</span>{t.text}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", fontSize: 11.5, color: P.textDim }}>
            {t.minutes ? <span>{t.minutes}분</span> : null}
            {(t.links || []).map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ color: P.blue }}>{l.label || "링크"}</a>
            ))}
            <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", color: sentNote ? P.green : P.textMuted, cursor: "pointer", fontSize: 11.5, padding: 0, fontFamily: "inherit" }}>
              {sentNote ? "✎ 메모 보냄" : t.answer_hint ? "✎ 답하기" : "✎ 메모"}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500}
            placeholder={t.answer_hint || "비서실장에게 남길 메모 (승인·보류·지시)"}
            style={{ ...inp, resize: "vertical", fontSize: 12.5 }} />
          <div style={{ fontSize: 11, color: P.textDim }}>비밀번호·키는 적지 마세요. 내일 아침 보고에 반영됩니다.</div>
          <button disabled={busy || !note.trim()} onClick={() => onNote(t.id, note.trim())} style={{ ...btn, alignSelf: "flex-end", padding: "6px 12px", fontSize: 12, opacity: note.trim() ? 1 : 0.4 }}>메모 보내기</button>
        </div>
      )}
    </div>
  );
}

function Block({ title, block, tasks, checks, now, onToggle, onNote, busyId }) {
  const s = toMin(block.start), e = toMin(block.end);
  const active = now >= s && now < e;
  const used = tasks.reduce((a, t) => a + (Number(t.minutes) || 0), 0);
  const doneMin = tasks.filter(t => checks[t.id]?.done).reduce((a, t) => a + (Number(t.minutes) || 0), 0);
  const cap = block.minutes || (e - s);
  return (
    <section style={{ background: P.surface, border: `1px solid ${active ? P.gold : P.border}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: active ? P.gold : P.text }}>{title}</div>
        <div style={{ fontSize: 12, color: P.textMuted }}>{block.start}–{block.end}</div>
        {active && <span style={{ fontSize: 11, color: P.gold, background: P.goldDim, borderRadius: 99, padding: "2px 8px" }}>지금</span>}
        <div style={{ marginLeft: "auto", fontSize: 11.5, color: P.textDim, fontVariantNumeric: "tabular-nums" }}>{doneMin}/{used}분 완료 · 배정 {used}/{cap}분</div>
      </div>
      <div style={{ height: 6, background: P.surface2, borderRadius: 99, overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${Math.min(100, (doneMin / cap) * 100)}%`, background: P.green }} />
        <div style={{ width: `${Math.max(0, Math.min(100, ((used - doneMin) / cap) * 100))}%`, background: P.gold + "66" }} />
      </div>
      {tasks.length === 0
        ? <div style={{ fontSize: 12, color: P.textDim }}>배정된 일이 없어요.</div>
        : tasks.map(t => <TaskRow key={t.id} t={t} check={checks[t.id]} onToggle={onToggle} onNote={onNote} busy={busyId === t.id} />)}
    </section>
  );
}

export default function HanokToday() {
  const [configured, setConfigured] = useState(!!lsGet(LS_URL) && !!lsGet(LS_TOKEN));
  const [showSettings, setShowSettings] = useState(false);
  const [date, setDate] = useState(kstDate(0));
  const [data, setData] = useState(() => { try { return JSON.parse(lsGet(cacheKey(kstDate(0)), "null")); } catch { return null; } });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(kstMinutes());

  useEffect(() => { const t = setInterval(() => setNow(kstMinutes()), 60000); return () => clearInterval(t); }, []);

  const load = useCallback(async (d = date) => {
    const url = lsGet(LS_URL), token = lsGet(LS_TOKEN);
    if (!url || !token) return;
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${url}?token=${encodeURIComponent(token)}&date=${d}`, { redirect: "follow" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error === "unauthorized" ? "연동 비밀번호가 맞지 않아요" : (j.error || "불러오기 실패"));
      setData(j); lsSet(cacheKey(d), JSON.stringify(j));
    } catch (e) {
      setErr(e.message || "불러오기 실패");
      try { setData(JSON.parse(lsGet(cacheKey(d), "null"))); } catch {}
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { if (configured) load(date); }, [configured, date]);

  const post = async (body) => {
    const url = lsGet(LS_URL), token = lsGet(LS_TOKEN);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ token, date, ...body }), redirect: "follow" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "저장 실패");
    return j.item;
  };
  const updateCheck = (id, item) => setData(d => {
    const nd = { ...(d || {}), checks: { ...((d && d.checks) || {}), [id]: item } };
    lsSet(cacheKey(date), JSON.stringify(nd));
    return nd;
  });
  const onToggle = async (id, done) => {
    const prev = data?.checks?.[id];
    updateCheck(id, { ...(prev || {}), done });
    setBusyId(id); setErr("");
    try { updateCheck(id, await post({ id, done })); }
    catch (e) { updateCheck(id, prev || {}); setErr(`저장 실패: ${e.message}`); }
    setBusyId(null);
  };
  const onNote = async (id, note) => {
    setBusyId(id); setErr("");
    try { updateCheck(id, await post({ id, note })); }
    catch (e) { setErr(`메모 저장 실패: ${e.message}`); }
    setBusyId(null);
  };

  if (!configured || showSettings) {
    return <div style={{ flex: 1, overflowY: "auto", padding: 16, background: P.bg }}>
      <Settings onSaved={() => { setConfigured(true); setShowSettings(false); }} />
    </div>;
  }

  const plan = data?.plan;
  const checks = data?.checks || {};
  const blocks = { ...DEFAULT_BLOCKS, ...(plan?.blocks || {}) };
  const tasks = plan?.tasks || [];
  const am = tasks.filter(t => t.block !== "pm");
  const pm = tasks.filter(t => t.block === "pm");
  const doneCount = tasks.filter(t => checks[t.id]?.done).length;
  const isToday = date === kstDate(0);

  return (
    <div style={{ flex: 1, overflowY: "auto", background: P.bg }}>
      <div style={{ padding: "14px 16px 40px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: P.text }}>HANOK 오늘 업무</div>
          <div style={{ fontSize: 12, color: P.textMuted }}>{date}{isToday ? "" : " (지난 날)"}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => setDate(isToday ? kstDate(-1) : kstDate(0))} style={chip}>{isToday ? "어제" : "오늘"}</button>
            <button onClick={() => load(date)} style={chip}>{loading ? "…" : "새로고침"}</button>
            <button onClick={() => setShowSettings(true)} style={chip}>설정</button>
          </div>
        </div>

        {plan?.headline && (
          <div style={{ background: P.goldDim, border: `1px solid ${P.gold}55`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: P.text, lineHeight: 1.55 }}>
            {plan.headline}
            {plan.report_url && <> · <a href={plan.report_url} target="_blank" rel="noreferrer" style={{ color: P.blue }}>아침 보고 전문</a></>}
          </div>
        )}

        {err && <div style={{ fontSize: 12.5, color: P.red }}>⚠ {err}</div>}

        {!plan && !loading && (
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 16, fontSize: 13, color: P.textMuted, lineHeight: 1.6 }}>
            {isToday ? "오늘 일정이 아직 없어요. 비서실장 보고(06:50) 뒤에 새로고침해 주세요." : "이 날짜의 일정이 없어요."}
          </div>
        )}

        {plan && <>
          <div style={{ fontSize: 12, color: P.textMuted }}>완료 {doneCount}/{tasks.length} · 체크와 메모는 내일 아침 비서실장 보고에 반영돼요.</div>
          <Block title="오전 블록" block={blocks.am} tasks={am} checks={checks} now={isToday ? now : -1} onToggle={onToggle} onNote={onNote} busyId={busyId} />
          <Block title="오후 블록" block={blocks.pm} tasks={pm} checks={checks} now={isToday ? now : -1} onToggle={onToggle} onNote={onNote} busyId={busyId} />
        </>}
      </div>
    </div>
  );
}

const chip = { background: P.surface, border: `1px solid ${P.border}`, borderRadius: 99, padding: "5px 11px", color: P.textMuted, fontSize: 12, fontFamily: "inherit", cursor: "pointer" };
