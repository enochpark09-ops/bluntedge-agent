import { useState, useEffect } from "react";

const C = {
  bg: "#1a1a18", surface: "#242422", border: "#3a3a36",
  gold: "#C4A86C", goldDim: "#c4a86c33", goldMid: "#c4a86c55",
  bronze: "#8B7355",
  text: "#e8e4dc", textMuted: "#9a9690", textDim: "#6a6660",
  green: "#6dcc7a", greenDim: "#6dcc7a22",
  red: "#e07070", redDim: "#e0707022",
  blue: "#7aabcc", blueDim: "#7aabcc22",
};

const ls = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── Google Drive API ──────────────────────────────────────────
const FOLDER_NAME = "DoubleY_Backup";
const FILE_NAME   = "doubley_data.json";
const SHEET_NAME  = "DoubleY 데이터 백업";

const drive = {
  async getOrCreateFolder(token) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { files } = await res.json();
    if (files?.length > 0) return files[0].id;
    const cr = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
    });
    return (await cr.json()).id;
  },
  async findFile(token, folderId, name) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${name}' and '${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { files } = await res.json();
    return files?.length > 0 ? files[0] : null;
  },
  async upload(token, folderId, fileId, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(fileId ? { name: FILE_NAME } : { name: FILE_NAME, parents: [folderId] })], { type: "application/json" }));
    form.append("file", blob);
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    return (await fetch(url, { method: fileId ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}` }, body: form })).json();
  },
  async download(token, fileId) {
    return (await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })).json();
  },
};

// ── Google Sheets API ─────────────────────────────────────────
const sheets = {
  // 스프레드시트 찾기 또는 생성
  async getOrCreate(token, folderId) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${SHEET_NAME}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { files } = await res.json();
    if (files?.length > 0) return files[0].id;
    // 새 스프레드시트 생성
    const cr = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: SHEET_NAME, mimeType: "application/vnd.google-apps.spreadsheet", parents: [folderId] }),
    });
    return (await cr.json()).id;
  },

  // 시트 목록 가져오기
  async getSheetsList(token, spreadsheetId) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.sheets?.map(s => ({ id: s.properties.sheetId, title: s.properties.title })) || [];
  },

  // 배치 업데이트 (시트 추가/이름 변경/데이터 쓰기)
  async batchUpdate(token, spreadsheetId, requests) {
    return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });
  },

  // 범위에 데이터 쓰기
  async writeRange(token, spreadsheetId, range, values) {
    return fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      }
    );
  },

  // 범위 지우기
  async clearRange(token, spreadsheetId, range) {
    return fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );
  },
};

// ── 데이터 수집 ───────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const getLast30Days = () => Array.from({ length: 30 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - i);
  return d.toISOString().split("T")[0];
});

const collectAllData = () => {
  const data = { version: 2, savedAt: new Date().toISOString(), items: {} };
  const days = getLast30Days();
  const KEYS = [
    "biz_v1",
    ...days.map(ds => [`cl_v2_${ds}`, `planner_top3_${ds}`, `planner_todos_${ds}`, `planner_qt_${ds}`, `planner_qt_ai_${ds}`, `planner_notes_${ds}`, `planner_reflection_${ds}`, `planner_blocks_${ds}`, `planner_week_top3_${ds}`]).flat(),
  ];
  KEYS.forEach(k => { const v = localStorage.getItem(k); if (v) data.items[k] = v; });
  return data;
};
const restoreAllData = (data) => {
  if (!data?.items) throw new Error("유효하지 않은 백업 파일입니다.");
  Object.entries(data.items).forEach(([k, v]) => localStorage.setItem(k, v));
  return Object.keys(data.items).length;
};

// ── 스프레드시트용 데이터 변환 ────────────────────────────────
const buildSheetData = () => {
  const days = getLast30Days().reverse(); // 오래된 날짜 → 최신 순

  // 시트1: 사업현황
  const bizData = ls.get("biz_v1", []);
  const bizRows = [
    ["사업명", "이모지", "진행률", "KPI1 라벨", "KPI1 값", "KPI2 라벨", "KPI2 값", "KPI3 라벨", "KPI3 값", "완료 마일스톤", "미완 마일스톤", "메모", "업데이트"],
    ...bizData.map(b => [
      b.name, b.emoji, `${b.progress}%`,
      b.kpis[0]?.label||"", b.kpis[0]?.value||"",
      b.kpis[1]?.label||"", b.kpis[1]?.value||"",
      b.kpis[2]?.label||"", b.kpis[2]?.value||"",
      b.milestones.filter(m=>m.done).map(m=>m.text).join(" / "),
      b.milestones.filter(m=>!m.done).map(m=>m.text).join(" / "),
      b.note, new Date().toLocaleDateString("ko-KR"),
    ]),
  ];

  // 시트2: 일별 플래너
  const plannerRows = [
    ["날짜", "우선순위1", "우선순위2", "우선순위3", "할일1", "할일2", "할일3", "할일4", "할일5", "할일6", "완료 수", "메모", "회고"],
    ...days.map(ds => {
      const top3 = ls.get(`planner_top3_${ds}`, ["","",""]);
      const todos = ls.get(`planner_todos_${ds}`, []);
      const notes = ls.get(`planner_notes_${ds}`, "");
      const reflection = ls.get(`planner_reflection_${ds}`, "");
      if (!top3.some(t=>t) && !todos.length) return null;
      return [
        ds,
        top3[0]||"", top3[1]||"", top3[2]||"",
        todos[0]?.text||"", todos[1]?.text||"", todos[2]?.text||"",
        todos[3]?.text||"", todos[4]?.text||"", todos[5]?.text||"",
        todos.filter(t=>t.done).length,
        notes, reflection,
      ];
    }).filter(Boolean),
  ];

  // 시트3: 체크리스트
  const FIXED = ["QT","기도 30분","새벽운동","주식블로그 3개","웹소설","음원만들기","스포츠블로그","정치유튜브"];
  const clRows = [
    ["날짜", ...FIXED, "플래너 달성률"],
    ...days.map(ds => {
      const cl = ls.get(`cl_v2_${ds}`, null);
      if (!cl) return null;
      const fixed = cl.fixed || {};
      const planner = cl.planner || {};
      const total = FIXED.length + Object.keys(planner).length;
      const done = Object.values(fixed).filter(Boolean).length + Object.values(planner).filter(Boolean).length;
      const pct = total > 0 ? Math.round(done/total*100) : 0;
      return [ds, ...FIXED.map((_,i) => fixed[["qt","prayer","workout","stock","novel","music","sports","youtube"][i]] ? "✅" : ""), `${pct}%`];
    }).filter(Boolean),
  ];

  // 시트4: QT 기록
  const qtRows = [
    ["날짜", "말씀 구절", "말씀 본문", "오늘의 적용", "기도 제목", "AI 묵상 도움"],
    ...days.map(ds => {
      const qt = ls.get(`planner_qt_${ds}`, null);
      const ai = ls.get(`planner_qt_ai_${ds}`, "");
      if (!qt || (!qt.verse && !qt.verseText)) return null;
      return [ds, qt.verse||"", qt.verseText||"", qt.apply||"", qt.prayer||"", ai||""];
    }).filter(Boolean),
  ];

  return { bizRows, plannerRows, clRows, qtRows };
};

// ── 스프레드시트 전체 업데이트 ───────────────────────────────
const updateSpreadsheet = async (token, spreadsheetId, sheetData) => {
  const { bizRows, plannerRows, clRows, qtRows } = sheetData;
  const sheetList = await sheets.getSheetsList(token, spreadsheetId);
  const sheetNames = ["사업현황", "일별 플래너", "체크리스트", "QT 기록"];
  const allRows = [bizRows, plannerRows, clRows, qtRows];

  // 필요한 시트 추가
  const addRequests = sheetNames
    .filter(name => !sheetList.find(s => s.title === name))
    .map((name, i) => ({ addSheet: { properties: { title: name, index: i } } }));
  if (addRequests.length > 0) {
    await sheets.batchUpdate(token, spreadsheetId, addRequests);
  }

  // 각 시트에 데이터 쓰기
  for (let i = 0; i < sheetNames.length; i++) {
    const name = sheetNames[i];
    const rows = allRows[i];
    await sheets.clearRange(token, spreadsheetId, `${name}!A:Z`);
    await sheets.writeRange(token, spreadsheetId, `${name}!A1`, rows);
  }
};

// ── 아이콘 ────────────────────────────────────────────────────
const Ic = ({ n, s = 16 }) => {
  const d = {
    upload:  <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    download:<><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></>,
    sheet:   <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></>,
    json:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></>,
    check:   <polyline points="20 6 9 17 4 12"/>,
    spin:    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>,
    drive:   <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    lock:    <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    info:    <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    link:    <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d[n]}</svg>;
};

// ════════════════════════════════════════════════════════════
// 메인 BackupTab
// ════════════════════════════════════════════════════════════
export default function BackupTab({ gcalToken }) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [lastBackup, setLastBackup] = useState(() => ls.get("last_backup", null));
  const [lastSheet, setLastSheet] = useState(() => ls.get("last_sheet_backup", null));
  const [sheetId, setSheetId] = useState(() => localStorage.getItem("sheet_id") || null);
  const [previewData, setPreviewData] = useState(null);
  const [showRestore, setShowRestore] = useState(false);
  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem("auto_backup") === "true");
  const isLoading = status === "backing" || status === "restoring" || status === "sheeting";
  const dataCount = Object.keys(collectAllData().items).length;
  // 새 기기 감지: 데이터 없고 로그인 됨
  const isNewDevice = dataCount === 0 && !!gcalToken;

  useEffect(() => { localStorage.setItem("auto_backup", autoBackup); }, [autoBackup]);

  // 자동 백업 (앱 실행 시)
  useEffect(() => {
    if (!gcalToken || !autoBackup) return;
    const today = new Date().toDateString();
    if (lastBackup?.date === today) return;
    backupJson(true);
  }, [gcalToken]);

  // ── JSON 백업 ──────────────────────────────────────────────
  const backupJson = async (silent = false) => {
    if (!gcalToken) { setMessage("구글 캘린더 탭에서 먼저 로그인해주세요."); setStatus("error"); return; }
    if (!silent) setStatus("backing");
    try {
      const folderId = await drive.getOrCreateFolder(gcalToken);
      const existing = await drive.findFile(gcalToken, folderId, FILE_NAME);
      const data = collectAllData();
      await drive.upload(gcalToken, folderId, existing?.id || null, data);
      const info = { date: new Date().toDateString(), time: new Date().toLocaleTimeString("ko-KR"), count: Object.keys(data.items).length };
      ls.set("last_backup", info);
      setLastBackup(info);
      if (!silent) { setStatus("done"); setMessage(`✅ JSON 백업 완료! ${info.count}개 항목 저장됨`); setTimeout(() => setStatus("idle"), 3000); }
    } catch (e) {
      if (!silent) { setStatus("error"); setMessage(`❌ 백업 실패: ${e.message}`); }
    }
  };

  // ── 스프레드시트 백업 ──────────────────────────────────────
  const backupSheet = async () => {
    if (!gcalToken) { setMessage("구글 캘린더 탭에서 먼저 로그인해주세요."); setStatus("error"); return; }
    setStatus("sheeting"); setMessage("스프레드시트 업데이트 중...");
    try {
      const folderId = await drive.getOrCreateFolder(gcalToken);
      let sid = sheetId;
      if (!sid) {
        sid = await sheets.getOrCreate(gcalToken, folderId);
        setSheetId(sid);
        localStorage.setItem("sheet_id", sid);
      }
      setMessage("데이터 변환 중...");
      const sheetData = buildSheetData();
      setMessage("시트에 쓰는 중...");
      await updateSpreadsheet(gcalToken, sid, sheetData);
      const info = { date: new Date().toDateString(), time: new Date().toLocaleTimeString("ko-KR"), sheetId: sid };
      ls.set("last_sheet_backup", info);
      setLastSheet(info);
      setStatus("done");
      setMessage(`✅ 스프레드시트 업데이트 완료!`);
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e) {
      setStatus("error");
      setMessage(`❌ 스프레드시트 오류: ${e.message}`);
    }
  };

  // ── JSON 복원 ──────────────────────────────────────────────
  const fetchPreview = async () => {
    if (!gcalToken) { setMessage("먼저 로그인해주세요."); setStatus("error"); return; }
    setStatus("backing"); setMessage("드라이브에서 불러오는 중...");
    try {
      const folderId = await drive.getOrCreateFolder(gcalToken);
      const file = await drive.findFile(gcalToken, folderId, FILE_NAME);
      if (!file) { setStatus("error"); setMessage("❌ 저장된 백업이 없습니다."); return; }
      const data = await drive.download(gcalToken, file.id);
      setPreviewData({ ...data, fileInfo: file });
      setShowRestore(true);
      setStatus("idle"); setMessage("");
    } catch (e) { setStatus("error"); setMessage(`❌ 불러오기 실패: ${e.message}`); }
  };

  const [countdown, setCountdown] = useState(0);

  const restore = async () => {
    if (!previewData) return;
    setStatus("restoring"); setMessage("복원 중...");
    try {
      const count = restoreAllData(previewData);
      setShowRestore(false);
      setStatus("done");
      setMessage(`✅ 복원 완료! ${count}개 항목 복원됨.`);
      // 3초 카운트다운 후 자동 새로고침
      let n = 3;
      setCountdown(n);
      const timer = setInterval(() => {
        n--;
        setCountdown(n);
        if (n <= 0) {
          clearInterval(timer);
          window.location.reload();
        }
      }, 1000);
    } catch (e) { setStatus("error"); setMessage(`❌ 복원 실패: ${e.message}`); }
  };

  const openSheet = () => {
    if (sheetId) window.open(`https://docs.google.com/spreadsheets/d/${sheetId}`, "_blank");
  };

  return (
    <div style={{ flex:1, overflowY:"auto", padding:16 }}>

      {/* 새 기기 감지 배너 */}
      {isNewDevice && (
        <div style={{ background:`linear-gradient(135deg,#1a2a1a,#1e321e)`, borderRadius:14, padding:16, marginBottom:14, border:`1px solid ${C.green}55` }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.green, marginBottom:6 }}>📱 새 기기에서 시작하시나요?</div>
          <div style={{ fontSize:12, color:C.textMuted, lineHeight:1.7, marginBottom:14 }}>
            이 기기에 저장된 데이터가 없어요.<br/>
            구글 드라이브 백업에서 데이터를 가져오면<br/>
            다른 기기의 내용을 그대로 사용할 수 있어요!
          </div>
          <button onClick={fetchPreview} disabled={isLoading} style={{
            width:"100%", padding:"13px 0",
            background:`linear-gradient(135deg,#1a6b3a,${C.green})`,
            border:"none", borderRadius:10, color:"#001a0e",
            fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}>
            <Ic n="download" s={16}/>드라이브에서 데이터 가져오기
          </button>
        </div>
      )}

      {/* 복원 카운트다운 */}
      {countdown > 0 && (
        <div style={{ background:C.greenDim, borderRadius:12, padding:16, marginBottom:14, border:`1px solid ${C.green}44`, textAlign:"center" }}>
          <div style={{ fontSize:13, color:C.green, fontWeight:600, marginBottom:6 }}>✅ 복원 완료! 잠시 후 앱이 새로고침됩니다</div>
          <div style={{ fontSize:36, fontWeight:800, color:C.green }}>{countdown}</div>
        </div>
      )}

      {/* 헤더 카드 */}
      <div style={{ background:`linear-gradient(135deg,${C.surface},#2a2820)`, borderRadius:14, padding:16, marginBottom:14, border:`1px solid ${C.goldMid}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:C.goldDim, border:`1px solid ${C.goldMid}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.gold }}>
            <Ic n="drive" s={20}/>
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>구글 드라이브 백업</div>
            <div style={{ fontSize:11, color:C.textDim }}>DoubleY_Backup 폴더</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ flex:1, background:C.bg, borderRadius:8, padding:"9px 10px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:9, color:C.textDim, marginBottom:2 }}>저장된 항목</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.gold }}>{dataCount}개</div>
          </div>
          <div style={{ flex:1, background:C.bg, borderRadius:8, padding:"9px 10px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:9, color:C.textDim, marginBottom:2 }}>JSON 백업</div>
            <div style={{ fontSize:11, fontWeight:700, color:lastBackup ? C.green : C.textDim }}>{lastBackup ? lastBackup.time : "없음"}</div>
          </div>
          <div style={{ flex:1, background:C.bg, borderRadius:8, padding:"9px 10px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:9, color:C.textDim, marginBottom:2 }}>시트 백업</div>
            <div style={{ fontSize:11, fontWeight:700, color:lastSheet ? C.green : C.textDim }}>{lastSheet ? lastSheet.time : "없음"}</div>
          </div>
        </div>
      </div>

      {/* 로그인 상태 */}
      {!gcalToken ? (
        <div style={{ background:C.redDim, borderRadius:10, padding:"11px 14px", marginBottom:12, border:`1px solid ${C.red}44`, display:"flex", alignItems:"center", gap:8 }}>
          <Ic n="lock" s={16}/>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:C.red }}>구글 로그인 필요</div>
            <div style={{ fontSize:11, color:C.textMuted }}>캘린더 탭에서 구글 로그인 후 사용하세요</div>
          </div>
        </div>
      ) : (
        <div style={{ background:C.greenDim, borderRadius:8, padding:"8px 12px", marginBottom:12, border:`1px solid ${C.green}33`, display:"flex", alignItems:"center", gap:6 }}>
          <Ic n="check" s={13}/>
          <div style={{ fontSize:11, color:C.green }}>구글 계정 연결됨 · 백업 사용 가능</div>
        </div>
      )}

      {/* 자동 백업 */}
      <div style={{ background:C.surface, borderRadius:12, padding:14, marginBottom:12, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:C.text }}>자동 백업 (JSON)</div>
          <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>앱 실행 시 하루 1회 자동 저장</div>
        </div>
        <button onClick={() => setAutoBackup(!autoBackup)} style={{ width:48, height:26, borderRadius:13, border:"none", cursor:"pointer", background:autoBackup?C.gold:C.border, position:"relative", transition:"background .2s" }}>
          <div style={{ width:20, height:20, borderRadius:"50%", background:"white", position:"absolute", top:3, left:autoBackup?25:3, transition:"left .2s" }}/>
        </button>
      </div>

      {/* ── 스프레드시트 백업 섹션 ── */}
      <div style={{ background:C.surface, borderRadius:14, padding:16, marginBottom:12, border:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <div style={{ color:C.green }}><Ic n="sheet" s={18}/></div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>구글 스프레드시트 백업</div>
            <div style={{ fontSize:11, color:C.textDim }}>열람·편집 가능한 표 형식으로 저장</div>
          </div>
        </div>

        {/* 시트 구성 미리보기 */}
        <div style={{ background:C.bg, borderRadius:10, padding:12, marginBottom:12, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:10, color:C.gold, fontWeight:700, marginBottom:8 }}>시트 구성</div>
          {[
            { icon:"📊", name:"사업현황", desc:"사업명, 진행률, KPI, 마일스톤" },
            { icon:"📋", name:"일별 플래너", desc:"날짜별 우선순위, 할일, 완료 수" },
            { icon:"☑️", name:"체크리스트", desc:"날짜별 루틴 달성 현황" },
            { icon:"✝️", name:"QT 기록", desc:"날짜별 말씀, 적용, 기도제목" },
          ].map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:i<3?`1px solid ${C.border}`:"none" }}>
              <span style={{ fontSize:14 }}>{s.icon}</span>
              <div>
                <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{s.name}</span>
                <span style={{ fontSize:11, color:C.textDim, marginLeft:8 }}>{s.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={backupSheet} disabled={isLoading || !gcalToken} style={{
          width:"100%", padding:"13px 0", marginBottom:8,
          background: gcalToken && !isLoading ? `linear-gradient(135deg,#1a6b3a,${C.green})` : C.border,
          border:"none", borderRadius:10,
          color: gcalToken && !isLoading ? "#001a0e" : C.textDim,
          fontSize:14, fontWeight:800, cursor: gcalToken && !isLoading ? "pointer" : "not-allowed",
          fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        }}>
          {status === "sheeting"
            ? <><div style={{ animation:"spin 1s linear infinite" }}><Ic n="spin" s={15}/></div>{message || "업데이트 중..."}</>
            : <><Ic n="sheet" s={15}/>스프레드시트에 저장하기</>
          }
        </button>

        {sheetId && (
          <button onClick={openSheet} style={{ width:"100%", padding:"10px 0", background:"transparent", border:`1px solid ${C.green}55`, borderRadius:10, color:C.green, cursor:"pointer", fontSize:13, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <Ic n="link" s={14}/>구글 스프레드시트 열기
          </button>
        )}
      </div>

      {/* ── JSON 백업 섹션 ── */}
      <div style={{ background:C.surface, borderRadius:14, padding:16, marginBottom:12, border:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <div style={{ color:C.gold }}><Ic n="json" s={18}/></div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>JSON 백업 / 복원</div>
            <div style={{ fontSize:11, color:C.textDim }}>앱 데이터 완전 복원용</div>
          </div>
        </div>
        <button onClick={() => backupJson(false)} disabled={isLoading || !gcalToken} style={{
          width:"100%", padding:"13px 0", marginBottom:8,
          background: gcalToken && !isLoading ? `linear-gradient(135deg,${C.bronze},${C.gold})` : C.border,
          border:"none", borderRadius:10,
          color: gcalToken && !isLoading ? "#1a1a18" : C.textDim,
          fontSize:14, fontWeight:800, cursor: gcalToken && !isLoading ? "pointer" : "not-allowed",
          fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        }}>
          {status === "backing"
            ? <><div style={{ animation:"spin 1s linear infinite" }}><Ic n="spin" s={15}/></div>백업 중...</>
            : <><Ic n="upload" s={15}/>JSON 백업하기</>
          }
        </button>
        <button onClick={fetchPreview} disabled={isLoading || !gcalToken} style={{
          width:"100%", padding:"11px 0",
          background:"transparent", border:`1px solid ${gcalToken&&!isLoading?C.blue:C.border}`,
          borderRadius:10, color:gcalToken&&!isLoading?C.blue:C.textDim,
          fontSize:13, fontWeight:600, cursor:gcalToken&&!isLoading?"pointer":"not-allowed",
          fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        }}>
          {status === "restoring"
            ? <><div style={{ animation:"spin 1s linear infinite" }}><Ic n="spin" s={15}/></div>복원 중...</>
            : <><Ic n="download" s={15}/>드라이브에서 복원하기</>
          }
        </button>
      </div>

      {/* 상태 메시지 */}
      {message && status !== "sheeting" && (
        <div style={{ background:status==="error"?C.redDim:status==="done"?C.greenDim:C.surface, border:`1px solid ${status==="error"?C.red+"44":status==="done"?C.green+"44":C.border}`, borderRadius:10, padding:"11px 14px", marginBottom:12, fontSize:13, color:status==="error"?C.red:status==="done"?C.green:C.textMuted, lineHeight:1.6 }}>
          {message}
        </div>
      )}

      {/* 안내 */}
      <div style={{ background:C.surface, borderRadius:10, padding:12, border:`1px solid ${C.border}`, display:"flex", gap:8, marginBottom:20 }}>
        <div style={{ color:C.textDim, flexShrink:0 }}><Ic n="info" s={14}/></div>
        <div style={{ fontSize:11, color:C.textDim, lineHeight:1.7 }}>
          스프레드시트는 구글 드라이브 <strong style={{ color:C.textMuted }}>DoubleY_Backup</strong> 폴더에 저장됩니다.<br/>
          같은 파일에 덮어쓰므로 항상 최신 데이터를 유지해요.<br/>
          기기를 바꿔도 구글 계정으로 로그인하면 복원 가능합니다.
        </div>
      </div>

      {/* 복원 확인 모달 */}
      {showRestore && previewData && (
        <div style={{ position:"fixed", inset:0, background:"#000b", zIndex:100, display:"flex", alignItems:"flex-end" }}>
          <div style={{ width:"100%", background:C.surface, borderRadius:"20px 20px 0 0", padding:20, paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))", maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:4 }}>📦 백업 데이터 복원</div>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:14 }}>
              백업 시각: {new Date(previewData.savedAt).toLocaleString("ko-KR")}
            </div>

            {/* 백업 내용 요약 */}
            <div style={{ background:C.bg, borderRadius:10, padding:12, marginBottom:12, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:10 }}>복원될 데이터</div>
              {[
                { key:"biz_v1", label:"📊 사업현황" },
                { key:"planner_", label:"📋 일별 플래너 & QT 기록" },
                { key:"cl_v2_", label:"☑️ 체크리스트" },
              ].map(({ key, label }) => {
                const count = Object.keys(previewData.items||{}).filter(k=>k.startsWith(key)).length;
                return count > 0 ? (
                  <div key={key} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.text }}>{label}</span>
                    <span style={{ fontSize:12, color:C.green }}>{count}개 항목 ✓</span>
                  </div>
                ) : null;
              })}
              <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0 0" }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.text }}>총</span>
                <span style={{ fontSize:12, fontWeight:700, color:C.gold }}>{Object.keys(previewData.items||{}).length}개 항목</span>
              </div>
            </div>

            {/* 현재 기기 데이터 vs 백업 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              <div style={{ background:C.bg, borderRadius:8, padding:10, border:`1px solid ${C.border}`, textAlign:"center" }}>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>이 기기 현재 데이터</div>
                <div style={{ fontSize:20, fontWeight:800, color:dataCount>0?C.gold:C.textDim }}>{dataCount}개</div>
              </div>
              <div style={{ background:C.bg, borderRadius:8, padding:10, border:`1px solid ${C.green}44`, textAlign:"center" }}>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>백업 데이터</div>
                <div style={{ fontSize:20, fontWeight:800, color:C.green }}>{Object.keys(previewData.items||{}).length}개</div>
              </div>
            </div>

            <div style={{ background:C.redDim, borderRadius:8, padding:"10px 12px", marginBottom:16, border:`1px solid ${C.red}33`, fontSize:12, color:C.red, lineHeight:1.6 }}>
              ⚠️ 복원하면 이 기기의 현재 데이터가 백업으로 덮어쓰입니다.<br/>
              복원 완료 후 앱이 자동으로 새로고침됩니다.
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setShowRestore(false)} style={{ flex:1, padding:"13px 0", background:"transparent", border:`1px solid ${C.border}`, borderRadius:10, color:C.textMuted, cursor:"pointer", fontSize:14, fontFamily:"inherit" }}>취소</button>
              <button onClick={restore} style={{ flex:2, padding:"13px 0", background:`linear-gradient(135deg,#1a6b3a,${C.green})`, border:"none", borderRadius:10, color:"#001a0e", cursor:"pointer", fontSize:15, fontWeight:800, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <Ic n="download" s={16}/>복원하기
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
