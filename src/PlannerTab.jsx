import { useState, useEffect, useRef } from "react";
import HanokToday from "./HanokToday.jsx";

// ── 색상 (플래너 원본 스타일) ─────────────────────────────────
const P = {
  bg: "#1a1a18", surface: "#242422", surface2: "#2e2c28",
  border: "#3a3a36", borderLight: "#4a4a44",
  gold: "#C4A86C", goldDim: "#c4a86c22", goldMid: "#c4a86c55",
  bronze: "#8B7355", text: "#e8e4dc", textMuted: "#9a9690", textDim: "#6a6660",
  green: "#6dcc7a", red: "#e07070", blue: "#7aabcc",
  sun: "#e07070", sat: "#7aabcc", green: "#6dcc7a", greenDim: "#6dcc7a22",
};

// 주차 계산 유틸
const getWeekDates = (weekStart) => {
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
};

// 로컬 날짜 (사용 안 됨 - dateToStr 사용)
// const todayKST = () => dateToStr(new Date());

const getWeekStart = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // 일요일 기준
  d.setHours(0,0,0,0);
  return d;
};

const formatDate = (d) => `${d.getMonth()+1}/${d.getDate()}`;
const formatFull = (d) => d.toLocaleDateString("ko-KR", {month:"long", day:"numeric", weekday:"long"});
const getWeekNumber = (d) => {
  const start = new Date("2026-03-29"); // 플래너 시작일 (Week 1)
  const diff = Math.floor((d - start) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
};

const DAY_LABELS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const DAY_KO = ["일","월","화","수","목","금","토"];

const TIME_BLOCKS = [
  { time: "05–06", label: "Workout", sub: "운동" },
  { time: "06–08", label: "Dawn Work", sub: "새벽 작업·집중" },
  { time: "08–09", label: "Kids School", sub: "등교" },
  { time: "09–15", label: "Day Work", sub: "주간 작업" },
  { time: "15–19", label: "Kids Care", sub: "돌봄" },
  { time: "19–21", label: "Night Work", sub: "야간 작업" },
  { time: "21–", label: "Family · Rest", sub: "가족·취침" },
];

// ── 날짜 헬퍼 (로컬 시간 기준) ───────────────────────────────
// toISOString()은 UTC → 한국 밤 9시 이후 날짜가 달라짐 → 로컬 기준 사용
const dateToStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ── 로컬 스토리지 헬퍼 ───────────────────────────────────────
const storageKey = (type, dateStr) => `planner_${type}_${dateStr}`;
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
const load = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };

// ── 아이콘 ──────────────────────────────────────────────────
const Ic = ({ n, s = 16 }) => {
  const d = {
    back: <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    chevL: <polyline points="15 18 9 12 15 6"/>,
    chevR: <polyline points="9 18 15 12 9 6"/>,
    check: <polyline points="20 6 9 17 4 12"/>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></>,
    cal: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    spin: <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d[n]}</svg>;
};

// ══════════════════════════════════════════════════════════════
// 일별 상세 페이지
// ══════════════════════════════════════════════════════════════
const DayPage = ({ date, onBack, gcalEvents }) => {
  const dateStr = dateToStr(date); // 로컬 날짜 기준 (UTC 아님)
  const weekday = date.getDay();
  const isWeekend = weekday === 0 || weekday === 6;

  const [top3, setTop3] = useState(() => load(storageKey("top3", dateStr), ["","",""]));
  const [todos, setTodos] = useState(() => {
    const saved = load(storageKey("todos", dateStr), []);
    // 이전 버전 빈 항목({text:"",done:false,stars:0}) 필터링
    return Array.isArray(saved) ? saved.filter(t => t && t.text !== undefined) : [];
  });
  // 할일탭에서 추가되면 실시간 반영
  useEffect(() => {
    const sync = () => {
      const fresh = load(storageKey("todos", dateStr), []);
      setTodos(fresh);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [dateStr]);
  const [blocks, setBlocks] = useState(() => load(storageKey("blocks", dateStr), TIME_BLOCKS.map(b => ({...b, note:"", stars:0}))));
  const [notes, setNotes] = useState(() => load(storageKey("notes", dateStr), ""));
  const [reflection, setReflection] = useState(() => load(storageKey("reflection", dateStr), ""));
  // QT 상태
  const [qt, setQt] = useState(() => load(storageKey("qt", dateStr), { verse:"", verseText:"", apply:"", prayer:"" }));
  const [qtAiLoading, setQtAiLoading] = useState(false);
  const [qtAiResult, setQtAiResult] = useState(() => load(storageKey("qt_ai", dateStr), ""));

  useEffect(() => { save(storageKey("top3", dateStr), top3); }, [top3]);
  useEffect(() => { save(storageKey("todos", dateStr), todos); }, [todos]);
  useEffect(() => { save(storageKey("blocks", dateStr), blocks); }, [blocks]);
  useEffect(() => { save(storageKey("notes", dateStr), notes); }, [notes]);
  useEffect(() => { save(storageKey("reflection", dateStr), reflection); }, [reflection]);
  useEffect(() => { save(storageKey("qt", dateStr), qt); }, [qt]);
  useEffect(() => { save(storageKey("qt_ai", dateStr), qtAiResult); }, [qtAiResult]);

  // QT AI 묵상 도움
  const getQtAi = async () => {
    if (!qt.verse && !qt.verseText) return;
    setQtAiLoading(true);
    setQtAiResult("");
    try {
      const res = await fetch("/api/qt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verse: qt.verse || "", verseText: qt.verseText || "" })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setQtAiResult(data.text || "");
    } catch(e) { setQtAiResult(`⚠️ 오류: ${e.message}
잠시 후 다시 시도해 주세요.`); }
    setQtAiLoading(false);
  };

  const Stars = ({ val, onChange }) => (
    <div style={{display:"flex", gap:2}}>
      {[1,2,3].map(i => (
        <button key={i} onClick={() => onChange(val===i?0:i)} style={{background:"none",border:"none",cursor:"pointer",padding:1,color:i<=val?P.gold:P.borderLight}}>
          <Ic n="star" s={11}/>
        </button>
      ))}
    </div>
  );

  // 구글 캘린더 이벤트 해당 날짜 필터
  const dayEvents = gcalEvents.filter(e => (e.start?.date || e.start?.dateTime?.substring(0,10)) === dateStr);

  const dayColor = weekday===0 ? P.sun : weekday===6 ? P.sat : P.gold;

  return (
    <div style={{flex:1, overflowY:"auto", background:P.bg}}>
      {/* 헤더 */}
      <div style={{padding:"12px 16px", background:P.surface, borderBottom:`1px solid ${P.border}`, display:"flex", alignItems:"center", gap:10, position:"sticky", top:0, zIndex:10}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:P.textMuted,cursor:"pointer",padding:4,display:"flex"}}>
          <Ic n="back" s={20}/>
        </button>
        <div style={{flex:1}}>
          <div style={{fontSize:18, fontWeight:800, color:P.text, fontFamily:"Georgia, serif", letterSpacing:-0.5}}>
            {date.toLocaleDateString("en-US",{weekday:"short"})}, {date.toLocaleDateString("en-US",{month:"long", day:"numeric"})}
          </div>
          <div style={{fontSize:11, color:P.textDim}}>{date.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</div>
        </div>
        {dayEvents.length > 0 && (
          <div style={{background:P.goldDim, border:`1px solid ${P.goldMid}`, borderRadius:6, padding:"4px 8px", fontSize:10, color:P.gold}}>
            📅 {dayEvents.length}개 일정
          </div>
        )}
      </div>

      <div style={{padding:16, display:"flex", flexDirection:"column", gap:16}}>

        {/* ✝️ QT 섹션 — 최상단 */}
        <div style={{background:"linear-gradient(135deg, #1e1e1c, #242420)", borderRadius:14, padding:16, border:`1px solid ${P.goldMid}`, boxShadow:`0 0 20px ${P.goldDim}`}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${P.border}`}}>
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <span style={{fontSize:16}}>✝️</span>
              <div>
                <div style={{fontSize:11, color:P.gold, fontWeight:700, letterSpacing:1.5}}>Q.T.</div>
                <div style={{fontSize:9, color:P.textDim}}>경건의 시간</div>
              </div>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              {/* 매일성경 링크 */}
              <a href="https://sum.su.or.kr:8888/bible/today" target="_blank" rel="noopener noreferrer"
                style={{display:"flex", alignItems:"center", gap:5, textDecoration:"none",
                  background:"linear-gradient(135deg, #1a3a1a, #2a5a2a)",
                  border:`1px solid #4a8a4a`,
                  borderRadius:8, padding:"5px 10px",
                  boxShadow:"0 2px 8px rgba(74,138,74,0.3)",
                  transition:"opacity .15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity=".8"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                {/* 매일성경 아이콘 (십자가 + 책) */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  {/* 책 배경 */}
                  <rect x="2" y="4" width="20" height="16" rx="2" fill="#2a7a2a" stroke="#6aba6a" strokeWidth="1.2"/>
                  <line x1="12" y1="4" x2="12" y2="20" stroke="#6aba6a" strokeWidth="1"/>
                  {/* 십자가 */}
                  <line x1="7" y1="9" x2="7" y2="16" stroke="#ffd166" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="4.5" y1="11.5" x2="9.5" y2="11.5" stroke="#ffd166" strokeWidth="1.8" strokeLinecap="round"/>
                  {/* 오른쪽 텍스트 라인 */}
                  <line x1="14" y1="9" x2="20" y2="9" stroke="#9acea0" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="14" y1="12" x2="20" y2="12" stroke="#9acea0" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="14" y1="15" x2="18" y2="15" stroke="#9acea0" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <div>
                  <div style={{fontSize:9, fontWeight:700, color:"#6aba6a", letterSpacing:0.5, lineHeight:1}}>매일성경</div>
                  <div style={{fontSize:8, color:"#4a8a4a", lineHeight:1, marginTop:1}}>오늘 본문 →</div>
                </div>
              </a>
              <div style={{fontSize:10, color:P.textDim}}>{date.toLocaleDateString("ko-KR",{month:"short",day:"numeric",weekday:"short"})}</div>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1, marginBottom:8}}>📖 오늘의 말씀</div>
            <input value={qt.verse} onChange={e => setQt({...qt, verse:e.target.value})} placeholder="말씀 구절 (예: 빌 4:13)" style={{width:"100%", background:P.bg, border:`1px solid ${P.border}`, borderRadius:8, color:P.gold, fontSize:14, fontWeight:600, outline:"none", fontFamily:"Georgia, serif", padding:"9px 12px", marginBottom:8, boxSizing:"border-box"}}/>
            <textarea value={qt.verseText} onChange={e => setQt({...qt, verseText:e.target.value})} placeholder="말씀 본문을 입력하세요..." rows={3} style={{width:"100%", background:P.bg, border:`1px solid ${P.border}`, borderRadius:8, color:P.text, fontSize:13, outline:"none", fontFamily:"Georgia, serif", padding:"9px 12px", resize:"none", lineHeight:1.8, boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1, marginBottom:8}}>💡 오늘의 적용</div>
            <textarea value={qt.apply} onChange={e => setQt({...qt, apply:e.target.value})} placeholder="이 말씀을 오늘 어떻게 적용할까요?" rows={3} style={{width:"100%", background:P.bg, border:`1px solid ${P.border}`, borderRadius:8, color:P.text, fontSize:13, outline:"none", fontFamily:"inherit", padding:"9px 12px", resize:"none", lineHeight:1.8, boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
              <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1}}>🤖 AI 묵상 도움</div>
              <button onClick={getQtAi} disabled={qtAiLoading||(!qt.verse&&!qt.verseText)} style={{background:qt.verse||qt.verseText?`linear-gradient(135deg,${P.bronze},${P.gold})`:P.border, border:"none", borderRadius:7, padding:"5px 12px", color:qt.verse||qt.verseText?"#1a1a18":P.textDim, fontSize:11, fontWeight:700, cursor:qt.verse||qt.verseText?"pointer":"not-allowed", fontFamily:"inherit"}}>
                {qtAiLoading?"묵상 중...":"묵상 질문 받기 →"}
              </button>
            </div>
            {qtAiResult
              ? <div style={{background:P.bg, borderRadius:8, padding:12, border:`1px solid ${P.border}`, fontSize:13, color:P.text, lineHeight:1.8, whiteSpace:"pre-wrap"}}>{qtAiResult}</div>
              : <div style={{background:P.bg, borderRadius:8, padding:12, border:`1px dashed ${P.border}`, fontSize:12, color:P.textDim, textAlign:"center"}}>말씀을 입력하면 AI가 묵상 질문을 드려요</div>
            }
          </div>
          <div>
            <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1, marginBottom:8}}>🙏 기도 제목</div>
            <textarea value={qt.prayer} onChange={e => setQt({...qt, prayer:e.target.value})} placeholder="오늘의 기도 제목을 적어보세요..." rows={3} style={{width:"100%", background:P.bg, border:`1px solid ${P.border}`, borderRadius:8, color:P.text, fontSize:13, outline:"none", fontFamily:"inherit", padding:"9px 12px", resize:"none", lineHeight:1.8, boxSizing:"border-box"}}/>
          </div>
        </div>

        {/* 구글 캘린더 일정 */}
        {dayEvents.length > 0 && (
          <div style={{background:P.surface, borderRadius:12, padding:14, border:`1px solid ${P.goldMid}`}}>
            <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1.2, marginBottom:10}}>GOOGLE CALENDAR</div>
            {dayEvents.map((ev,i) => (
              <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:i<dayEvents.length-1?`1px solid ${P.border}`:"none"}}>
                <div style={{width:4, height:28, borderRadius:2, background:P.gold, flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13, color:P.text}}>{ev.summary}</div>
                  <div style={{fontSize:10, color:P.textDim}}>{ev.start?.dateTime?new Date(ev.start.dateTime).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}):"종일"}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TIME BLOCK */}
        <div style={{background:P.surface, borderRadius:12, padding:16, border:`1px solid ${P.border}`}}>
          <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1.2, marginBottom:14, paddingBottom:8, borderBottom:`1px solid ${P.border}`}}>TIME BLOCK</div>
          {blocks.map((b, i) => (
            <div key={i} style={{display:"flex", alignItems:"flex-start", gap:12, padding:"10px 0", borderBottom:i<blocks.length-1?`1px solid ${P.border}`:"none"}}>
              <div style={{width:44, flexShrink:0}}>
                <div style={{fontSize:11, color:P.gold, fontWeight:700}}>{b.time}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13, color:P.text, fontWeight:600}}>{b.label}</div>
                <div style={{fontSize:10, color:P.textDim, marginBottom:4}}>{b.sub}</div>
                <input
                  value={b.note}
                  onChange={e => { const nb=[...blocks]; nb[i]={...nb[i],note:e.target.value}; setBlocks(nb); }}
                  placeholder="메모..."
                  style={{width:"100%", background:"transparent", border:"none", borderBottom:`1px solid ${P.border}`, color:P.textMuted, fontSize:12, outline:"none", fontFamily:"inherit", padding:"3px 0"}}
                />
              </div>
              <Stars val={b.stars} onChange={v => { const nb=[...blocks]; nb[i]={...nb[i],stars:v}; setBlocks(nb); }}/>
            </div>
          ))}
        </div>

        {/* TOP 3 PRIORITY */}
        <div style={{background:P.surface, borderRadius:12, padding:16, border:`1px solid ${P.border}`}}>
          <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1.2, marginBottom:14, paddingBottom:8, borderBottom:`1px solid ${P.border}`}}>TOP 3 PRIORITY</div>
          {top3.map((t, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<2?`1px solid ${P.border}`:"none"}}>
              <div style={{fontSize:13, color:P.gold, fontWeight:700, width:16}}>{i+1}.</div>
              <input
                value={t}
                onChange={e => { const n=[...top3]; n[i]=e.target.value; setTop3(n); }}
                placeholder={`우선순위 ${i+1}`}
                style={{flex:1, background:"transparent", border:"none", borderBottom:`1px solid ${P.border}`, color:P.text, fontSize:14, outline:"none", fontFamily:"inherit", padding:"4px 0"}}
              />
              <div style={{width:22, height:22, borderRadius:4, border:`1.5px solid ${t?P.gold:P.border}`, background:t?P.goldDim:"transparent", flexShrink:0}}/>
            </div>
          ))}
        </div>

        {/* TO-DO */}
        <div style={{background:P.surface, borderRadius:12, padding:16, border:`1px solid ${P.border}`}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, paddingBottom:8, borderBottom:`1px solid ${P.border}`}}>
            <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1.2}}>TO-DO</div>
            <button
              onClick={() => {
                const n = [...todos, {text:"", done:false, stars:0}];
                setTodos(n);
              }}
              style={{background:P.goldDim, border:`1px solid ${P.goldMid}`, borderRadius:6, padding:"3px 9px", color:P.gold, cursor:"pointer", fontSize:11, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4}}>
              <Ic n="plus" s={11}/> 추가
            </button>
          </div>
          {todos.length === 0 && (
            <div style={{fontSize:12, color:P.textDim, textAlign:"center", padding:"10px 0"}}>
              + 추가 버튼으로 할일을 입력하세요
            </div>
          )}
          {todos.map((t, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:i<todos.length-1?`1px solid ${P.border}`:"none"}}>
              <Stars val={t.stars} onChange={v => { const n=[...todos]; n[i]={...n[i],stars:v}; setTodos(n); }}/>
              <input
                value={t.text}
                onChange={e => { const n=[...todos]; n[i]={...n[i],text:e.target.value}; setTodos(n); }}
                placeholder="할일 입력..."
                style={{flex:1, background:"transparent", border:"none", borderBottom:`1px solid ${P.border}`, color:t.done?P.textDim:P.text, fontSize:13, outline:"none", fontFamily:"inherit", padding:"3px 0", textDecoration:t.done?"line-through":"none"}}
              />
              <button onClick={() => { const n=[...todos]; n[i]={...n[i],done:!n[i].done}; setTodos(n); }}
                style={{width:20, height:20, borderRadius:3, border:`1.5px solid ${t.done?P.gold:P.border}`, background:t.done?P.gold:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#1a1a18"}}>
                {t.done && <Ic n="check" s={11}/>}
              </button>
              <button onClick={() => { const n=todos.filter((_,j)=>j!==i); setTodos(n); }}
                style={{background:"none", border:"none", color:P.textDim, cursor:"pointer", padding:2, display:"flex", flexShrink:0}}>
                <Ic n="x" s={13}/>
              </button>
            </div>
          ))}
        </div>

        {/* NOTES */}
        <div style={{background:P.surface, borderRadius:12, padding:16, border:`1px solid ${P.border}`}}>
          <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1.2, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${P.border}`}}>NOTES</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="메모를 입력하세요..."
            rows={4}
            style={{width:"100%", background:"transparent", border:"none", color:P.text, fontSize:13, outline:"none", fontFamily:"inherit", resize:"none", lineHeight:1.8}}
          />
        </div>

        {/* REFLECTION */}
        <div style={{background:P.surface, borderRadius:12, padding:16, border:`1px solid ${P.border}`, borderLeft:`4px solid ${P.gold}`, marginBottom:20}}>
          <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1.2, marginBottom:4}}>REFLECTION</div>
          <div style={{fontSize:11, color:P.textDim, marginBottom:10}}>오늘의 작은 승리 / 내일의 ONE THING</div>
          <textarea
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="오늘의 회고를 입력하세요..."
            rows={3}
            style={{width:"100%", background:"transparent", border:"none", color:P.text, fontSize:13, outline:"none", fontFamily:"inherit", resize:"none", lineHeight:1.8}}
          />
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 주간 플래너 페이지
// ══════════════════════════════════════════════════════════════
const WeekPage = ({ weekStart, onSelectDay, onPrevWeek, onNextWeek, gcalEvents }) => {
  const weekDates = getWeekDates(weekStart);
  const weekNum = getWeekNumber(weekStart);
  const dateStr = dateToStr(weekStart); // 로컬 날짜 기준
  const [top3, setTop3] = useState(() => load(storageKey("week_top3", dateStr), ["","",""]));
  useEffect(() => { save(storageKey("week_top3", dateStr), top3); }, [top3]);

  const today = new Date(); today.setHours(0,0,0,0);

  const getDayEvents = (date) => {
    const ds = dateToStr(date); // 로컬 날짜 기준
    return gcalEvents.filter(e => (e.start?.date || e.start?.dateTime?.substring(0,10)) === ds);
  };

  const monthLabel = weekStart.toLocaleDateString("en-US", {month:"long", year:"numeric"});

  return (
    <div style={{flex:1, overflowY:"auto", background:P.bg}}>
      {/* 헤더 */}
      <div style={{padding:"14px 16px", background:P.surface, borderBottom:`1px solid ${P.border}`, position:"sticky", top:0, zIndex:10}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4}}>
          <div style={{display:"flex", alignItems:"center", gap:6}}>
            <button onClick={onPrevWeek} style={{background:"none",border:"none",color:P.textMuted,cursor:"pointer",padding:4}}><Ic n="chevL" s={18}/></button>
            <div>
              <div style={{fontSize:22, fontWeight:800, color:P.text, fontFamily:"Georgia,serif", letterSpacing:-1}}>Week {weekNum}.</div>
              <div style={{fontSize:11, color:P.textDim}}>{formatDate(weekDates[0])} ({weekStart.getFullYear()}) – {formatDate(weekDates[6])} ({weekDates[6].getFullYear()})</div>
            </div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:6}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10, color:P.gold, fontWeight:700}}>WEEK {weekNum} of 53</div>
              <div style={{fontSize:10, color:P.textDim}}>{monthLabel}</div>
            </div>
            <button onClick={onNextWeek} style={{background:"none",border:"none",color:P.textMuted,cursor:"pointer",padding:4}}><Ic n="chevR" s={18}/></button>
          </div>
        </div>
      </div>

      <div style={{padding:16, display:"flex", flexDirection:"column", gap:14}}>
        {/* THIS WEEK'S TOP 3 */}
        <div style={{background:P.surface, borderRadius:12, padding:16, border:`1px solid ${P.border}`}}>
          <div style={{fontSize:10, color:P.gold, fontWeight:700, letterSpacing:1.2, marginBottom:12, paddingBottom:8, borderBottom:`1px solid ${P.border}`}}>THIS WEEK'S TOP 3</div>
          {top3.map((t, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:i<2?`1px solid ${P.border}`:"none"}}>
              <div style={{fontSize:13, color:P.gold, fontWeight:700, width:16, flexShrink:0}}>{i+1}.</div>
              <input
                value={t}
                onChange={e => { const n=[...top3]; n[i]=e.target.value; setTop3(n); }}
                placeholder={`이번 주 목표 ${i+1}`}
                style={{flex:1, background:"transparent", border:"none", borderBottom:`1px solid ${P.border}`, color:P.text, fontSize:14, outline:"none", fontFamily:"inherit", padding:"3px 0"}}
              />
            </div>
          ))}
        </div>

        {/* 요일별 목록 — 클릭하면 해당 일로 이동 */}
        <div style={{background:P.surface, borderRadius:12, border:`1px solid ${P.border}`, overflow:"hidden"}}>
          {weekDates.map((date, i) => {
            const isToday = date.getTime() === today.getTime();
            const isSun = i === 0, isSat = i === 6;
            const dayEvs = getDayEvents(date);
            const dayKey = storageKey("top3", dateToStr(date)); // 로컬 날짜 기준
            const dayTop3 = load(dayKey, ["","",""]);
            const hasData = dayTop3.some(t => t.trim());

            return (
              <div key={i} onClick={() => onSelectDay(date)}
                style={{display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderBottom:i<6?`1px solid ${P.border}`:"none", cursor:"pointer", background:isToday?P.goldDim:"transparent", WebkitTapHighlightColor:"transparent", transition:"background .15s"}}>
                {/* 요일 */}
                <div style={{width:36, flexShrink:0}}>
                  <div style={{fontSize:11, fontWeight:700, color:isSun?P.sun:isSat?P.sat:P.gold, letterSpacing:0.5}}>{DAY_LABELS[i]}</div>
                  <div style={{fontSize:12, color:P.textDim}}>{formatDate(date)}</div>
                </div>

                {/* 구분선 */}
                <div style={{width:1, height:32, background:P.border, flexShrink:0}}/>

                {/* 내용 미리보기 */}
                <div style={{flex:1, minWidth:0}}>
                  {dayEvs.length > 0 && (
                    <div style={{display:"flex", gap:4, flexWrap:"wrap", marginBottom:3}}>
                      {dayEvs.slice(0,2).map((ev,ei) => (
                        <div key={ei} style={{fontSize:9, color:"#1a1a18", background:P.gold, borderRadius:3, padding:"1px 5px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:100}}>
                          {ev.summary}
                        </div>
                      ))}
                      {dayEvs.length > 2 && <div style={{fontSize:9, color:P.textDim}}>+{dayEvs.length-2}</div>}
                    </div>
                  )}
                  {hasData
                    ? <div style={{fontSize:12, color:P.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{dayTop3.filter(t=>t).join(" · ")}</div>
                    : <div style={{fontSize:12, color:P.textDim}}>탭하여 일정 입력</div>
                  }
                </div>

                {/* 오늘 표시 */}
                {isToday && <div style={{fontSize:9, color:P.gold, fontWeight:700, flexShrink:0, border:`1px solid ${P.gold}`, borderRadius:4, padding:"2px 5px"}}>TODAY</div>}

                {/* 화살표 */}
                <div style={{color:P.textDim, flexShrink:0}}><Ic n="chevR" s={14}/></div>
              </div>
            );
          })}
        </div>

        {/* 이번 주 통계 */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
          <div style={{background:P.surface, borderRadius:10, padding:14, border:`1px solid ${P.border}`, textAlign:"center"}}>
            <div style={{fontSize:22, fontWeight:800, color:P.gold}}>
              {weekDates.reduce((sum, d) => {
                const k = storageKey("todos", dateToStr(d));
                const todos = load(k, []);
                return sum + todos.filter(t => t.done && t.text).length;
              }, 0)}
            </div>
            <div style={{fontSize:10, color:P.textDim, marginTop:2}}>완료한 할일</div>
          </div>
          <div style={{background:P.surface, borderRadius:10, padding:14, border:`1px solid ${P.border}`, textAlign:"center"}}>
            <div style={{fontSize:22, fontWeight:800, color:P.blue}}>
              {weekDates.reduce((sum, d) => sum + getDayEvents(d).length, 0)}
            </div>
            <div style={{fontSize:10, color:P.textDim, marginTop:2}}>구글 캘린더 일정</div>
          </div>
        </div>

        {/* 구글 캘린더 연동 안내 */}
        {gcalEvents.length === 0 ? (
          <div style={{background:P.surface, borderRadius:10, padding:12, border:`1px dashed ${P.border}`, display:"flex", alignItems:"center", gap:8}}>
            <Ic n="cal" s={14}/>
            <div style={{fontSize:11, color:P.textDim, lineHeight:1.6}}>
              구글 캘린더 일정을 표시하려면<br/>
              <span style={{color:P.gold}}>캘린더 탭</span>에서 구글 로그인 후 플래너로 돌아오세요
            </div>
          </div>
        ) : (
          <div style={{background:P.greenDim||"#6dcc7a11", borderRadius:10, padding:10, border:`1px solid ${P.green||"#6dcc7a"}33`, display:"flex", alignItems:"center", gap:8}}>
            <Ic n="cal" s={14}/>
            <div style={{fontSize:11, color:P.green||"#6dcc7a"}}>구글 캘린더 연동됨 · {gcalEvents.length}개 일정</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 메인 PlannerTab
// ══════════════════════════════════════════════════════════════
export default function PlannerTab({ gcalEvents = [], gcalToken }) {
  const [view, setView] = useState("hanok"); // "hanok" | "week" | "day" | "pdf"
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file || file.type !== "application/pdf") { alert("PDF 파일만 가능해요!"); return; }
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(file));
    setPdfName(file.name);
    setView("pdf");
  };

  const goToDay = (date) => { setSelectedDay(date); setView("day"); };
  const goToToday = () => { setWeekStart(getWeekStart(new Date())); setView("week"); };

  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:P.bg}}>
      {/* 상단 탭 */}
      {view !== "day" && view !== "pdf" && (
        <div style={{display:"flex", borderBottom:`1px solid ${P.border}`, background:P.surface, flexShrink:0}}>
          <button onClick={() => setView("hanok")} style={{flex:1, padding:"10px 0", background:"transparent", border:"none", borderBottom:`2px solid ${view==="hanok"?P.gold:"transparent"}`, color:view==="hanok"?P.gold:P.textMuted, fontSize:12, fontFamily:"inherit", cursor:"pointer", fontWeight:view==="hanok"?600:400}}>🏢 HANOK 업무</button>
          <button onClick={() => setView("week")} style={{flex:1, padding:"10px 0", background:"transparent", border:"none", borderBottom:`2px solid ${view==="week"?P.gold:"transparent"}`, color:view==="week"?P.gold:P.textMuted, fontSize:12, fontFamily:"inherit", cursor:"pointer", fontWeight:view==="week"?600:400}}>📋 주간 플래너</button>
          <button onClick={() => setView("pdf")} style={{flex:1, padding:"10px 0", background:"transparent", border:"none", borderBottom:`2px solid ${view==="pdf"?P.gold:"transparent"}`, color:view==="pdf"?P.gold:P.textMuted, fontSize:12, fontFamily:"inherit", cursor:"pointer", fontWeight:view==="pdf"?600:400}}>📄 원본 PDF</button>
          <button onClick={goToToday} style={{padding:"10px 14px", background:"transparent", border:"none", borderBottom:"2px solid transparent", color:P.textDim, fontSize:11, fontFamily:"inherit", cursor:"pointer"}}>TODAY</button>
        </div>
      )}

      {/* HANOK 업무 뷰 */}
      {view === "hanok" && <HanokToday />}

      {/* 주간 뷰 */}
      {view === "week" && (
        <WeekPage
          weekStart={weekStart}
          onSelectDay={goToDay}
          onPrevWeek={() => { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }}
          onNextWeek={() => { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }}
          gcalEvents={gcalEvents}
        />
      )}

      {/* 일별 뷰 */}
      {view === "day" && selectedDay && (
        <DayPage
          date={selectedDay}
          onBack={() => setView("week")}
          gcalEvents={gcalEvents}
        />
      )}

      {/* PDF 뷰 */}
      {view === "pdf" && (
        <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
          {!pdfUrl ? (
            <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:16}}>
              <div style={{fontSize:44}}>📓</div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:16, fontWeight:700, color:P.text, marginBottom:6}}>원본 플래너 PDF</div>
                <div style={{fontSize:12, color:P.textMuted, lineHeight:1.7}}>Double Y Space 플래너 PDF를<br/>업로드하면 바로 볼 수 있어요</div>
              </div>
              <div
                onDragOver={e=>{e.preventDefault();setDragging(true);}}
                onDragLeave={()=>setDragging(false)}
                onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
                onClick={()=>fileRef.current?.click()}
                style={{width:"100%", maxWidth:300, border:`2px dashed ${dragging?P.gold:P.border}`, borderRadius:14, padding:"28px 20px", textAlign:"center", cursor:"pointer", background:dragging?P.goldDim:P.surface}}>
                <div style={{fontSize:13, color:dragging?P.gold:P.textMuted}}>{dragging?"여기에 놓으세요!":"탭하여 PDF 업로드"}</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf" onChange={e=>handleFile(e.target.files[0])} style={{display:"none"}}/>
            </div>
          ) : (
            <>
              <div style={{padding:"10px 14px", background:P.surface, borderBottom:`1px solid ${P.border}`, display:"flex", alignItems:"center", gap:8, flexShrink:0}}>
                <div style={{flex:1, fontSize:12, color:P.textMuted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>📄 {pdfName}</div>
                <button onClick={()=>{URL.revokeObjectURL(pdfUrl);setPdfUrl(null);}} style={{background:P.redDim||"#e0707022", border:`1px solid #e0707044`, borderRadius:6, padding:"5px 10px", color:"#e07070", cursor:"pointer", fontSize:11, fontFamily:"inherit"}}>닫기</button>
              </div>
              <iframe src={pdfUrl} style={{flex:1, border:"none", background:P.bg}} title="PDF Viewer"/>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
