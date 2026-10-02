import { useState, useEffect } from 'react';

// ══════════════════════════════════════════════════════════════
// 타입4 심층분석 롱폼 (브리핑 기반)
//   추천 선택 → 대본(팩트체크) → CEO 검토·클립 선택 → 합성 → 썸네일 선택 → 발행
//   서버: /api/longform/recommendations · script · plan · clips/search · upload_clip · render · publish
// ══════════════════════════════════════════════════════════════

const PIPELINE_URL = 'http://localhost:5050';
const RED = '#C53030';
const KO_CHARS_PER_MIN = 330;
const PUBLISH_CHANNELS = [
  { key: 'youtube', icon: '▶️', label: 'YouTube' },
  { key: 'blog', icon: '📝', label: '블로그' },
  { key: 'x', icon: '𝕏', label: 'X 스레드' },
];
const BLOG_CATEGORIES = ['정치 분석', '사설 해설', '팩트체크', '시사 논평'];

const card = { background: '#FFF', borderRadius: 14, padding: 16, border: '1px solid #E0DDD6', marginBottom: 12 };
const label = { fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' };
const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0DDD6', fontSize: 13, fontFamily: 'inherit', background: '#FAFAF8', color: '#1A1A1A' };
const btn = (primary = true, disabled = false) => ({
  padding: '12px', borderRadius: 10, border: primary ? 'none' : '1px solid #E0DDD6',
  background: disabled ? '#DDD' : primary ? `linear-gradient(135deg, ${RED}, ${RED}CC)` : '#FFF',
  color: disabled ? '#999' : primary ? '#FFF' : '#777', fontSize: 13, fontWeight: 700,
  cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
});
const chip = (on) => ({
  padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  background: on ? `${RED}15` : '#FAFAF8', border: on ? `1.5px solid ${RED}` : '1px solid #E0DDD6', color: on ? RED : '#999',
});

function Dots() {
  const [d, setD] = useState('');
  useEffect(() => { const t = setInterval(() => setD(x => (x.length >= 3 ? '' : x + '.')), 400); return () => clearInterval(t); }, []);
  return <span>{d}</span>;
}

function pollJob(jobId, onUpdate, onDone, onError) {
  const t = setInterval(async () => {
    try {
      const j = await (await fetch(`${PIPELINE_URL}/api/status/${jobId}`)).json();
      onUpdate(j);
      if (['done', 'review', 'thumbnail_select'].includes(j.status)) { clearInterval(t); onDone(j); }
      else if (j.status === 'error') { clearInterval(t); onError(j.error); }
    } catch { clearInterval(t); onError('서버 연결 끊김'); }
  }, 2000);
}

// "1:23" / "83" / "1:02:03" → 초
const toSec = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const parts = String(v).trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
};
const fmtSec = (s) => (s || s === 0) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';
const ytId = (url = '') => (url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/) || [])[1];
const mediaUrl = (p) => `${PIPELINE_URL}/api/media?path=${encodeURIComponent(p || '')}`;

const narrChars = (plan) => {
  if (!plan) return 0;
  let n = (plan.hook || '').length + (plan.closing || '').length;
  (plan.sections || []).forEach(s => { n += (s.lead || '').length + (s.narration || '').length; });
  return n;
};

export default function LongformT4({ serverOnline, presetDate, presetRank, onPresetConsumed }) {
  const [step, setStep] = useState('pick'); // pick | scripting | review | rendering | thumbnail | publishing | done | error
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [recs, setRecs] = useState([]);
  const [weekly, setWeekly] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [minutes, setMinutes] = useState(7);
  const [note, setNote] = useState('');
  const [focusRank, setFocusRank] = useState(null); // 브리핑 탭에서 특정 이슈로 들어온 경우

  const [planId, setPlanId] = useState('');
  const [plan, setPlan] = useState(null);
  const [openSec, setOpenSec] = useState(0);
  const [searchQ, setSearchQ] = useState({});
  const [searching, setSearching] = useState({});
  const [saved, setSaved] = useState('');

  // ── 커버 (썸네일 = 첫 화면) ──
  const [coverPreview, setCoverPreview] = useState(null); // { path, ts, kind, has_media }
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverMsg, setCoverMsg] = useState('');

  const [video, setVideo] = useState(null);
  const [thumbTexts, setThumbTexts] = useState([]);
  const [thumbPreviews, setThumbPreviews] = useState([]); // [{ path, ts }]
  const [thumbBusy, setThumbBusy] = useState({});
  const [publish, setPublish] = useState({ youtube: true, blog: true, x: true });
  const [blogCat, setBlogCat] = useState('정치 분석');
  const [result, setResult] = useState(null);

  const loadLists = async () => {
    try {
      const r = await (await fetch(`${PIPELINE_URL}/api/longform/recommendations?days=7`)).json();
      setRecs(r.recommendations || []);
      setWeekly(r.weekly || null);
      if (!selectedDate && r.recommendations?.length) {
        const fresh = r.recommendations.find(x => !x.already_used) || r.recommendations[0];
        setSelectedDate(fresh.date);
      }
      const p = await (await fetch(`${PIPELINE_URL}/api/longform/projects`)).json();
      setProjects((p.projects || []).filter(x => x.stage !== 'published'));
    } catch { /* 서버 꺼짐 — 상단 상태 표시로 충분 */ }
  };

  useEffect(() => { if (serverOnline) loadLists(); }, [serverOnline]);
  useEffect(() => {
    if (presetDate) {
      setSelectedDate(presetDate); setFocusRank(presetRank || null); setStep('pick');
      onPresetConsumed && onPresetConsumed();
    }
  }, [presetDate, presetRank]);

  const fail = (e) => { setStep('error'); setError(typeof e === 'string' ? e : e.message); };

  // ── ② 대본 생성 ──
  const startScript = async () => {
    if (!selectedDate) return;
    setStep('scripting'); setMsg('대본 생성 + 팩트체크 중'); setError('');
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/script`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, target_minutes: minutes, ceo_note: note, issue_rank: focusRank }),
      })).json();
      if (d.error) throw new Error(d.error);
      pollJob(d.job_id, j => setMsg(j.step || ''), j => {
        setPlanId(j.result.plan_id); setPlan(j.result.plan); setOpenSec(0); setStep('review');
      }, fail);
    } catch (e) { fail(e); }
  };

  const openProject = async (id) => {
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/plan/${id}`)).json();
      if (d.error) throw new Error(d.error);
      setPlanId(id); setPlan(d.plan); setOpenSec(0);
      if (d.state?.stage === 'rendered' && d.state.video_path) {
        setVideo({ video_path: d.state.video_path, duration: d.state.duration });
        const ideas = [d.plan.cover?.headline, ...(d.plan.thumbnail_ideas || [])].filter((x, k, arr) => x && arr.indexOf(x) === k);
        setThumbTexts((ideas.length ? ideas : [d.plan.title?.slice(0, 15) || '']).slice(0, 3));
        setThumbPreviews([]);
        setStep('thumbnail');
      } else setStep('review');
    } catch (e) { fail(e); }
  };

  // ── 대본 편집 헬퍼 ──
  const setField = (k, v) => setPlan(p => ({ ...p, [k]: v }));
  const setSec = (i, patch) => setPlan(p => ({ ...p, sections: p.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setClip = (i, patch) => setPlan(p => ({
    ...p, sections: p.sections.map((s, j) => (j === i ? { ...s, clip: patch === null ? null : { ...(s.clip || {}), ...patch } } : s)),
  }));
  const moveSec = (i, dir) => setPlan(p => {
    const arr = [...p.sections]; const k = i + dir;
    if (k < 0 || k >= arr.length) return p;
    [arr[i], arr[k]] = [arr[k], arr[i]];
    return { ...p, sections: arr };
  });
  const removeSec = (i) => setPlan(p => ({ ...p, sections: p.sections.filter((_, j) => j !== i) }));

  const pickCandidate = (i, c) => setClip(i, {
    source: 'youtube', url: c.url, label: c.channel, title: c.title,
    startText: '0:00', endText: '0:20', start: 0, end: 20,
  });

  const searchClips = async (i) => {
    const q = (searchQ[i] ?? plan.sections[i].clip_query ?? '').trim();
    if (!q) return;
    setSearching(s => ({ ...s, [i]: true }));
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/clips/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }),
      })).json();
      setSec(i, { candidates: d.candidates || [], clip_query: q });
    } catch { /* noop */ }
    setSearching(s => ({ ...s, [i]: false }));
  };

  const uploadClip = async (i, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('plan_id', planId); fd.append('section', String(i)); fd.append('clip', file);
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/upload_clip`, { method: 'POST', body: fd })).json();
      if (d.error) throw new Error(d.error);
      setClip(i, { source: 'file', path: d.path, label: '', title: d.name, url: undefined });
    } catch (e) { alert(`업로드 실패: ${e.message}`); }
  };

  // 클립 시간 문자열 → 초로 정리해서 서버로
  const normalizedPlan = () => ({
    ...plan,
    cover: (() => {
      const c = { ...(plan.cover || { source: 'auto' }) };
      if (!c.headline) c.headline = plan.thumbnail_ideas?.[0] || '';
      if (c.source === 'youtube') c.at = toSec(c.atText) ?? 0;
      return c;
    })(),
    sections: plan.sections.map(s => {
      if (!s.clip) return s;
      const c = { ...s.clip };
      if (c.source === 'youtube') {
        c.start = toSec(c.startText) ?? 0;
        c.end = toSec(c.endText) ?? c.start + 20;
      }
      return { ...s, clip: c };
    }),
  });

  const savePlan = async () => {
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/plan/${planId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: normalizedPlan() }),
      })).json();
      if (d.error) throw new Error(d.error);
      setSaved('저장됨 ✓'); setTimeout(() => setSaved(''), 1500);
    } catch (e) { setSaved(`저장 실패: ${e.message}`); }
  };

  // ── ③ 합성 ──
  const clipErrors = (plan?.sections || []).map(s => {
    const c = s.clip;
    if (!c || c.source !== 'youtube') return '';
    const a = toSec(c.startText), b = toSec(c.endText);
    if (a === null || b === null) return '시간 형식 확인 (예: 1:23)';
    if (b <= a) return '끝 시간이 시작보다 커야 함';
    if (b - a > 90) return '클립은 90초 이하';
    return '';
  });
  const canRender = plan && plan.sections?.length && plan.hook?.trim() && plan.closing?.trim() && clipErrors.every(e => !e);

  const startRender = async () => {
    if (!canRender) return;
    setStep('rendering'); setMsg('영상 합성 준비 중'); setError('');
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/render`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, plan: normalizedPlan() }),
      })).json();
      if (d.error) throw new Error(d.error);
      pollJob(d.job_id, j => setMsg(j.step || ''), j => {
        setVideo({ video_path: j.result.video_path, duration: j.result.duration });
        setThumbTexts([...(j.result.thumbnail_candidates || [])]);
        const ts = Date.now();
        setThumbPreviews((j.result.thumbnail_previews || []).map(p => (p ? { path: p, ts } : null)));
        setStep('thumbnail');
      }, fail);
    } catch (e) { fail(e); }
  };

  // ── 커버 ──
  const cover = plan?.cover || { source: 'auto' };
  const setCover = (patch) => setPlan(p => ({ ...p, cover: { ...(p.cover || { source: 'auto' }), ...patch } }));
  const coverHeadline = cover.headline ?? (plan?.thumbnail_ideas?.[0] || '');
  const allCandidates = (plan?.sections || []).flatMap(s => s.candidates || [])
    .filter((c, i, arr) => arr.findIndex(x => x.url === c.url) === i);
  const firstClipSec = (plan?.sections || []).find(s => s.clip);

  const uploadCover = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('plan_id', planId); fd.append('cover', file);
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/upload_cover`, { method: 'POST', body: fd })).json();
      if (d.error) throw new Error(d.error);
      setCover({ source: 'file', path: d.path, name: d.name, kind: d.kind });
      setCoverPreview(null);
    } catch (e) { setCoverMsg(`업로드 실패: ${e.message}`); }
  };

  const previewCover = async () => {
    setCoverBusy(true); setCoverMsg(cover.source === 'youtube' || (cover.source === 'auto' && firstClipSec?.clip?.source === 'youtube') ? '커버 영상 받는 중…' : '미리보기 만드는 중…');
    try {
      const np = normalizedPlan();
      np.cover = { ...(np.cover || { source: 'auto' }), headline: coverHeadline };
      if (np.cover.source === 'youtube') np.cover.at = toSec(np.cover.atText) ?? 0;
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/cover_preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_id: planId, plan: np }),
      })).json();
      if (d.error) throw new Error(d.error);
      setCoverPreview({ path: d.path, ts: Date.now(), kind: d.kind, has_media: d.has_media });
      setCoverMsg(d.has_media ? '' : '배경 소스가 없어 기본 어두운 배경으로 표시됩니다');
    } catch (e) { setCoverMsg(e.message); }
    setCoverBusy(false);
  };

  const refreshThumb = async (i) => {
    setThumbBusy(b => ({ ...b, [i]: true }));
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/thumb_preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, text: thumbTexts[i], index: i }),
      })).json();
      if (d.error) throw new Error(d.error);
      setThumbPreviews(arr => { const a = [...arr]; a[i] = { path: d.path, ts: Date.now() }; return a; });
    } catch { /* noop */ }
    setThumbBusy(b => ({ ...b, [i]: false }));
  };

  // ── ④ 발행 ──
  const startPublish = async (text) => {
    setStep('publishing'); setMsg('발행 중');
    try {
      const d = await (await fetch(`${PIPELINE_URL}/api/longform/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId, thumbnail_text: text, title: plan.title, description: plan.description,
          publish_youtube: publish.youtube, publish_blog: publish.blog, publish_x: publish.x, blog_category: blogCat,
        }),
      })).json();
      if (d.error) throw new Error(d.error);
      pollJob(d.job_id, j => setMsg(j.step || ''), j => { setResult(j.result); setStep('done'); loadLists(); }, fail);
    } catch (e) { fail(e); }
  };

  const reset = () => {
    setStep('pick'); setPlan(null); setPlanId(''); setVideo(null); setResult(null); setError(''); setNote('');
    setCoverPreview(null); setCoverMsg(''); setThumbPreviews([]);
    setSearchQ({}); loadLists();
  };

  const chars = narrChars(plan);

  // ═════════════════════════ 렌더링 ═════════════════════════
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* ── 이번 주 발행 현황 ── */}
      {weekly && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: weekly.remaining ? `${RED}15` : '#F0FFF4', color: weekly.remaining ? RED : '#276749',
            border: `1px solid ${weekly.remaining ? RED + '30' : '#C6F6D5'}` }}>
            🎬 이번 주 타입4 롱폼 {weekly.published}/{weekly.target}편 {weekly.remaining ? `· ${weekly.remaining}편 남음` : '· 목표 달성'}
          </span>
        </div>
      )}

      {/* ═════ ① 추천 선택 ═════ */}
      {step === 'pick' && <>
        {projects.length > 0 && (
          <div style={card}>
            <div style={label}>📂 진행 중인 롱폼</div>
            {projects.map(p => (
              <button key={p.plan_id} onClick={() => openProject(p.plan_id)}
                style={{ ...chip(false), width: '100%', textAlign: 'left', marginBottom: 6, padding: '10px 12px', color: '#333' }}>
                <strong>{p.title || p.plan_id}</strong>
                <span style={{ color: '#999', marginLeft: 6 }}>
                  · {p.stage === 'rendered' ? `영상 완료 (${((p.duration || 0) / 60).toFixed(1)}분) → 발행 대기` : '대본 검토 중'}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={card}>
          <div style={label}>🎬 롱폼PD 추천 (최근 7일)</div>
          {recs.length === 0 && <div style={{ fontSize: 12, color: '#AAA', padding: 10 }}>브리핑이 없습니다. 브리핑 탭에서 먼저 실행하세요.</div>}
          {recs.map(r => {
            const on = selectedDate === r.date;
            return (
              <div key={r.date} onClick={() => { setSelectedDate(r.date); if (r.date !== selectedDate) setFocusRank(null); }}
                style={{ padding: 12, borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                  border: on ? `2px solid ${RED}` : '1px solid #EDE9E0', background: on ? `${RED}08` : '#FAFAF8' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#888' }}>{r.date.slice(4, 6)}/{r.date.slice(6, 8)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: RED }}>{r.series}</span>
                  {r.already_used && <span style={{ fontSize: 10, color: '#2D8544', fontWeight: 700 }}>· 제작함</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>{r.title}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4, lineHeight: 1.6 }}>{r.hook}</div>
                {on && focusRank && (
                  <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#1A1A1A', color: '#FFF', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                    <span>📌 브리핑 이슈 #{focusRank} 중심으로 제작 (PD 추천 대신)</span>
                    <span onClick={(e) => { e.stopPropagation(); setFocusRank(null); }} style={{ cursor: 'pointer', color: '#AAA' }}>✕ 추천대로</span>
                  </div>
                )}
                {on && !focusRank && r.outline?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#555', lineHeight: 1.7 }}>
                    {r.outline.map((o, i) => <div key={i}>· <strong>{o.section}</strong> ({o.duration}) {o.content}</div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={card}>
          <div style={label}>⏱️ 목표 길이</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[5, 7, 10].map(m => (
              <button key={m} onClick={() => setMinutes(m)} style={{ ...chip(minutes === m), flex: 1 }}>
                {m}분 <span style={{ fontWeight: 400 }}>(~{(m * KO_CHARS_PER_MIN / 1000).toFixed(1)}k자)</span>
              </button>
            ))}
          </div>
          <div style={label}>📝 CEO 메모 <span style={{ fontWeight: 400, color: '#AAA' }}>(선택 · 각도·강조점·빼야 할 내용)</span></div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }}
            placeholder="예: OECD 비교는 수치로, 국민의힘 인사청문회 부분은 사실 확인된 것만" />
        </div>

        <button onClick={startScript} disabled={!selectedDate || !serverOnline}
          style={{ ...btn(true, !selectedDate || !serverOnline), width: '100%', padding: 14, fontSize: 15 }}>
          📝 대본 만들기 (웹검색 팩트체크 포함)
        </button>
        <div style={{ marginTop: 6, fontSize: 10, color: '#AAA', textAlign: 'center' }}>
          ElevenLabs 예상 사용량 ≈ {(minutes * KO_CHARS_PER_MIN).toLocaleString()}자 · Claude 웹검색 1회
        </div>
      </>}

      {/* ═════ 진행 중 ═════ */}
      {['scripting', 'rendering', 'publishing'].includes(step) && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <div style={{ fontSize: 42, marginBottom: 14, animation: 'pulse 1.5s infinite' }}>
            {step === 'scripting' ? '📝' : step === 'rendering' ? '🎬' : '📤'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>{msg}<Dots /></div>
          <div style={{ fontSize: 11, color: '#AAA', marginTop: 8 }}>
            {step === 'rendering' ? '롱폼 합성은 5~15분 걸립니다 (TTS + 클립 다운로드 포함)' : '타입4 심층분석 롱폼'}
          </div>
        </div>
      )}

      {/* ═════ ② 대본 검토 + 클립 선택 ═════ */}
      {step === 'review' && plan && <>
        <div style={{ ...card, border: `2px solid ${RED}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: RED }}>📝 대본 검토</span>
            <span style={{ fontSize: 11, color: chars > (plan.target_minutes || 7) * KO_CHARS_PER_MIN * 1.25 ? RED : '#888' }}>
              {chars.toLocaleString()}자 · 약 {(chars / KO_CHARS_PER_MIN).toFixed(1)}분
            </span>
          </div>
          <label style={label}>제목</label>
          <input value={plan.title || ''} onChange={e => setField('title', e.target.value)} style={{ ...input, marginBottom: 10, fontWeight: 700 }} />
          <label style={label}>오프닝 훅</label>
          <textarea value={plan.hook || ''} onChange={e => setField('hook', e.target.value)} rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
        </div>

        {/* ── 커버: 썸네일 = 첫 화면 ── */}
        <div style={{ ...card, border: '2px solid #1A1A1A' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A', marginBottom: 4 }}>🖼️ 커버 (썸네일 = 영상 첫 화면)</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
            같은 사진·영상과 문구가 썸네일과 인트로에 똑같이 들어갑니다. 클릭한 화면 그대로 영상이 시작돼 신뢰도가 올라갑니다.
          </div>

          <label style={label}>커버 문구 <span style={{ fontWeight: 400, color: '#AAA' }}>(15자 안팎 · | 줄바꿈 · *강조* 빨간색)</span></label>
          <input value={coverHeadline} onChange={e => { setCover({ headline: e.target.value }); }}
            placeholder="예: 첫날 혼선? |*78년 권력*이 끝났다" style={{ ...input, fontWeight: 800, fontSize: 15, marginBottom: 6 }} />
          {(plan.thumbnail_ideas || []).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {plan.thumbnail_ideas.map((t, k) => (
                <button key={k} onClick={() => setCover({ headline: t })} style={chip(coverHeadline === t)}>{t}</button>
              ))}
            </div>
          )}

          <label style={label}>배경 소스</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[
              { k: 'auto', t: `🎥 첫 클립 자동${firstClipSec ? '' : ' (클립 없음)'}` },
              { k: 'youtube', t: '▶️ 유튜브 장면 지정' },
              { k: 'file', t: '📁 사진·영상 업로드' },
              { k: 'none', t: '⬛ 배경 없음' },
            ].map(o => (
              <button key={o.k} onClick={() => { setCover({ source: o.k }); setCoverPreview(null); }} style={{ ...chip(cover.source === o.k), flex: '1 1 auto' }}>{o.t}</button>
            ))}
          </div>

          {cover.source === 'auto' && (
            <div style={{ fontSize: 11, color: firstClipSec ? '#555' : RED, marginBottom: 10 }}>
              {firstClipSec
                ? `섹션 '${firstClipSec.heading}'의 클립(${firstClipSec.clip.label || firstClipSec.clip.title || '선택한 클립'}) 앞부분을 배경으로 씁니다.`
                : '아직 선택한 클립이 없습니다. 섹션에서 클립을 고르거나 다른 배경 소스를 선택하세요.'}
            </div>
          )}

          {cover.source === 'youtube' && (
            <div style={{ marginBottom: 10 }}>
              {allCandidates.length > 0 && (
                <select value={cover.url || ''} onChange={e => {
                  const c = allCandidates.find(x => x.url === e.target.value);
                  setCover({ url: e.target.value, label: cover.label || c?.channel || '', title: c?.title });
                  setCoverPreview(null);
                }} style={{ ...input, marginBottom: 6 }}>
                  <option value="">— 섹션 클립 후보에서 고르기 —</option>
                  {allCandidates.map(c => <option key={c.url} value={c.url}>[{c.channel}] {c.title}</option>)}
                </select>
              )}
              <input value={cover.url || ''} onChange={e => { setCover({ url: e.target.value }); setCoverPreview(null); }}
                placeholder="또는 유튜브 링크 붙여넣기" style={{ ...input, marginBottom: 6 }} />
              {ytId(cover.url) && (
                <div style={{ position: 'relative', paddingTop: '56.25%', marginBottom: 6, borderRadius: 6, overflow: 'hidden' }}>
                  <iframe title="cover-yt" src={`https://www.youtube.com/embed/${ytId(cover.url)}?start=${Math.floor(toSec(cover.atText) || 0)}`}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allowFullScreen />
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>장면 시작</span>
                <input value={cover.atText || ''} onChange={e => { setCover({ atText: e.target.value }); setCoverPreview(null); }}
                  placeholder="0:42" style={{ ...input, width: 80, padding: 6 }} />
                <span style={{ fontSize: 10, color: '#AAA' }}>여기서부터 12초를 인트로 배경으로, 2초 지점 장면을 썸네일로 씁니다</span>
              </div>
            </div>
          )}

          {cover.source === 'file' && (
            <div style={{ marginBottom: 10 }}>
              <button onClick={() => document.getElementById('t4-cover-up').click()} style={{ ...chip(false), width: '100%', padding: 12 }}>
                {cover.path ? `✓ ${cover.name || '업로드됨'} (${cover.kind === 'image' ? '사진' : '영상'}) — 다시 고르기` : '📁 사진(jpg·png) 또는 영상(mp4) 선택'}
              </button>
              <input id="t4-cover-up" type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => uploadCover(e.target.files[0])} />
              <div style={{ fontSize: 10, color: '#AAA', marginTop: 4 }}>사진은 천천히 확대되는 효과로, 영상은 앞 12초가 배경으로 쓰입니다. 보도사진은 출처·사용 권한을 꼭 확인하세요.</div>
            </div>
          )}

          {cover.source !== 'none' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>출처 표기</span>
              <input value={cover.label || ''} onChange={e => setCover({ label: e.target.value })}
                placeholder={cover.source === 'auto' ? (firstClipSec?.clip?.label || '예: KTV 국민방송') : '예: KTV 국민방송'} style={{ ...input, padding: 6 }} />
            </div>
          )}

          <button onClick={previewCover} disabled={coverBusy} style={{ ...btn(false, coverBusy), width: '100%', color: '#1A1A1A', fontWeight: 800 }}>
            {coverBusy ? coverMsg || '만드는 중…' : '🖼️ 썸네일·첫 화면 미리보기'}
          </button>
          {!coverBusy && coverMsg && <div style={{ fontSize: 11, color: RED, marginTop: 6 }}>{coverMsg}</div>}
          {coverPreview && (
            <img alt="cover preview" src={`${mediaUrl(coverPreview.path)}&t=${coverPreview.ts}`}
              style={{ width: '100%', borderRadius: 8, marginTop: 10, border: '1px solid #E0DDD6', display: 'block' }} />
          )}
        </div>

        {/* 팩트체크 결과 */}
        {plan.fact_checks?.length > 0 && (
          <div style={{ ...card, background: '#FFFBEB', border: '1px solid #F6E05E' }}>
            <div style={label}>🔎 팩트체크 결과 <span style={{ fontWeight: 400, color: '#999' }}>(수정·삭제 항목은 대본 반영 여부 확인)</span></div>
            {plan.fact_checks.map((f, i) => (
              <div key={i} style={{ fontSize: 11, lineHeight: 1.6, padding: '4px 0', borderBottom: '1px solid #F5EBC0' }}>
                <span style={{ fontWeight: 800, color: f.result === '확인' ? '#2D8544' : RED }}>[{f.result}]</span> {f.claim}
                {f.note && <span style={{ color: '#888' }}> — {f.note}</span>}
              </div>
            ))}
          </div>
        )}

        {/* 섹션들 */}
        {plan.sections.map((s, i) => {
          const open = openSec === i;
          const c = s.clip;
          return (
            <div key={i} style={{ ...card, padding: 0, overflow: 'hidden', border: c ? `2px solid ${RED}50` : card.border }}>
              <div onClick={() => setOpenSec(open ? -1 : i)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', cursor: 'pointer' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: RED, color: '#FFF', fontSize: 12, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{s.heading || `섹션 ${i + 1}`}</span>
                <span style={{ fontSize: 10, color: c ? '#2D8544' : '#AAA', fontWeight: 600 }}>
                  {c ? `🎥 ${c.source === 'file' ? '업로드' : c.label || '클립'}` : '텍스트만'}
                </span>
                <span style={{ fontSize: 12, color: '#AAA', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
              </div>

              {open && (
                <div style={{ padding: '0 14px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input value={s.heading} onChange={e => setSec(i, { heading: e.target.value })} placeholder="섹션 제목" style={{ ...input, flex: 1 }} />
                    <button onClick={() => moveSec(i, -1)} style={chip(false)}>↑</button>
                    <button onClick={() => moveSec(i, 1)} style={chip(false)}>↓</button>
                    <button onClick={() => window.confirm('이 섹션을 삭제할까요?') && removeSec(i)} style={chip(false)}>🗑</button>
                  </div>

                  <label style={label}>본 나레이션</label>
                  <textarea value={s.narration} onChange={e => setSec(i, { narration: e.target.value })} rows={6}
                    style={{ ...input, resize: 'vertical', lineHeight: 1.7, marginBottom: 8 }} />

                  <label style={label}>화면 핵심 포인트 <span style={{ fontWeight: 400, color: '#AAA' }}>(줄마다 1개, 최대 3개 · *강조*는 빨간색)</span></label>
                  <textarea value={(s.screen_points || []).join('\n')} rows={3}
                    onChange={e => setSec(i, { screen_points: e.target.value.split('\n').slice(0, 3) })}
                    style={{ ...input, resize: 'vertical', marginBottom: 12 }} />

                  {/* ── 클립 ── */}
                  <div style={{ background: '#F7F5F0', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 4 }}>🎥 클립</div>
                    {s.clip_hint && <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>필요한 장면: {s.clip_hint}</div>}

                    {c && (
                      <div style={{ background: '#FFF', borderRadius: 8, padding: 10, marginBottom: 10, border: '1px solid #C6F6D5' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>✓ {c.title || c.path}</div>
                        {c.source === 'youtube' && ytId(c.url) && (
                          <div style={{ position: 'relative', paddingTop: '56.25%', marginBottom: 8, borderRadius: 6, overflow: 'hidden' }}>
                            <iframe title={`clip-${i}`} src={`https://www.youtube.com/embed/${ytId(c.url)}?start=${Math.floor(toSec(c.startText) || 0)}`}
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allowFullScreen />
                          </div>
                        )}
                        {c.source === 'youtube' && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: '#888' }}>구간</span>
                            <input value={c.startText || ''} onChange={e => setClip(i, { startText: e.target.value })} placeholder="1:05" style={{ ...input, width: 70, padding: 6 }} />
                            <span>~</span>
                            <input value={c.endText || ''} onChange={e => setClip(i, { endText: e.target.value })} placeholder="1:30" style={{ ...input, width: 70, padding: 6 }} />
                            <span style={{ fontSize: 11, color: clipErrors[i] ? RED : '#888' }}>
                              {clipErrors[i] || `${Math.round((toSec(c.endText) || 0) - (toSec(c.startText) || 0))}초`}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>출처 표기</span>
                          <input value={c.label || ''} onChange={e => setClip(i, { label: e.target.value })} placeholder="예: 국회방송 NATV" style={{ ...input, padding: 6 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>클립 자막</span>
                          <input value={c.caption || ''} onChange={e => setClip(i, { caption: e.target.value })} placeholder="(선택) 하단 고정 자막" style={{ ...input, padding: 6 }} />
                        </div>
                        <label style={label}>클립 직전 멘트</label>
                        <input value={s.lead || ''} onChange={e => setSec(i, { lead: e.target.value })} placeholder="예: 먼저 직접 들어보시죠." style={{ ...input, padding: 6, marginBottom: 6 }} />
                        <button onClick={() => setClip(i, null)} style={{ ...chip(false), width: '100%' }}>클립 빼기 (텍스트 화면만)</button>
                      </div>
                    )}

                    {/* 후보 */}
                    {(s.candidates || []).map((cd, k) => (
                      <div key={k} onClick={() => pickCandidate(i, cd)}
                        style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                          background: c?.url === cd.url ? `${RED}10` : '#FFF', border: c?.url === cd.url ? `1.5px solid ${RED}` : '1px solid #E0DDD6' }}>
                        <img alt="" src={`https://i.ytimg.com/vi/${cd.video_id}/mqdefault.jpg`} style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cd.title}</div>
                          <div style={{ fontSize: 10, color: '#888' }}>
                            {cd.tier === 'official' ? '🟢 공식' : cd.tier === 'news' ? '🟡 언론' : '⚪ 기타'} · {cd.channel} · {fmtSec(cd.duration)}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input value={searchQ[i] ?? s.clip_query ?? ''} onChange={e => setSearchQ(q => ({ ...q, [i]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && searchClips(i)} placeholder="유튜브 검색어" style={{ ...input, padding: 8 }} />
                      <button onClick={() => searchClips(i)} disabled={searching[i]} style={{ ...chip(true), whiteSpace: 'nowrap' }}>
                        {searching[i] ? '검색중…' : '🔍 검색'}
                      </button>
                      <button onClick={() => document.getElementById(`t4-up-${i}`).click()} style={{ ...chip(false), whiteSpace: 'nowrap' }}>📁 업로드</button>
                      <input id={`t4-up-${i}`} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => uploadClip(i, e.target.files[0])} />
                    </div>
                    <div style={{ fontSize: 10, color: '#AAA', marginTop: 6 }}>
                      공식 채널(국회방송·KTV·정당) 클립 우선 · 한 클립 90초 이하 · 클립 없으면 텍스트 화면으로 진행
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div style={card}>
          <label style={label}>마무리</label>
          <textarea value={plan.closing || ''} onChange={e => setField('closing', e.target.value)} rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.7, marginBottom: 10 }} />
          <label style={label}>YouTube 설명</label>
          <textarea value={plan.description || ''} onChange={e => setField('description', e.target.value)} rows={4} style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={startRender} disabled={!canRender} style={{ ...btn(true, !canRender), flex: 2 }}>🎬 영상 합성</button>
          <button onClick={savePlan} style={{ ...btn(false), flex: 1 }}>{saved || '💾 저장'}</button>
          <button onClick={() => window.confirm('검토를 닫을까요? (저장한 내용은 진행 중 목록에서 다시 열 수 있음)') && reset()} style={{ ...btn(false), flex: 1 }}>닫기</button>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: '#AAA', textAlign: 'center' }}>
          합성 시 ElevenLabs ≈ {chars.toLocaleString()}자 사용 · 클립 {plan.sections.filter(s => s.clip).length}개
        </div>
      </>}

      {/* ═════ ③ 썸네일 선택 + 발행 ═════ */}
      {step === 'thumbnail' && video && (
        <div style={{ ...card, border: `2px solid ${RED}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: RED, marginBottom: 8 }}>
            🎬 영상 확인 · {((video.duration || 0) / 60).toFixed(1)}분
          </div>
          <video src={mediaUrl(video.video_path)} controls style={{ width: '100%', borderRadius: 8, background: '#000', marginBottom: 12 }} />

          <label style={label}>제목</label>
          <input value={plan?.title || ''} onChange={e => setField('title', e.target.value)} style={{ ...input, marginBottom: 12, fontWeight: 700 }} />

          <div style={label}>📢 발행 채널</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {PUBLISH_CHANNELS.map(ch => (
              <button key={ch.key} onClick={() => setPublish(p => ({ ...p, [ch.key]: !p[ch.key] }))} style={{ ...chip(publish[ch.key]), flex: 1 }}>
                {ch.icon} {ch.label} {publish[ch.key] ? '✓' : ''}
              </button>
            ))}
          </div>
          {publish.blog && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {BLOG_CATEGORIES.map(cat => <button key={cat} onClick={() => setBlogCat(cat)} style={{ ...chip(blogCat === cat), flex: 1 }}>{cat}</button>)}
            </div>
          )}

          <div style={label}>🖼️ 썸네일 선택 → 발행 <span style={{ fontWeight: 400, color: '#AAA' }}>(문구 수정 후 ↻로 다시 그리기)</span></div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
            ① 시안은 영상 첫 화면과 같은 문구입니다. 다른 문구를 고르면 썸네일과 첫 화면 문구가 달라집니다.
          </div>
          {thumbTexts.map((t, i) => (
            <div key={i} style={{ marginBottom: 14, padding: 10, borderRadius: 10, border: i === 0 ? `2px solid ${RED}` : '1px solid #E0DDD6', background: '#FAFAF8' }}>
              {thumbPreviews[i] && (
                <img alt={`thumb-${i}`} src={`${mediaUrl(thumbPreviews[i].path)}&t=${thumbPreviews[i].ts}`}
                  style={{ width: '100%', borderRadius: 6, display: 'block', marginBottom: 8, opacity: thumbBusy[i] ? 0.4 : 1 }} />
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={t} onChange={e => setThumbTexts(a => a.map((x, j) => (j === i ? e.target.value : x)))}
                  onKeyDown={e => e.key === 'Enter' && refreshThumb(i)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: '#1A1A1A', border: '2px solid #333', color: '#FFF', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', textAlign: 'center' }} />
                <button onClick={() => refreshThumb(i)} disabled={thumbBusy[i]} title="시안 다시 그리기" style={{ ...chip(false), fontSize: 14 }}>↻</button>
                <button onClick={() => startPublish(thumbTexts[i])} disabled={!t.trim() || !(publish.youtube || publish.blog || publish.x)}
                  style={{ ...btn(true, !t.trim()), padding: '10px 14px', whiteSpace: 'nowrap' }}>{i === 0 ? '① 선택·발행' : '선택·발행'}</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={() => setStep('review')} style={{ ...btn(false), flex: 1 }}>← 대본 수정 후 재합성</button>
            <button onClick={reset} style={{ ...btn(false), flex: 1 }}>나중에 발행</button>
          </div>
        </div>
      )}

      {/* ═════ 완료 ═════ */}
      {step === 'done' && result && (
        <div style={{ background: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#276749', marginBottom: 12 }}>✅ 타입4 롱폼 발행 완료</div>
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div><strong>제목:</strong> {result.title}</div>
            {result.video_url && <div><strong>▶️ YouTube:</strong> <a href={result.video_url} target="_blank" rel="noopener noreferrer" style={{ color: RED }}>{result.video_url}</a></div>}
            {result.blog_url && <div><strong>📝 블로그:</strong> <a href={result.blog_url} target="_blank" rel="noopener noreferrer" style={{ color: RED }}>{result.blog_url}</a></div>}
            {result.x_url && <div><strong>𝕏 X:</strong> <a href={result.x_url} target="_blank" rel="noopener noreferrer" style={{ color: RED }}>{result.x_url}</a></div>}
          </div>
          <button onClick={reset} style={{ ...btn(false), marginTop: 12 }}>🔄 새 롱폼</button>
        </div>
      )}

      {/* ═════ 에러 ═════ */}
      {step === 'error' && (
        <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 14, padding: 16, fontSize: 13, color: RED }}>
          ⚠️ 오류: {error}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {plan && <button onClick={() => setStep('review')} style={{ ...btn(false), flex: 1 }}>대본으로 돌아가기</button>}
            <button onClick={reset} style={{ ...btn(false), flex: 1 }}>처음으로</button>
          </div>
        </div>
      )}

      {serverOnline === false && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: '#FFF5F5', border: '1px solid #FED7D7', fontSize: 12, color: RED }}>
          ⚠️ 로컬 서버가 꺼져 있습니다. <code>python server.py</code> 실행 후 새로고침하세요.
        </div>
      )}
    </div>
  );
}
