import { useState } from 'react';

// 로컬 Flask 파이프라인 (shorts/longform 탭과 동일)
const PIPELINE_URL = 'http://localhost:5050';

const RED = '#C53030';
const BORDER = '#e6e6e6';
const GRAY = '#888';

async function pollJob(jobId, onStep) {
  while (true) {
    const r = await fetch(`${PIPELINE_URL}/api/status/${jobId}`);
    if (!r.ok) throw new Error('상태 조회 실패');
    const j = await r.json();
    if (onStep && j.step) onStep(j.step);
    if (j.status === 'review' || j.status === 'done') return j;
    if (j.status === 'error') throw new Error(j.error || '작업 실패');
    await new Promise((res) => setTimeout(res, 2000));
  }
}

export default function CardNewsTab() {
  const [contentType, setContentType] = useState('weekend');
  const [phase, setPhase] = useState('idle'); // idle | planning | review | rendering | done
  const [step, setStep] = useState('');
  const [plan, setPlan] = useState(null);
  const [images, setImages] = useState({}); // { 1: {file, url} }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const busy = phase === 'planning' || phase === 'rendering';

  const genPlan = async () => {
    setError(''); setResult(null); setPlan(null); setImages({});
    setPhase('planning'); setStep('실시간 뉴스 검색 + 기획안 생성 중...');
    try {
      const r = await fetch(`${PIPELINE_URL}/api/cardnews/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: contentType }),
      });
      const { job_id } = await r.json();
      const j = await pollJob(job_id, setStep);
      setPlan(j.result.plan);
      setPhase('review');
    } catch (e) {
      setError(String(e.message || e)); setPhase('idle');
    }
  };

  const setField = (field, val) => setPlan((p) => ({ ...p, [field]: val }));
  const updateTopic = (i, field, val) =>
    setPlan((p) => ({
      ...p,
      topics: p.topics.map((t, idx) => (idx === i ? { ...t, [field]: val } : t)),
    }));

  const pickImage = (num, file) => {
    if (!file) return;
    setImages((im) => ({ ...im, [num]: { file, url: URL.createObjectURL(file) } }));
  };
  const removeImage = (num) =>
    setImages((im) => { const c = { ...im }; delete c[num]; return c; });

  const render = async (publishYoutube) => {
    setError(''); setPhase('rendering'); setStep('영상 합성 시작...');
    try {
      const fd = new FormData();
      fd.append('plan', JSON.stringify(plan));
      fd.append('content_type', contentType);
      fd.append('publish_youtube', publishYoutube ? 'true' : 'false');
      (plan.topics || []).forEach((t, idx) => {
        const num = idx + 1;
        if (images[num]) fd.append(`image_${num}`, images[num].file);
      });
      const r = await fetch(`${PIPELINE_URL}/api/cardnews/render`, { method: 'POST', body: fd });
      const { job_id } = await r.json();
      const j = await pollJob(job_id, setStep);
      setResult(j.result); setPhase('done');
    } catch (e) {
      setError(String(e.message || e)); setPhase('review');
    }
  };

  const input = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, marginTop: 4,
    fontFamily: 'inherit',
  };
  const btn = (bg, col, brd) => ({
    padding: '10px 16px', borderRadius: 10, background: bg, color: col,
    border: `1px solid ${brd || bg}`, fontWeight: 700, fontSize: 14, cursor: 'pointer',
  });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>🃏 카드뉴스 롱폼</div>
        <div style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>
          놓치기 쉬운 뉴스 5 · 16:9 카드뉴스 (실시간 뉴스 검색)
        </div>
      </div>

      {/* 1) 발행 구간 + 기획안 생성 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['weekend', '이번 주 후반 (목~토)'], ['mid-week', '이번 주 전반 (월~수)']].map(([v, label]) => (
          <button key={v} onClick={() => setContentType(v)} disabled={busy}
            style={btn(contentType === v ? RED : '#fff', contentType === v ? '#fff' : '#555', BORDER)}>
            {label}
          </button>
        ))}
      </div>
      <button onClick={genPlan} disabled={busy} style={{ ...btn(RED, '#fff'), width: '100%' }}>
        {phase === 'planning' ? '생성 중...' : '🔍 기획안 생성 (실시간 뉴스)'}
      </button>

      {busy && (
        <div style={{ marginTop: 12, padding: 12, background: '#fff7f7', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, color: '#a33' }}>
          ⏳ {step}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, padding: 12, background: '#fff0f0', border: '1px solid #f3b', borderRadius: 10, fontSize: 13, color: '#c00', whiteSpace: 'pre-wrap' }}>
          ❌ {error}
        </div>
      )}

      {/* 2) 검토/편집 + 사진 첨부 */}
      {plan && (phase === 'review' || phase === 'rendering' || phase === 'done') && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>{plan.title}</div>

          <label style={{ fontSize: 12, color: GRAY }}>오프닝 멘트</label>
          <textarea rows={2} value={plan.opening_hook || ''} disabled={busy}
            onChange={(e) => setField('opening_hook', e.target.value)} style={input} />

          {(plan.topics || []).map((t, i) => {
            const num = i + 1;
            const img = images[num];
            return (
              <div key={i} style={{ marginTop: 14, padding: 12, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: RED }}>{String(num).padStart(2, '0')}</span>
                  <span style={{ fontSize: 12, color: GRAY }}>{(t.keywords || []).slice(0, 3).join(' · ')}</span>
                </div>
                <input value={t.headline || ''} disabled={busy}
                  onChange={(e) => updateTopic(i, 'headline', e.target.value)} style={{ ...input, fontWeight: 700 }} />
                <textarea rows={3} value={t.summary || ''} disabled={busy}
                  onChange={(e) => updateTopic(i, 'summary', e.target.value)} style={input} placeholder="요약" />
                <textarea rows={2} value={t.bluntedge_take || ''} disabled={busy}
                  onChange={(e) => updateTopic(i, 'bluntedge_take', e.target.value)} style={input} placeholder="BluntEdge 한마디" />

                {/* 사진 첨부 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  {img ? (
                    <>
                      <img src={img.url} alt="" style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 6, border: `1px solid ${BORDER}` }} />
                      <button onClick={() => removeImage(num)} disabled={busy} style={btn('#fff', '#c00', BORDER)}>사진 제거</button>
                    </>
                  ) : (
                    <label style={{ ...btn('#fff', '#555', BORDER), display: 'inline-block' }}>
                      🖼️ 사진 첨부
                      <input type="file" accept="image/*" disabled={busy} style={{ display: 'none' }}
                        onChange={(e) => pickImage(num, e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>
            );
          })}

          <label style={{ fontSize: 12, color: GRAY, marginTop: 12, display: 'block' }}>마무리 멘트</label>
          <textarea rows={2} value={plan.closing_message || ''} disabled={busy}
            onChange={(e) => setField('closing_message', e.target.value)} style={input} />

          {/* 3) 영상 생성 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => render(false)} disabled={busy} style={{ ...btn(RED, '#fff'), flex: 1 }}>
              {phase === 'rendering' ? '생성 중...' : '🎬 영상 생성'}
            </button>
            <button onClick={() => render(true)} disabled={busy} style={{ ...btn('#1a1a1a', '#fff'), flex: 1 }}>
              🎬 생성 + 유튜브 업로드
            </button>
          </div>
        </div>
      )}

      {/* 결과 */}
      {phase === 'done' && result && (
        <div style={{ marginTop: 16, padding: 14, background: '#f3fff3', border: '1px solid #b5e0b5', borderRadius: 12, fontSize: 14 }}>
          ✅ 카드뉴스 완성<br />
          <span style={{ fontSize: 12, color: GRAY, wordBreak: 'break-all' }}>{result.video_path}</span>
          {result.video_url && (
            <div style={{ marginTop: 8 }}>
              ▶️ <a href={result.video_url} target="_blank" rel="noreferrer" style={{ color: RED, fontWeight: 700 }}>유튜브에서 보기</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
