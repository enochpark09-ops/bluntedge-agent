import { useState, useRef, useEffect } from "react";
import CalendarTab from "./CalendarTab.jsx";
import PlannerTab from "./PlannerTab.jsx";
import BackupTab from "./BackupTab.jsx";

const C = {
  bg: "#1a1a18", surface: "#242422", surface2: "#2a2a27", border: "#3a3a36",
  gold: "#C4A86C", goldDim: "#c4a86c33", bronze: "#8B7355",
  text: "#e8e4dc", textMuted: "#9a9690", textDim: "#6a6660",
  green: "#6dcc7a", greenDim: "#6dcc7a22", red: "#e07070", redDim: "#e0707022", blue: "#7aabcc",
};

// ── localStorage 헬퍼 ─────────────────────────────────────────
const ls = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const Ic = ({ n, s = 16 }) => {
  const d = {
    bot: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><circle cx="19" cy="7" r="2" fill="currentColor" stroke="none" opacity=".5"/></>,
    chart: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    mic: <><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>,
    micOff: <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></>,
    spin: <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>,
    cal: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/></>,
    back: <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    cloud: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d[n]}</svg>;
};

const BottomTab = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, padding:"9px 0 7px", background:"transparent", border:"none", color:active?C.gold:C.textDim, cursor:"pointer", fontSize:9, fontFamily:"inherit", fontWeight:active?700:400, borderTop:`2px solid ${active?C.gold:"transparent"}`, transition:"all .2s" }}>
    {icon}{label}
  </button>
);

// ── 체크리스트 헬퍼 ──────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const FIXED_ITEMS = [
  { id:"qt",      emoji:"✝️", label:"QT" },
  { id:"prayer",  emoji:"🙏", label:"기도 30분" },
  { id:"workout", emoji:"🏃", label:"새벽운동" },
  { id:"politics",emoji:"🎙️", label:"정치 BluntEdge 콘텐츠" },
    { id:"novel",   emoji:"📖", label:"『패수』 다듬기" },
  { id:"music",   emoji:"🎵", label:"음원 만들기" },
];
const loadCL = () => {
  const d = todayStr();
  return ls.get(`cl_v2_${d}`, { fixed: {}, planner: {} });
};
const saveCL = (d, data) => ls.set(`cl_v2_${d}`, data);

const getPlannerData = () => {
  const d = todayStr();
  const top3 = ls.get(`planner_top3_${d}`, []);
  const ptodos = ls.get(`planner_todos_${d}`, []);
  return [
    ...top3.filter(t => t).map((t, i) => ({ id: `p_top_${i}`, emoji: "📌", label: t })),
    ...ptodos.filter(t => t.text).map((t, i) => ({ id: `p_todo_${i}`, emoji: "✅", label: t.text })),
  ];
};
const saveTodoToPlanner = (text) => {
  const d = todayStr();
  const existing = ls.get(`planner_todos_${d}`, []);
  if (!existing.find(t => t.text === text))
    ls.set(`planner_todos_${d}`, [...existing, { text, done: false, stars: 0 }]);
};
const syncDoneToPlanner = (text, done) => {
  const d = todayStr();
  const existing = ls.get(`planner_todos_${d}`, []);
  ls.set(`planner_todos_${d}`, existing.map(t => t.text === text ? { ...t, done } : t));
};

// ════ 메인 앱 (v6.0: 개인 루틴 전용 — 사업 탭·AI 호출 제거) ════
export default function App() {
  const [tab, setTab] = useState("planner");
  const [gcalEvents, setGcalEvents] = useState([]);
  const [gcalToken, setGcalToken] = useState(() => {
    return sessionStorage.getItem("gtoken") || null;
  });
  const handleTokenChange = (t) => {
    setGcalToken(t);
    if (t) sessionStorage.setItem("gtoken", t);
    else sessionStorage.removeItem("gtoken");
  };
  const [todos, setTodos] = useState([]);

  const tabs = [
    { id:"planner",   icon:<Ic n="pdf" s={18}/>, label:"플래너" },
    { id:"calendar",  icon:<Ic n="cal" s={18}/>, label:"캘린더" },
    { id:"backup",    icon:<Ic n="cloud" s={18}/>, label:"백업" },
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100dvh",background:C.bg,fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",color:C.text,overflow:"hidden" }}>
      <div style={{ background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,paddingTop:"calc(10px + env(safe-area-inset-top,0px))" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <svg width="36" height="22" viewBox="0 0 120 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 40 C15 25, 25 25, 35 35 C45 45, 50 45, 55 35 C60 25, 65 25, 75 35 C85 45, 90 45, 95 35 C100 25, 110 25, 115 40" stroke="#6B1D2A" strokeWidth="6" strokeLinecap="round" fill="none"/>
            <path d="M5 50 C15 35, 30 30, 40 40 C50 50, 55 48, 60 38 C65 28, 70 28, 80 38 C90 48, 95 48, 105 38 C110 30, 115 35, 115 45" stroke="#8B3040" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7"/>
            <path d="M20 45 C30 30, 40 32, 50 42 C55 47, 60 45, 65 38 C70 31, 80 30, 90 40 C95 45, 100 42, 108 35" stroke="#A04050" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.5"/>
          </svg>
          <div>
            <div style={{ fontSize:14,fontWeight:800,color:"#6B1D2A",letterSpacing:2,lineHeight:1 }}>HANOK</div>
            <div style={{ fontSize:7,color:C.textDim,letterSpacing:1.5 }}>DAILY ROUTINE</div>
          </div>
        </div>
        <div style={{ fontSize:10,color:C.textDim,textAlign:"right" }}>
          {new Date().toLocaleDateString("ko-KR",{month:"short",day:"numeric",weekday:"short"})}
          <br/><span style={{ color:C.green,fontSize:9 }}>● 온라인</span>
        </div>
      </div>
      <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column" }}>
        {tab==="calendar"  && <CalendarTab onEventsLoaded={setGcalEvents} externalToken={gcalToken} onTokenChange={handleTokenChange}/>}
        {tab==="planner"   && <PlannerTab gcalEvents={gcalEvents}/>}
        {tab==="backup"    && <BackupTab gcalToken={gcalToken}/>}
      </div>
      <div style={{ background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
        {tabs.map(t => <BottomTab key={t.id} active={tab===t.id} onClick={()=>setTab(t.id)} icon={t.icon} label={t.label}/>)}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#3a3a36;border-radius:2px}input[type=date],input[type=time]{color-scheme:dark}`}</style>
    </div>
  );
}
