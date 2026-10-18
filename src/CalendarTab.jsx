import { useState, useEffect } from "react";

const C = {
  bg: "#1a1a18", surface: "#242422", border: "#3a3a36",
  gold: "#C4A86C", goldDim: "#c4a86c33", bronze: "#8B7355",
  text: "#e8e4dc", textMuted: "#9a9690", textDim: "#6a6660",
  green: "#6dcc7a", red: "#e07070", redDim: "#e0707022", blue: "#7aabcc",
};

const gcal = {
  async getEvents(token) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Calendar API Error");
    return (await res.json()).items || [];
  },
  async addEvent(token, event) {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(event) }
    );
    return res.json();
  },
  async deleteEvent(token, id) {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
  },
};

const Ic = ({ n, s = 16 }) => {
  const d = {
    chevL: <polyline points="15 18 9 12 15 6"/>,
    chevR: <polyline points="9 18 15 12 9 6"/>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></>,
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    spin: <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d[n]}</svg>;
};

// ── Google Identity Services 팝업 로그인 ──────────────────────
const loadGoogleScript = () => new Promise((resolve) => {
  if (window.google?.accounts?.oauth2) { resolve(); return; }
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.onload = resolve;
  document.head.appendChild(script);
});

export default function CalendarTab({ onEventsLoaded, externalToken, onTokenChange }) {
  const [token, setToken] = useState(() => {
    // 2번 수정: 앱 재시작 시 sessionStorage에서 토큰 복원
    return externalToken || sessionStorage.getItem("gtoken") || null;
  });
  const [userEmail, setUserEmail] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", date: "", time: "", endTime: "" });
  const [error, setError] = useState("");

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const hasClientId = CLIENT_ID && CLIENT_ID.length > 10;

  // 저장된 토큰 불러오기
  useEffect(() => {
    const saved = sessionStorage.getItem("gtoken");
    const email = sessionStorage.getItem("gemail");
    if (saved) {
      setToken(saved);
      if (email) setUserEmail(email);
      if (onTokenChange) onTokenChange(saved);  // ← 앱 시작 시에도 전달
    }
  }, []);

  useEffect(() => { if (token) loadEvents(); }, [token]);

  // Google 팝업 로그인
  const signIn = async () => {
    if (!hasClientId) { setError("VITE_GOOGLE_CLIENT_ID 환경변수를 설정해주세요."); return; }
    setError("");
    try {
      await loadGoogleScript();
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email",
        callback: async (response) => {
          if (response.error) { setError("로그인 실패: " + response.error); return; }
          const t = response.access_token;
          // 이메일 가져오기
          try {
            const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${t}` } });
            const info = await r.json();
            setUserEmail(info.email || "");
            sessionStorage.setItem("gemail", info.email || "");
          } catch {}
          setToken(t);
          sessionStorage.setItem("gtoken", t);
          if (onTokenChange) onTokenChange(t);  // ← App으로 토큰 전달
        },
      });
      client.requestAccessToken({ prompt: "select_account" });
    } catch (e) {
      setError("Google 로그인 초기화 실패: " + e.message);
    }
  };

  const signOut = () => {
    setToken(null); setEvents([]); setUserEmail("");
    sessionStorage.removeItem("gtoken"); sessionStorage.removeItem("gemail");
    if (onTokenChange) onTokenChange(null);
    if (window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
  };

  const loadEvents = async () => {
    setLoading(true); setError("");
    try { const evs = await gcal.getEvents(token); setEvents(evs); if (onEventsLoaded) onEventsLoaded(evs); }
    catch { setError("일정 로드 실패. 다시 로그인해주세요."); signOut(); }
    setLoading(false);
  };

  // 달력 계산
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const getDayEvents = (day) => {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return events.filter(e => (e.start?.date || e.start?.dateTime?.substring(0,10)) === ds);
  };

  const addEvent = async () => {
    if (!newEvent.title || !newEvent.date) return;
    setLoading(true);
    try {
      const ev = newEvent.time
        ? { summary: newEvent.title, start: { dateTime: `${newEvent.date}T${newEvent.time}:00`, timeZone: "Asia/Seoul" }, end: { dateTime: `${newEvent.date}T${newEvent.endTime || newEvent.time}:00`, timeZone: "Asia/Seoul" } }
        : { summary: newEvent.title, start: { date: newEvent.date }, end: { date: newEvent.date } };
      await gcal.addEvent(token, ev);
      await loadEvents();
      setShowForm(false);
      setNewEvent({ title: "", date: "", time: "", endTime: "" });
    } catch { setError("일정 추가 실패"); }
    setLoading(false);
  };

  const deleteEvent = async (id) => {
    if (!confirm("삭제할까요?")) return;
    setLoading(true);
    try { await gcal.deleteEvent(token, id); await loadEvents(); }
    catch { setError("삭제 실패"); }
    setLoading(false);
  };

  // ── 로그인 전 화면 ──────────────────────────────────────────
  if (!token) return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:20 }}>
      <div style={{ fontSize:52 }}>📅</div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:8 }}>구글 캘린더 연동</div>
        <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.7 }}>Google 계정으로 로그인하면<br/>실제 일정을 읽고 쓸 수 있어요</div>
      </div>

      {error && (
        <div style={{ fontSize:12, color:C.red, background:C.redDim, padding:"12px 16px", borderRadius:10, textAlign:"center", width:"100%", maxWidth:320, lineHeight:1.6 }}>
          {error}
        </div>
      )}

      {!hasClientId ? (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:18, width:"100%", maxWidth:320 }}>
          <div style={{ fontSize:12, color:C.gold, fontWeight:700, marginBottom:10 }}>⚙️ 설정 필요</div>
          <div style={{ fontSize:12, color:C.textMuted, lineHeight:1.8 }}>
            Vercel 환경변수에 추가:<br/>
            <code style={{ color:C.gold, background:C.bg, padding:"2px 6px", borderRadius:4, fontSize:11 }}>VITE_GOOGLE_CLIENT_ID</code>
          </div>
        </div>
      ) : (
        <button onClick={signIn} style={{
          display:"flex", alignItems:"center", gap:12, padding:"14px 28px",
          background:"#fff", border:"none", borderRadius:12, cursor:"pointer",
          fontSize:15, fontWeight:600, color:"#1a1a18", fontFamily:"inherit",
          boxShadow:"0 2px 12px rgba(0,0,0,.4)", width:"100%", maxWidth:280, justifyContent:"center",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google로 로그인
        </button>
      )}

      <div style={{ fontSize:11, color:C.textDim, textAlign:"center", maxWidth:280, lineHeight:1.6 }}>
        로그인하면 Google 캘린더의 일정을<br/>읽고 추가할 수 있어요
      </div>
    </div>
  );

  const selEvents = selectedDay ? getDayEvents(selectedDay) : [];

  // ── 로그인 후 캘린더 화면 ───────────────────────────────────
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* 헤더 */}
      <div style={{ padding:"10px 16px", background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={() => setCurrentDate(new Date(year, month-1, 1))} style={{ background:"none", border:"none", color:C.textMuted, cursor:"pointer", padding:4 }}><Ic n="chevL" s={18}/></button>
          <div style={{ fontSize:14, fontWeight:700, color:C.gold }}>{currentDate.toLocaleDateString("ko-KR",{year:"numeric",month:"long"})}</div>
          <button onClick={() => setCurrentDate(new Date(year, month+1, 1))} style={{ background:"none", border:"none", color:C.textMuted, cursor:"pointer", padding:4 }}><Ic n="chevR" s={18}/></button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {userEmail && <div style={{ fontSize:10, color:C.textDim }}>{userEmail}</div>}
          <button onClick={signOut} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 8px", color:C.textMuted, cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:11, fontFamily:"inherit" }}>
            <Ic n="logout" s={12}/> 로그아웃
          </button>
        </div>
      </div>

      {error && <div style={{ padding:"8px 14px", background:C.redDim, fontSize:12, color:C.red, flexShrink:0 }}>{error}</div>}

      {/* 요일 헤더 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", background:C.surface, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {["일","월","화","수","목","금","토"].map((d,i) => (
          <div key={d} style={{ textAlign:"center", padding:"7px 0", fontSize:11, color:i===0?C.red:i===6?C.blue:C.textDim, fontWeight:600 }}>{d}</div>
        ))}
      </div>

      {/* 달력 그리드 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", flex:1, overflow:"hidden" }}>
        {Array.from({length:firstDay}).map((_,i) => <div key={`e${i}`} style={{ borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}/>)}
        {Array.from({length:daysInMonth}).map((_,i) => {
          const day = i+1;
          const isToday = day===today.getDate() && month===today.getMonth() && year===today.getFullYear();
          const isSel = day===selectedDay;
          const evs = getDayEvents(day);
          const col = (firstDay+i) % 7;
          return (
            <div key={day} onClick={() => setSelectedDay(isSel?null:day)}
              style={{ borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, padding:"3px 2px", cursor:"pointer", minHeight:42, background:isSel?C.goldDim:"transparent", WebkitTapHighlightColor:"transparent" }}>
              <div style={{ width:22, height:22, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background:isToday?C.gold:"transparent", color:isToday?"#1a1a18":col===0?C.red:col===6?C.blue:C.text, fontSize:11, fontWeight:isToday?700:400, margin:"0 auto 2px" }}>{day}</div>
              {evs.slice(0,2).map((ev,ei) => (
                <div key={ei} style={{ fontSize:8, color:"#1a1a18", background:C.gold, borderRadius:2, padding:"1px 3px", marginBottom:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{ev.summary}</div>
              ))}
              {evs.length > 2 && <div style={{ fontSize:8, color:C.textDim, paddingLeft:2 }}>+{evs.length-2}</div>}
            </div>
          );
        })}
      </div>

      {/* 선택된 날 이벤트 */}
      {selectedDay && (
        <div style={{ borderTop:`1px solid ${C.border}`, background:C.surface, maxHeight:190, overflowY:"auto", flexShrink:0 }}>
          <div style={{ padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:C.surface, zIndex:1 }}>
            <div style={{ fontSize:13, color:C.gold, fontWeight:700 }}>
              {month+1}월 {selectedDay}일 ({getDayEvents(selectedDay).length}개)
            </div>
            <button onClick={() => { setNewEvent({...newEvent, date:`${year}-${String(month+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}`}); setShowForm(true); }}
              style={{ background:C.goldDim, border:`1px solid ${C.gold}`, borderRadius:7, padding:"6px 12px", color:C.gold, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
              <Ic n="plus" s={12}/> 일정 추가
            </button>
          </div>
          {selEvents.length === 0
            ? <div style={{ padding:"0 14px 14px", fontSize:12, color:C.textDim }}>일정이 없어요</div>
            : selEvents.map(ev => (
              <div key={ev.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderTop:`1px solid ${C.border}` }}>
                <div style={{ width:4, height:36, borderRadius:2, background:C.gold, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{ev.summary}</div>
                  <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>
                    {ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) : "종일"}
                  </div>
                </div>
                <button onClick={() => deleteEvent(ev.id)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:4 }}>
                  <Ic n="trash" s={14}/>
                </button>
              </div>
            ))
          }
        </div>
      )}

      {/* 일정 추가 모달 */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"#000b", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ width:"100%", background:C.surface, borderRadius:"20px 20px 0 0", padding:20, paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))", maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:700, color:C.text }}>일정 추가</div>
              <button onClick={() => setShowForm(false)} style={{ background:"none", border:"none", color:C.textMuted, cursor:"pointer" }}><Ic n="close" s={22}/></button>
            </div>
            {[
              {label:"제목 *", key:"title", type:"text", placeholder:"일정 제목을 입력하세요"},
              {label:"날짜 *", key:"date", type:"date", placeholder:""},
              {label:"시작 시간 (선택)", key:"time", type:"time", placeholder:""},
              {label:"종료 시간 (선택)", key:"endTime", type:"time", placeholder:""},
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:C.textDim, marginBottom:5, fontWeight:500 }}>{f.label}</div>
                <input type={f.type} value={newEvent[f.key]} onChange={e => setNewEvent({...newEvent,[f.key]:e.target.value})}
                  placeholder={f.placeholder}
                  style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, color:C.text, padding:"12px 14px", fontSize:15, outline:"none", fontFamily:"inherit", colorScheme:"dark" }}
                />
              </div>
            ))}
            <button onClick={addEvent} disabled={!newEvent.title||!newEvent.date||loading}
              style={{ width:"100%", padding:"14px 0", background:newEvent.title&&newEvent.date?`linear-gradient(135deg,#8B7355,#C4A86C)`:"#3a3a36", border:"none", borderRadius:12, color:newEvent.title&&newEvent.date?"#1a1a18":"#6a6660", fontSize:15, fontWeight:700, cursor:newEvent.title&&newEvent.date?"pointer":"not-allowed", fontFamily:"inherit" }}>
              {loading ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </div>
      )}

      {/* 로딩 오버레이 */}
      {loading && (
        <div style={{ position:"fixed", inset:0, background:"#0006", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ animation:"spin 1s linear infinite", color:C.gold }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
