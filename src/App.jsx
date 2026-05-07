import { useState, useRef, useEffect } from 'react';
import { CHANNEL_PROMPTS, CHANNELS } from './config/bible.js';
import { generateContent } from './services/api.js';

const PIPELINE_URL = 'http://localhost:5050';

function LoadingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 400);
    return () => clearInterval(t);
  }, []);
  return <span>{dots}</span>;
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '12px 6px', border: 'none', borderRadius: 10,
      background: active ? '#1A1A1A' : 'transparent',
      color: active ? '#FFF' : '#777',
      fontSize: 13, fontWeight: 700, cursor: 'pointer',
      fontFamily: 'inherit', transition: 'all 0.2s',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>{label}
    </button>
  );
}

function ContentDisplay({ content, label }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <div style={{ background: '#FAFAF8', border: '1px solid #E5E2DB', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #E5E2DB', background: '#F5F3EE' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>{label}</span>
        <button onClick={handleCopy} style={{ background: copied ? '#2D8544' : '#2D2D2D', color: '#FFF', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {copied ? '✓ 복사됨' : '📋 복사'}
        </button>
      </div>
      <div style={{ padding: '16px', fontSize: 14, lineHeight: 1.8, color: '#2D2D2D', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 500, overflowY: 'auto', fontFamily: 'inherit' }}>
        {content}
      </div>
    </div>
  );
}

// ── 폴링 헬퍼 ──
function pollJob(jobId, onUpdate, onDone, onError) {
  const poll = setInterval(async () => {
    try {
      const r = await fetch(`${PIPELINE_URL}/api/status/${jobId}`);
      const j = await r.json();
      onUpdate(j);
      if (j.status === 'done' || j.status === 'review') { clearInterval(poll); onDone(j); }
      else if (j.status === 'error') { clearInterval(poll); onError(j.error); }
    } catch (e) { clearInterval(poll); onError('서버 연결 끊김'); }
  }, 1500);
  return poll;
}

export default function App() {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [activeTab, setActiveTab] = useState('youtube');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [serverOnline, setServerOnline] = useState(null);
  const inputRef = useRef(null);

  // 파이프라인 2단계 상태
  const [pipeStep, setPipeStep] = useState('idle'); // idle | scripting | review | rendering | done | error
  const [pipeMsg, setPipeMsg] = useState('');
  const [pipeScript, setPipeScript] = useState({ title: '', script: '', description: '' });
  const [editTitle, setEditTitle] = useState('');
  const [editScript, setEditScript] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [pipeResult, setPipeResult] = useState(null);
  const [pipeError, setPipeError] = useState('');

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    fetch(`${PIPELINE_URL}/api/health`).then(r => r.json())
      .then(() => setServerOnline(true)).catch(() => setServerOnline(false));
  }, []);

  // ── 텍스트 생성 (기존) ──
  const handleGenerate = async (channel) => {
    if (!topic.trim()) return;
    setLoading(p => ({ ...p, [channel]: true }));
    setError(p => ({ ...p, [channel]: null }));
    try {
      const text = await generateContent(channel, topic, context);
      setResults(p => ({ ...p, [channel]: text }));
    } catch (err) { setError(p => ({ ...p, [channel]: err.message })); }
    finally { setLoading(p => ({ ...p, [channel]: false })); }
  };

  const generateAll = async () => {
    if (!topic.trim()) return;
    setGeneratingAll(true);
    for (const ch of ['youtube', 'x', 'blog']) await handleGenerate(ch);
    setGeneratingAll(false);
  };

  // ── 파이프라인 Step 1: 스크립트 생성 ──
  const startScriptGeneration = async () => {
    if (!topic.trim()) return;
    setPipeStep('scripting');
    setPipeMsg('스크립트 생성 중...');
    setPipeResult(null);
    setPipeError('');

    try {
      const res = await fetch(`${PIPELINE_URL}/api/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), context: context.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      pollJob(data.job_id,
        (j) => setPipeMsg(j.step || ''),
        (j) => {
          const r = j.result;
          setPipeScript(r);
          setEditTitle(r.title);
          setEditScript(r.script);
          setEditDesc(r.description);
          setPipeStep('review');
        },
        (err) => { setPipeStep('error'); setPipeError(err); },
      );
    } catch (err) { setPipeStep('error'); setPipeError(err.message); }
  };

  // ── 파이프라인 Step 2: 영상 생성 ──
  const startVideoGeneration = async () => {
    setPipeStep('rendering');
    setPipeMsg('음성 생성 중...');

    try {
      const res = await fetch(`${PIPELINE_URL}/api/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          script: editScript.trim(),
          description: editDesc.trim(),
          upload: false,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      pollJob(data.job_id,
        (j) => setPipeMsg(j.step || ''),
        (j) => { setPipeStep('done'); setPipeResult(j.result); },
        (err) => { setPipeStep('error'); setPipeError(err); },
      );
    } catch (err) { setPipeStep('error'); setPipeError(err.message); }
  };

  const resetPipeline = () => {
    setPipeStep('idle');
    setPipeMsg('');
    setPipeScript({ title: '', script: '', description: '' });
    setPipeResult(null);
    setPipeError('');
  };

  const channelKeys = ['youtube', 'x', 'blog'];
  const activeConfig = CHANNEL_PROMPTS[activeTab];
  const hasAnyResult = Object.values(results).some(Boolean);

  return (
    <div style={{ minHeight: '100vh', background: '#F0EDEA', fontFamily: "'Pretendard','Noto Sans KR',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        * { box-sizing:border-box; } textarea:focus,input:focus { outline:none; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#CCC; border-radius:4px; }
      `}</style>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px 60px' }}>

        {/* ── Header ── */}
        <div style={{ padding: '28px 0 20px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#2D2D2D,#555)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '2px solid #C53030' }}>🔪</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: -0.5 }}>BluntEdge</h1>
          </div>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0', fontWeight: 500 }}>정치 콘텐츠 에이전트 · "무딘 척하지만, 벤다."</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            {Object.entries(CHANNELS).map(([key, ch]) => (
              <a key={key} href={ch.url} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8,
                background: `${ch.color}10`, border: `1px solid ${ch.color}25`, fontSize: 11, fontWeight: 600, color: ch.color, textDecoration: 'none',
              }}><span style={{ fontSize: 13 }}>{ch.icon}</span>{ch.label}</a>
            ))}
          </div>
        </div>

        {/* ── Input ── */}
        <div style={{ background: '#FFF', borderRadius: 14, padding: '20px', border: '1px solid #E0DDD6', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, display: 'block' }}>📰 오늘의 이슈</label>
          <input ref={inputRef} value={topic} onChange={e => setTopic(e.target.value)} placeholder="예: 국회 예산안 강행 처리, 한미 정상회담 결과..."
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E0DDD6', fontSize: 14, fontFamily: 'inherit', background: '#FAFAF8', color: '#1A1A1A' }}
            onFocus={e => e.target.style.borderColor = '#C53030'} onBlur={e => e.target.style.borderColor = '#E0DDD6'}
          />
          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginTop: 14, marginBottom: 8, display: 'block' }}>📎 추가 맥락 (선택)</label>
          <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="관련 기사 URL, 핵심 수치, 배경 정보 등을 붙여넣으세요..." rows={3}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E0DDD6', fontSize: 13, fontFamily: 'inherit', background: '#FAFAF8', color: '#1A1A1A', resize: 'vertical' }}
            onFocus={e => e.target.style.borderColor = '#C53030'} onBlur={e => e.target.style.borderColor = '#E0DDD6'}
          />

          {/* 텍스트 생성 버튼 */}
          <button onClick={generateAll} disabled={!topic.trim() || generatingAll}
            style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 10, border: 'none',
              background: topic.trim() && !generatingAll ? 'linear-gradient(135deg,#C53030,#9B2C2C)' : '#DDD',
              color: topic.trim() && !generatingAll ? '#FFF' : '#999', fontSize: 14, fontWeight: 700,
              cursor: topic.trim() && !generatingAll ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {generatingAll ? <span style={{ animation: 'pulse 1.5s infinite' }}>⚡ 3채널 생성 중...</span> : '⚡ 3채널 텍스트 생성'}
          </button>

          {/* 영상 파이프라인 버튼 */}
          <button onClick={startScriptGeneration}
            disabled={!topic.trim() || pipeStep === 'scripting' || pipeStep === 'rendering' || !serverOnline}
            style={{ width: '100%', marginTop: 8, padding: '12px', borderRadius: 10, border: 'none',
              background: topic.trim() && serverOnline && pipeStep !== 'scripting' && pipeStep !== 'rendering' ? 'linear-gradient(135deg,#2D2D2D,#444)' : '#DDD',
              color: topic.trim() && serverOnline && pipeStep !== 'scripting' && pipeStep !== 'rendering' ? '#FFF' : '#999',
              fontSize: 14, fontWeight: 700, cursor: topic.trim() && serverOnline ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {pipeStep === 'scripting' ? <span style={{ animation: 'pulse 1.5s infinite' }}>📝 {pipeMsg}</span>
              : pipeStep === 'rendering' ? <span style={{ animation: 'pulse 1.5s infinite' }}>🎬 {pipeMsg}</span>
              : '🎬 YouTube 영상 만들기'}
          </button>

          {serverOnline === false && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#FFF5F5', border: '1px solid #FED7D7', fontSize: 11, color: '#C53030', lineHeight: 1.5 }}>
              ⚠️ 로컬 서버가 꺼져 있습니다. PC에서 <code style={{ background: '#EEE', padding: '1px 4px', borderRadius: 3 }}>python server.py</code>를 실행하세요.
            </div>
          )}
          {serverOnline === true && pipeStep === 'idle' && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#2D8544', textAlign: 'center' }}>● 파이프라인 서버 연결됨</div>
          )}
        </div>

        {/* ════════════════════════════════════════ */}
        {/* ── 파이프라인: 스크립트 검토 단계 ── */}
        {/* ════════════════════════════════════════ */}
        {pipeStep === 'review' && (
          <div style={{ background: '#FFF', borderRadius: 14, padding: '20px', border: '2px solid #C53030', marginBottom: 16, animation: 'fadeIn 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#C53030' }}>📝 스크립트 검토</div>
              <span style={{ fontSize: 11, color: '#888', background: '#F5F3EE', padding: '3px 10px', borderRadius: 6 }}>수정 후 영상 만들기</span>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }}>제목</label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0DDD6', fontSize: 14, fontFamily: 'inherit', marginBottom: 12 }} />

            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }}>나레이션 스크립트</label>
            <textarea value={editScript} onChange={e => setEditScript(e.target.value)} rows={8}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0DDD6', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.7, marginBottom: 12, resize: 'vertical' }} />

            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }}>영상 설명</label>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0DDD6', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.7, marginBottom: 14, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={startVideoGeneration}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#C53030,#9B2C2C)', color: '#FFF',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                🎬 이 스크립트로 영상 만들기
              </button>
              <button onClick={resetPipeline}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E0DDD6',
                  background: '#FFF', color: '#777', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── 파이프라인: 영상 생성 완료 ── */}
        {pipeStep === 'done' && pipeResult && (
          <div style={{ background: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: 14, padding: '20px', marginBottom: 16, animation: 'fadeIn 0.4s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#276749', marginBottom: 12 }}>✅ 영상 생성 완료!</div>
            <div style={{ fontSize: 13, color: '#2D2D2D', lineHeight: 1.8 }}>
              <p><strong>제목:</strong> {pipeResult.title}</p>
              <p><strong>출력 폴더:</strong> <code style={{ background: '#E2E8F0', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{pipeResult.output_dir}</code></p>
              {pipeResult.video_url && (
                <p><strong>YouTube:</strong> <a href={pipeResult.video_url} target="_blank" rel="noopener noreferrer" style={{ color: '#C53030' }}>{pipeResult.video_url}</a></p>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 10 }}>PC의 output 폴더에서 video.mp4, thumbnail.jpg를 확인하세요.</div>
            <button onClick={resetPipeline} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #C6F6D5', background: '#FFF', color: '#276749', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              🔄 새로운 영상 만들기
            </button>
          </div>
        )}

        {/* ── 파이프라인: 에러 ── */}
        {pipeStep === 'error' && (
          <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 14, padding: '16px', marginBottom: 16, fontSize: 13, color: '#C53030' }}>
            ⚠️ 파이프라인 오류: {pipeError}
            <button onClick={resetPipeline} style={{ display: 'block', marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #C53030', background: 'transparent', color: '#C53030', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              다시 시도
            </button>
          </div>
        )}

        {/* ── Channel Tabs ── */}
        <div style={{ display: 'flex', gap: 3, background: '#E5E2DB', borderRadius: 12, padding: 3, marginBottom: 16 }}>
          {channelKeys.map(ch => (
            <TabBtn key={ch} active={activeTab === ch} onClick={() => setActiveTab(ch)} icon={CHANNEL_PROMPTS[ch].icon} label={CHANNEL_PROMPTS[ch].label} />
          ))}
        </div>

        {/* ── Single Channel ── */}
        {!results[activeTab] && !loading[activeTab] && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{activeConfig.icon}</div>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>{activeConfig.label} 콘텐츠를 생성하려면<br />주제를 입력하고 아래 버튼을 눌러주세요.</div>
            <button onClick={() => handleGenerate(activeTab)} disabled={!topic.trim()}
              style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: topic.trim() ? '#2D2D2D' : '#DDD', color: topic.trim() ? '#FFF' : '#999', fontSize: 13, fontWeight: 600, cursor: topic.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              {activeConfig.label}만 생성
            </button>
          </div>
        )}

        {loading[activeTab] && (
          <div style={{ textAlign: 'center', padding: '40px 0', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ fontSize: 36, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>{activeConfig.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>BluntEdge가 {activeConfig.label} 작성 중<LoadingDots /></div>
          </div>
        )}

        {error[activeTab] && (
          <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 10, padding: '14px 16px', marginBottom: 12, fontSize: 13, color: '#C53030' }}>
            ⚠️ 오류: {error[activeTab]}
            <button onClick={() => handleGenerate(activeTab)} style={{ display: 'block', marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #C53030', background: 'transparent', color: '#C53030', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>다시 시도</button>
          </div>
        )}

        {results[activeTab] && !loading[activeTab] && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <ContentDisplay content={results[activeTab]} label={`${activeConfig.icon} ${activeConfig.label} — BluntEdge`} />
            <button onClick={() => handleGenerate(activeTab)} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 8, border: '1px solid #E0DDD6', background: '#FFF', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>🔄 다시 생성</button>
          </div>
        )}

        {hasAnyResult && (
          <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 10, background: '#FFF', border: '1px solid #E5E2DB' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8 }}>생성 현황</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {channelKeys.map(ch => (
                <div key={ch} style={{ flex: 1, textAlign: 'center', padding: '6px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: results[ch] ? '#F0FFF4' : loading[ch] ? '#FFFBEB' : '#F5F3EE',
                  color: results[ch] ? '#276749' : loading[ch] ? '#975A16' : '#AAA',
                  border: `1px solid ${results[ch] ? '#C6F6D5' : loading[ch] ? '#FEFCBF' : '#E5E2DB'}` }}>
                  {CHANNEL_PROMPTS[ch].icon} {results[ch] ? '✓ 완료' : loading[ch] ? '생성중' : '대기'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Bible ── */}
        <details style={{ marginTop: 20 }}>
          <summary style={{ fontSize: 12, fontWeight: 600, color: '#888', cursor: 'pointer', padding: '8px 0' }}>📖 BluntEdge 바이블 요약 보기</summary>
          <div style={{ background: '#FFF', borderRadius: 10, padding: '14px', border: '1px solid #E5E2DB', marginTop: 8, fontSize: 12, color: '#555', lineHeight: 1.7 }}>
            <p><strong>포지션:</strong> 중도 실용주의 · 진영 논리 거부</p>
            <p><strong>톤:</strong> 날카로운 논객 · 직설 + 풍자 · 팩트 퍼스트</p>
            <p><strong>금기:</strong> 양비론, 인신공격, 감정선동, 미확인정보, 어그로</p>
            <p><strong>구조:</strong> 통념 제시 → 팩트로 뒤집기 → 한 줄 결론</p>
          </div>
        </details>

        {/* ── Footer ── */}
        <div style={{ marginTop: 30, textAlign: 'center', padding: '16px 0', borderTop: '1px solid #E0DDD6' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            {Object.entries(CHANNELS).map(([key, ch]) => (
              <a key={key} href={ch.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#888', textDecoration: 'none' }}>{ch.icon} {ch.label}</a>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#AAA' }}>BluntEdge Content Agent v1.3 · Powered by Claude</div>
        </div>
      </div>
    </div>
  );
}
