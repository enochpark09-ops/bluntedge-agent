import { useState, useRef, useEffect } from 'react';
import { CHANNELS } from './config/bible.js';

const PIPELINE_URL = 'http://localhost:5050';

const NEWSPAPERS = [
  { id: 'chosun', name: '조선일보', url: 'https://www.chosun.com/opinion/editorial/', color: '#003876', stance: 'conservative' },
  { id: 'joongang', name: '중앙일보', url: 'https://www.joongang.co.kr/opinion/editorial', color: '#E3000F', stance: 'conservative' },
  { id: 'donga', name: '동아일보', url: 'https://www.donga.com/news/Opinion/Editorial', color: '#003DA5', stance: 'conservative' },
  { id: 'hankyoreh', name: '한겨레', url: 'https://www.hani.co.kr/arti/opinion/editorial', color: '#00A651', stance: 'progressive' },
  { id: 'khan', name: '경향신문', url: 'https://www.khan.co.kr/opinion/editorial', color: '#FF6600', stance: 'progressive' },
  { id: 'hankook', name: '한국일보', url: 'https://www.hankookilbo.com/News/Opinion/Editorial', color: '#0066CC', stance: 'neutral' },
  { id: 'mk', name: '매일경제', url: 'https://www.mk.co.kr/opinion/editorial', color: '#1A1A1A', stance: 'conservative' },
  { id: 'hankyung', name: '한국경제', url: 'https://www.hankyung.com/opinion/editorial', color: '#C53030', stance: 'conservative' },
];

const PUBLISH_CHANNELS = [
  { key: 'youtube', icon: '▶️', label: 'YouTube 쇼츠' },
  { key: 'blog', icon: '📝', label: '블로그' },
  { key: 'x', icon: '𝕏', label: 'X 스레드' },
];

function LoadingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(t);
  }, []);
  return <span>{dots}</span>;
}

function pollJob(jobId, onUpdate, onDone, onError) {
  const poll = setInterval(async () => {
    try {
      const r = await fetch(`${PIPELINE_URL}/api/status/${jobId}`);
      const j = await r.json();
      onUpdate(j);
      if (j.status === 'done' || j.status === 'review' || j.status === 'thumbnail_select') {
        clearInterval(poll);
        onDone(j);
      } else if (j.status === 'error') {
        clearInterval(poll);
        onError(j.error);
      }
    } catch (e) { clearInterval(poll); onError('서버 연결 끊김'); }
  }, 1500);
}

export default function App() {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [serverOnline, setServerOnline] = useState(null);
  const [publishChannels, setPublishChannels] = useState({ youtube: true, blog: true, x: true });
  const [blogCategory, setBlogCategory] = useState('사설 해설');

  const BLOG_CATEGORIES = ['사설 해설', '정치 분석', '경제 정책', '칼럼'];
  const inputRef = useRef(null);

  const [pipeStep, setPipeStep] = useState('idle');
  const [pipeMsg, setPipeMsg] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editScript, setEditScript] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [pipeResult, setPipeResult] = useState(null);
  const [pipeError, setPipeError] = useState('');
  const [thumbCandidates, setThumbCandidates] = useState([]);
  const [videoData, setVideoData] = useState(null);

  // ── 탭 & 롱폼 상태 ──
  const [activeTab, setActiveTab] = useState('shorts'); // 'shorts' | 'longform'
  const [lfTitle, setLfTitle] = useState('');
  const [lfIntro, setLfIntro] = useState('');
  const [lfClips, setLfClips] = useState([
    { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: true },
    { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: false },
    { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: false },
    { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: false },
    { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: false },
  ]);
  const [lfPublish, setLfPublish] = useState({ youtube: true, blog: true, x: true });
  const [lfBlogCategory, setLfBlogCategory] = useState('정치 분석');
  const [lfStep, setLfStep] = useState('idle'); // idle | rendering | done | error
  const [lfMsg, setLfMsg] = useState('');
  const [lfResult, setLfResult] = useState(null);
  const [lfError, setLfError] = useState('');

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    fetch(`${PIPELINE_URL}/api/health`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false));
  }, []);

  const isEditorial = !!selectedPaper;
  const accentColor = isEditorial ? (selectedPaper?.color || '#C53030') : '#C53030';
  const modeName = isEditorial ? '신문사설 해설자' : 'BluntEdge';
  const hasAnyChannel = publishChannels.youtube || publishChannels.blog || publishChannels.x;

  // Step 1: 스크립트 생성
  const startScriptGeneration = async () => {
    if (!topic.trim()) return;
    setPipeStep('scripting');
    setPipeMsg('스크립트 생성 중...');
    setPipeResult(null);
    setPipeError('');

    const finalTopic = isEditorial
      ? `[${selectedPaper.name} 사설 분석] ${topic}`
      : topic;

    // 보수 언론 선택 시 비판 논조 강제 적용
    const isConservative = selectedPaper?.stance === 'conservative';
    const editorialDirective = isConservative
      ? `[출처: ${selectedPaper.name} 사설]
${context}

[핵심 지시 — 반드시 따를 것]
${selectedPaper.name}은 보수 언론이다. 이 사설을 BluntEdge의 중도 진보 관점에서 비판적으로 해체하라.
- 이 사설이 설정한 프레임(논조, 전제, 결론 유도)을 찾아내고, 그 프레이밍의 의도를 폭로하라.
- 사설이 주장하는 결론에 동조하지 마라. 같은 팩트라도 BluntEdge는 반대 해석을 내려야 한다.
- 사설이 빠뜨린 팩트, 축소한 맥락, 과장한 부분을 짚어라.
- "이 사설의 진짜 의도는 ~다"라는 식으로 숨겨진 목적을 드러내라.
- 어조: 냉소적이고 날카롭게. 사설의 논리를 조목조목 반박하라.
- 절대로 이 사설의 논조에 동의하거나 수긍하는 문장을 쓰지 마라.`
      : `[출처: ${selectedPaper.name} 사설]
${context}

[지시] 이 사설을 BluntEdge 관점에서 분석하는 스크립트를 만들어줘.`;

    const finalContext = isEditorial ? editorialDirective : context;

    try {
      const res = await fetch(`${PIPELINE_URL}/api/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: finalTopic, context: finalContext }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      pollJob(data.job_id,
        (j) => setPipeMsg(j.step || ''),
        (j) => {
          const r = j.result;
          setEditTitle(r.title);
          setEditScript(r.script);
          setEditDesc(r.description);
          setPipeStep('review');
        },
        (err) => { setPipeStep('error'); setPipeError(err); },
      );
    } catch (err) { setPipeStep('error'); setPipeError(err.message); }
  };

  // Step 2: 영상 생성
  const startVideoGeneration = async () => {
    setPipeStep('rendering');
    setPipeMsg('음성 생성 중...');

    const vd = {
      title: editTitle.trim(),
      script: editScript.trim(),
      description: editDesc.trim(),
    };
    if (isEditorial) {
      vd.newspaper_name = selectedPaper.name;
      vd.newspaper_color = selectedPaper.color;
    }

    try {
      const res = await fetch(`${PIPELINE_URL}/api/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vd),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      pollJob(data.job_id,
        (j) => setPipeMsg(j.step || ''),
        (j) => {
          if (j.status === 'thumbnail_select' && j.result) {
            setThumbCandidates(j.result.thumbnail_candidates || []);
            setVideoData({
              video_path: j.result.video_path,
              output_dir: j.result.output_dir,
              title: j.result.title,
              script: j.result.script,
              description: j.result.description,
            });
            setPipeStep('thumbnail');
          } else if (j.status === 'done') {
            setPipeStep('done');
            setPipeResult(j.result);
          }
        },
        (err) => { setPipeStep('error'); setPipeError(err); },
      );
    } catch (err) { setPipeStep('error'); setPipeError(err.message); }
  };

  // Step 3: 썸네일 선택 → 발행
  const startUpload = async (selectedThumbText) => {
    if (!videoData) return;
    setPipeStep('uploading');
    setPipeMsg('콘텐츠 발행 중...');

    try {
      const res = await fetch(`${PIPELINE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoData.title,
          script: videoData.script,
          description: videoData.description,
          video_path: videoData.video_path,
          output_dir: videoData.output_dir,
          thumbnail_text: selectedThumbText,
          publish_youtube: publishChannels.youtube,
          publish_blog: publishChannels.blog,
          publish_x: publishChannels.x,
          blog_category: blogCategory,
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
    setPipeResult(null);
    setPipeError('');
    setThumbCandidates([]);
    setVideoData(null);
  };

  const resetAll = () => {
    resetPipeline();
    setTopic('');
    setContext('');
    setSelectedPaper(null);
  };

  // ── 롱폼 헬퍼 함수들 ──
  const updateClip = (index, field, value) => {
    setLfClips(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const toggleClipExpand = (index) => {
    setLfClips(prev => prev.map((c, i) => i === index ? { ...c, expanded: !c.expanded } : c));
  };

  const handleVideoUpload = (index, file) => {
    if (file && file.type.startsWith('video/')) {
      updateClip(index, 'videoFile', file);
      updateClip(index, 'videoName', file.name);
    }
  };

  const lfFilledClips = lfClips.filter(c => c.speaker.trim() || c.commentary.trim());
  const lfHasAnyChannel = lfPublish.youtube || lfPublish.blog || lfPublish.x;
  const lfReady = lfTitle.trim() && lfFilledClips.length > 0 && lfFilledClips.every(c => c.videoFile) && lfHasAnyChannel && serverOnline;

  const startLongformGeneration = async () => {
    if (!lfReady) return;
    setLfStep('rendering');
    setLfMsg('롱폼 영상 합성 준비 중...');
    setLfResult(null);
    setLfError('');

    const formData = new FormData();
    formData.append('title', lfTitle.trim());
    formData.append('intro_text', lfIntro.trim());
    formData.append('publish_youtube', lfPublish.youtube ? 'true' : 'false');
    formData.append('publish_blog', lfPublish.blog ? 'true' : 'false');
    formData.append('publish_x', lfPublish.x ? 'true' : 'false');
    formData.append('blog_category', lfBlogCategory);

    lfFilledClips.forEach((clip, idx) => {
      const i = idx + 1;
      formData.append(`clip${i}_speaker`, clip.speaker);
      formData.append(`clip${i}_subtitle`, clip.subtitle);
      formData.append(`clip${i}_commentary`, clip.commentary);
      formData.append(`clip${i}_video`, clip.videoFile);
    });

    try {
      const res = await fetch(`${PIPELINE_URL}/api/longform`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      pollJob(data.job_id,
        (j) => setLfMsg(j.step || ''),
        (j) => { setLfStep('done'); setLfResult(j.result); },
        (err) => { setLfStep('error'); setLfError(err); },
      );
    } catch (err) { setLfStep('error'); setLfError(err.message); }
  };

  const resetLongform = () => {
    setLfStep('idle');
    setLfMsg('');
    setLfResult(null);
    setLfError('');
    setLfTitle('');
    setLfIntro('');
    setLfClips([
      { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: true },
      { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: false },
      { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: false },
      { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: false },
      { speaker: '', subtitle: '', commentary: '', videoFile: null, videoName: '', expanded: false },
    ]);
  };

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

        {/* ── 탭 전환 ── */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#E5E2DB', borderRadius: 12, padding: 3 }}>
          {[
            { key: 'shorts', icon: '📱', label: '쇼츠' },
            { key: 'longform', icon: '🎬', label: '롱폼' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                background: activeTab === tab.key ? '#FFF' : 'transparent',
                color: activeTab === tab.key ? '#C53030' : '#888',
                boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            쇼츠 탭
        ══════════════════════════════════════════════ */}
        {activeTab === 'shorts' && <>

        {/* ══════════ 입력 영역 (idle 상태) ══════════ */}
        {pipeStep === 'idle' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* 모드 표시 */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <span style={{
                display: 'inline-block', padding: '4px 16px', borderRadius: 20,
                background: isEditorial ? `${accentColor}15` : '#2D2D2D10',
                border: `1px solid ${isEditorial ? accentColor : '#2D2D2D'}30`,
                fontSize: 12, fontWeight: 700,
                color: isEditorial ? accentColor : '#2D2D2D',
              }}>
                {isEditorial
                  ? (selectedPaper?.stance === 'conservative'
                    ? `🔪 ${selectedPaper.name} 사설 비판`
                    : `📰 ${selectedPaper.name} 사설 해설`)
                  : '🔪 BluntEdge 자유 분석'}
              </span>
            </div>

            {/* 신문사 선택 */}
            <div style={{ background: '#FFF', borderRadius: 14, padding: '16px', border: '1px solid #E0DDD6', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>📰 신문사 선택 <span style={{ fontWeight: 400, color: '#AAA' }}>(선택하면 사설 해설 모드)</span></span>
                {selectedPaper && (
                  <button onClick={() => setSelectedPaper(null)}
                    style={{ fontSize: 11, color: '#999', background: 'none', border: '1px solid #DDD', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    선택 해제
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                {NEWSPAPERS.map(p => (
                  <button key={p.id} onClick={() => { setSelectedPaper(selectedPaper?.id === p.id ? null : p); window.open(p.url, '_blank'); }}
                    style={{
                      padding: '10px 6px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                      background: selectedPaper?.id === p.id ? `${p.color}15` : '#FAFAF8',
                      border: selectedPaper?.id === p.id ? `2px solid ${p.color}` : '1px solid #EDE9E0',
                      fontSize: 11, fontWeight: 700, textAlign: 'center',
                      color: selectedPaper?.id === p.id ? p.color : '#666',
                      transition: 'all 0.2s',
                    }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 주제 + 맥락 입력 */}
            <div style={{ background: '#FFF', borderRadius: 14, padding: '20px', border: '1px solid #E0DDD6', marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, display: 'block' }}>
                {isEditorial ? '📰 사설 제목' : '📰 오늘의 이슈'}
              </label>
              <input ref={inputRef} value={topic} onChange={e => setTopic(e.target.value)}
                placeholder={isEditorial ? '사설 제목을 입력하세요...' : '예: 국회 예산안 강행 처리, 한미 정상회담...'}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E0DDD6', fontSize: 14, fontFamily: 'inherit', background: '#FAFAF8', color: '#1A1A1A' }}
                onFocus={e => e.target.style.borderColor = accentColor} onBlur={e => e.target.style.borderColor = '#E0DDD6'}
              />
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginTop: 14, marginBottom: 8, display: 'block' }}>
                {isEditorial ? '📎 사설 본문 붙여넣기' : '📎 추가 맥락 (선택)'}
              </label>
              <textarea value={context} onChange={e => setContext(e.target.value)}
                placeholder={isEditorial ? '사설 본문을 복사해서 붙여넣으세요...' : '관련 기사, 핵심 수치, 배경 정보 등...'}
                rows={isEditorial ? 6 : 3}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E0DDD6', fontSize: 13, fontFamily: 'inherit', background: '#FAFAF8', color: '#1A1A1A', resize: 'vertical', lineHeight: 1.7 }}
                onFocus={e => e.target.style.borderColor = accentColor} onBlur={e => e.target.style.borderColor = '#E0DDD6'}
              />
            </div>

            {/* 발행 채널 선택 */}
            <div style={{ background: '#FFF', borderRadius: 14, padding: '16px', border: '1px solid #E0DDD6', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10 }}>📢 발행 채널 선택</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {PUBLISH_CHANNELS.map(ch => (
                  <label key={ch.key} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: publishChannels[ch.key] ? '#C5303012' : '#FAFAF8',
                    border: publishChannels[ch.key] ? '2px solid #C53030' : '1.5px solid #E0DDD6',
                    color: publishChannels[ch.key] ? '#C53030' : '#AAA',
                    transition: 'all 0.2s',
                  }}>
                    <input type="checkbox" checked={publishChannels[ch.key]}
                      onChange={e => setPublishChannels(p => ({ ...p, [ch.key]: e.target.checked }))}
                      style={{ accentColor: '#C53030', display: 'none' }} />
                    <span style={{ fontSize: 16 }}>{ch.icon}</span>
                    <span>{ch.label}</span>
                    {publishChannels[ch.key] && <span style={{ fontSize: 14 }}>✓</span>}
                  </label>
                ))}
              </div>
              {publishChannels.x && (
                <div style={{ marginTop: 8, fontSize: 10, color: '#888', textAlign: 'center' }}>
                  𝕏 텍스트 전용 스레드 (URL 미포함 시 건당 ~21원)
                </div>
              )}

              {/* 블로그 카테고리 선택 */}
              {publishChannels.blog && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6 }}>📂 블로그 카테고리</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {BLOG_CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setBlogCategory(cat)}
                        style={{
                          flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                          background: blogCategory === cat ? '#C5303015' : '#FAFAF8',
                          border: blogCategory === cat ? '1.5px solid #C53030' : '1px solid #E0DDD6',
                          color: blogCategory === cat ? '#C53030' : '#999',
                        }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 생성 버튼 */}
            <button onClick={startScriptGeneration}
              disabled={!topic.trim() || !hasAnyChannel || !serverOnline}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: topic.trim() && hasAnyChannel && serverOnline
                  ? `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` : '#DDD',
                color: topic.trim() && hasAnyChannel && serverOnline ? '#FFF' : '#999',
                fontSize: 15, fontWeight: 800, cursor: topic.trim() && hasAnyChannel && serverOnline ? 'pointer' : 'default',
                fontFamily: 'inherit', transition: 'all 0.2s',
                letterSpacing: -0.3,
              }}>
              {isEditorial
                ? (selectedPaper?.stance === 'conservative' ? '🔪 사설 비판 콘텐츠 생성' : '📰 사설 해설 콘텐츠 생성')
                : '🔪 BluntEdge 콘텐츠 생성'}
            </button>

            {/* 서버 상태 */}
            {serverOnline === false && (
              <div style={{ marginTop: 8, padding: '12px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FED7D7', fontSize: 12, color: '#C53030', lineHeight: 1.6 }}>
                ⚠️ 로컬 서버가 꺼져 있습니다. 아래 명령어를 복사해서 명령 프롬프트에 붙여넣으세요.
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <code style={{ flex: 1, background: '#1A1A1A', color: '#00FF41', padding: '10px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', display: 'block', lineHeight: 1.5 }}>
                    cd C:\bluntedge-pipeline-v1.0\bluntedge-pipeline && python server.py
                  </code>
                  <button onClick={() => {
                    navigator.clipboard.writeText('cd C:\\bluntedge-pipeline-v1.0\\bluntedge-pipeline && python server.py');
                    const btn = document.getElementById('copy-cmd-btn');
                    if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '📋'; }, 1500); }
                  }}
                    id="copy-cmd-btn"
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #C53030', background: '#FFF', color: '#C53030', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    📋
                  </button>
                </div>
              </div>
            )}
            {serverOnline === true && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#2D8544', textAlign: 'center' }}>● 파이프라인 서버 연결됨</div>
            )}
          </div>
        )}

        {/* ══════════ 스크립트 검토 ══════════ */}
        {pipeStep === 'review' && (
          <div style={{ background: '#FFF', borderRadius: 14, padding: '20px', border: `2px solid ${accentColor}`, marginBottom: 16, animation: 'fadeIn 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: accentColor }}>
                📝 {modeName} 스크립트 검토
              </div>
              <span style={{ fontSize: 11, color: '#888', background: '#F5F3EE', padding: '3px 10px', borderRadius: 6 }}>수정 가능</span>
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

            {/* 선택된 채널 표시 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {PUBLISH_CHANNELS.filter(ch => publishChannels[ch.key]).map(ch => (
                <span key={ch.key} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: '#C5303012', color: '#C53030', border: '1px solid #C5303030',
                }}>{ch.icon} {ch.label}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={startVideoGeneration}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`,
                  color: '#FFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                🎬 콘텐츠 만들기
              </button>
              <button onClick={resetAll}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E0DDD6',
                  background: '#FFF', color: '#777', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                취소
              </button>
            </div>
          </div>
        )}

        {/* ══════════ 진행 중 ══════════ */}
        {(pipeStep === 'scripting' || pipeStep === 'rendering' || pipeStep === 'uploading') && (
          <div style={{ textAlign: 'center', padding: '50px 0', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ fontSize: 42, marginBottom: 14, animation: 'pulse 1.5s infinite' }}>
              {pipeStep === 'scripting' ? '📝' : pipeStep === 'uploading' ? '📤' : '🎬'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>{pipeMsg}<LoadingDots /></div>
            <div style={{ fontSize: 11, color: '#AAA', marginTop: 8 }}>{modeName} 모드</div>
          </div>
        )}

        {/* ══════════ 썸네일 선택 ══════════ */}
        {pipeStep === 'thumbnail' && thumbCandidates.length > 0 && (
          <div style={{ background: '#FFF', borderRadius: 14, padding: '20px', border: `2px solid ${accentColor}`, marginBottom: 16, animation: 'fadeIn 0.4s ease' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: accentColor, marginBottom: 6 }}>🖼️ 썸네일 멘트 선택</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>영상 타이틀 카드에 표시될 문구를 선택하세요.</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {PUBLISH_CHANNELS.filter(ch => publishChannels[ch.key]).map(ch => (
                <span key={ch.key} style={{
                  padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: '#C5303012', color: '#C53030',
                }}>{ch.icon} {ch.label}</span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {thumbCandidates.map((txt, i) => (
                <button key={i} onClick={() => startUpload(txt)}
                  style={{
                    padding: '18px', borderRadius: 10,
                    background: '#1A1A1A', border: '2px solid #333',
                    color: '#FFF', fontSize: 20, fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'center', transition: 'all 0.2s',
                    letterSpacing: -0.5,
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = accentColor; e.target.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={e => { e.target.style.borderColor = '#333'; e.target.style.transform = 'scale(1)'; }}
                >{txt}</button>
              ))}
            </div>
            <button onClick={resetAll}
              style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 8, border: '1px solid #E0DDD6', background: '#FFF', color: '#777', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              취소 (발행 안 함)
            </button>
          </div>
        )}

        {/* ══════════ 완료 ══════════ */}
        {pipeStep === 'done' && pipeResult && (
          <div style={{ background: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: 14, padding: '20px', marginBottom: 16, animation: 'fadeIn 0.4s ease' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#276749', marginBottom: 14 }}>✅ 콘텐츠 발행 완료!</div>
            <div style={{ fontSize: 13, color: '#2D2D2D', lineHeight: 2 }}>
              <p style={{ margin: '0 0 6px' }}><strong>제목:</strong> {pipeResult.title}</p>
              {pipeResult.video_url && (
                <p style={{ margin: '0 0 6px' }}>
                  <strong>▶️ YouTube:</strong>{' '}
                  <a href={pipeResult.video_url} target="_blank" rel="noopener noreferrer" style={{ color: '#C53030', fontWeight: 600 }}>{pipeResult.video_url}</a>
                </p>
              )}
              {pipeResult.blog_url && (
                <p style={{ margin: '0 0 6px' }}>
                  <strong>📝 블로그:</strong>{' '}
                  <a href={pipeResult.blog_url} target="_blank" rel="noopener noreferrer" style={{ color: '#C53030', fontWeight: 600 }}>{pipeResult.blog_url}</a>
                </p>
              )}
              {pipeResult.x_url && (
                <p style={{ margin: '0 0 6px' }}>
                  <strong>𝕏 X:</strong>{' '}
                  <a href={pipeResult.x_url} target="_blank" rel="noopener noreferrer" style={{ color: '#C53030', fontWeight: 600 }}>{pipeResult.x_url}</a>
                </p>
              )}
              {pipeResult.thumbnail_text && (
                <p style={{ margin: '0 0 6px' }}><strong>썸네일:</strong> {pipeResult.thumbnail_text}</p>
              )}
              <p style={{ margin: '0' }}>
                <strong>출력:</strong>{' '}
                <code style={{ background: '#E2E8F0', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{pipeResult.output_dir}</code>
              </p>
            </div>
            <button onClick={resetAll}
              style={{ marginTop: 14, padding: '10px 20px', borderRadius: 8, border: '1px solid #C6F6D5', background: '#FFF', color: '#276749', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              🔄 새로운 콘텐츠 만들기
            </button>
          </div>
        )}

        {/* ══════════ 에러 ══════════ */}
        {pipeStep === 'error' && (
          <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 14, padding: '16px', marginBottom: 16, fontSize: 13, color: '#C53030' }}>
            ⚠️ 오류: {pipeError}
            <button onClick={resetAll}
              style={{ display: 'block', marginTop: 10, padding: '8px 16px', borderRadius: 6, border: '1px solid #C53030', background: 'transparent', color: '#C53030', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              다시 시도
            </button>
          </div>
        )}

        {/* ══════════ 쇼츠 탭 끝 ══════════ */}
        </>}

        {/* ══════════════════════════════════════════════
            롱폼 탭
        ══════════════════════════════════════════════ */}
        {activeTab === 'longform' && <>

          {/* ── 롱폼: 입력 (idle) ── */}
          {lfStep === 'idle' && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>

              {/* 모드 표시 */}
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{
                  display: 'inline-block', padding: '4px 16px', borderRadius: 20,
                  background: '#C5303015', border: '1px solid #C5303030',
                  fontSize: 12, fontWeight: 700, color: '#C53030',
                }}>
                  🎬 롱폼 · 이번 주 핵심 발언
                </span>
              </div>

              {/* 영상 제목 + 인트로 */}
              <div style={{ background: '#FFF', borderRadius: 14, padding: '20px', border: '1px solid #E0DDD6', marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, display: 'block' }}>
                  🎬 영상 제목
                </label>
                <input value={lfTitle} onChange={e => setLfTitle(e.target.value)}
                  placeholder="예: 이번 주 핵심 발언 5선"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E0DDD6', fontSize: 14, fontFamily: 'inherit', background: '#FAFAF8', color: '#1A1A1A' }}
                  onFocus={e => e.target.style.borderColor = '#C53030'} onBlur={e => e.target.style.borderColor = '#E0DDD6'}
                />
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginTop: 14, marginBottom: 8, display: 'block' }}>
                  📎 인트로 멘트 <span style={{ fontWeight: 400, color: '#AAA' }}>(선택)</span>
                </label>
                <input value={lfIntro} onChange={e => setLfIntro(e.target.value)}
                  placeholder="예: 이번 주 가장 뜨거웠던 발언 5가지, 팩트로 벱니다."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E0DDD6', fontSize: 13, fontFamily: 'inherit', background: '#FAFAF8', color: '#1A1A1A' }}
                  onFocus={e => e.target.style.borderColor = '#C53030'} onBlur={e => e.target.style.borderColor = '#E0DDD6'}
                />
              </div>

              {/* 클립 1~5 아코디언 */}
              {lfClips.map((clip, idx) => {
                const filled = clip.speaker.trim() || clip.commentary.trim() || clip.videoFile;
                return (
                  <div key={idx} style={{
                    background: '#FFF', borderRadius: 14, border: filled ? '2px solid #C5303050' : '1px solid #E0DDD6',
                    marginBottom: 8, overflow: 'hidden', transition: 'all 0.2s',
                  }}>
                    {/* 아코디언 헤더 */}
                    <button onClick={() => toggleClipExpand(idx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800,
                          background: filled ? '#C53030' : '#E0DDD6', color: filled ? '#FFF' : '#999',
                        }}>{idx + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: clip.speaker ? '#1A1A1A' : '#AAA' }}>
                          {clip.speaker || `클립 ${idx + 1}`}
                        </span>
                        {clip.videoFile && <span style={{ fontSize: 10, color: '#2D8544', fontWeight: 600 }}>✓ 영상</span>}
                      </div>
                      <span style={{ fontSize: 14, color: '#AAA', transition: 'transform 0.2s', transform: clip.expanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                    </button>

                    {/* 아코디언 내용 */}
                    {clip.expanded && (
                      <div style={{ padding: '0 16px 16px', animation: 'fadeIn 0.2s ease' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>발언자 이름</label>
                            <input value={clip.speaker} onChange={e => updateClip(idx, 'speaker', e.target.value)}
                              placeholder="예: 이재명 대통령"
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E0DDD6', fontSize: 12, fontFamily: 'inherit', background: '#FAFAF8' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>발언 자막</label>
                            <input value={clip.subtitle} onChange={e => updateClip(idx, 'subtitle', e.target.value)}
                              placeholder="영상 위에 표시될 자막"
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E0DDD6', fontSize: 12, fontFamily: 'inherit', background: '#FAFAF8' }}
                            />
                          </div>
                        </div>

                        {/* 영상 업로드 */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>발언 영상 (mp4)</label>
                        <div style={{
                          padding: '12px', borderRadius: 10, border: '1.5px dashed #E0DDD6',
                          background: clip.videoFile ? '#F0FFF4' : '#FAFAF8',
                          textAlign: 'center', cursor: 'pointer', marginBottom: 10,
                          transition: 'all 0.2s',
                        }}
                          onClick={() => document.getElementById(`lf-video-${idx}`).click()}
                        >
                          <input id={`lf-video-${idx}`} type="file" accept="video/mp4,video/*" style={{ display: 'none' }}
                            onChange={e => e.target.files[0] && handleVideoUpload(idx, e.target.files[0])}
                          />
                          {clip.videoFile ? (
                            <span style={{ fontSize: 12, color: '#2D8544', fontWeight: 600 }}>🎥 {clip.videoName}</span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#AAA' }}>📁 클릭하여 영상 업로드</span>
                          )}
                        </div>

                        {/* 해설 코멘트 */}
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' }}>해설 코멘트 (TTS 나레이션)</label>
                        <textarea value={clip.commentary} onChange={e => updateClip(idx, 'commentary', e.target.value)}
                          placeholder="BluntEdge가 읽을 나레이션 대본을 입력하세요..."
                          rows={3}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E0DDD6', fontSize: 12, fontFamily: 'inherit', background: '#FAFAF8', resize: 'vertical', lineHeight: 1.7 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 발행 채널 선택 */}
              <div style={{ background: '#FFF', borderRadius: 14, padding: '16px', border: '1px solid #E0DDD6', marginBottom: 12, marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10 }}>📢 발행 채널 선택</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PUBLISH_CHANNELS.map(ch => (
                    <label key={ch.key} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: lfPublish[ch.key] ? '#C5303012' : '#FAFAF8',
                      border: lfPublish[ch.key] ? '2px solid #C53030' : '1.5px solid #E0DDD6',
                      color: lfPublish[ch.key] ? '#C53030' : '#AAA',
                      transition: 'all 0.2s',
                    }}>
                      <input type="checkbox" checked={lfPublish[ch.key]}
                        onChange={e => setLfPublish(p => ({ ...p, [ch.key]: e.target.checked }))}
                        style={{ display: 'none' }} />
                      <span style={{ fontSize: 16 }}>{ch.icon}</span>
                      <span>{ch.label}</span>
                      {lfPublish[ch.key] && <span style={{ fontSize: 14 }}>✓</span>}
                    </label>
                  ))}
                </div>
                {lfPublish.blog && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6 }}>📂 블로그 카테고리</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {BLOG_CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setLfBlogCategory(cat)}
                          style={{
                            flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                            background: lfBlogCategory === cat ? '#C5303015' : '#FAFAF8',
                            border: lfBlogCategory === cat ? '1.5px solid #C53030' : '1px solid #E0DDD6',
                            color: lfBlogCategory === cat ? '#C53030' : '#999',
                          }}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 생성 버튼 */}
              <button onClick={startLongformGeneration}
                disabled={!lfReady}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: lfReady ? 'linear-gradient(135deg, #C53030, #C53030CC)' : '#DDD',
                  color: lfReady ? '#FFF' : '#999',
                  fontSize: 15, fontWeight: 800, cursor: lfReady ? 'pointer' : 'default',
                  fontFamily: 'inherit', transition: 'all 0.2s', letterSpacing: -0.3,
                }}>
                🎬 롱폼 영상 생성 ({lfFilledClips.length}클립)
              </button>

              {/* 클립 요약 */}
              {lfFilledClips.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#888', textAlign: 'center' }}>
                  {lfFilledClips.map((c, i) => c.speaker).filter(Boolean).join(' → ')} · 예상 {lfFilledClips.length * 1}~{lfFilledClips.length * 1.5}분
                </div>
              )}

              {!lfReady && lfFilledClips.length > 0 && !lfFilledClips.every(c => c.videoFile) && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#C53030', textAlign: 'center' }}>
                  ⚠️ 모든 클립에 영상 파일을 업로드해주세요
                </div>
              )}

              {/* 서버 상태 */}
              {serverOnline === false && (
                <div style={{ marginTop: 8, padding: '12px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FED7D7', fontSize: 12, color: '#C53030', lineHeight: 1.6 }}>
                  ⚠️ 로컬 서버가 꺼져 있습니다.
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <code style={{ flex: 1, background: '#1A1A1A', color: '#00FF41', padding: '10px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', display: 'block', lineHeight: 1.5 }}>
                      cd C:\bluntedge-pipeline-v1.0\bluntedge-pipeline && python server.py
                    </code>
                  </div>
                </div>
              )}
              {serverOnline === true && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#2D8544', textAlign: 'center' }}>● 파이프라인 서버 연결됨</div>
              )}
            </div>
          )}

          {/* ── 롱폼: 진행 중 ── */}
          {lfStep === 'rendering' && (
            <div style={{ textAlign: 'center', padding: '50px 0', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ fontSize: 42, marginBottom: 14, animation: 'pulse 1.5s infinite' }}>🎬</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>{lfMsg}<LoadingDots /></div>
              <div style={{ fontSize: 11, color: '#AAA', marginTop: 8 }}>롱폼 합성 모드 · {lfFilledClips.length}클립</div>
            </div>
          )}

          {/* ── 롱폼: 완료 ── */}
          {lfStep === 'done' && lfResult && (
            <div style={{ background: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: 14, padding: '20px', marginBottom: 16, animation: 'fadeIn 0.4s ease' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#276749', marginBottom: 14 }}>✅ 롱폼 콘텐츠 발행 완료!</div>
              <div style={{ fontSize: 13, color: '#2D2D2D', lineHeight: 2 }}>
                <p style={{ margin: '0 0 6px' }}><strong>제목:</strong> {lfResult.title}</p>
                <p style={{ margin: '0 0 6px' }}><strong>길이:</strong> {(lfResult.duration / 60).toFixed(1)}분 · {lfResult.clip_count}클립</p>
                {lfResult.video_url && (
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>▶️ YouTube:</strong>{' '}
                    <a href={lfResult.video_url} target="_blank" rel="noopener noreferrer" style={{ color: '#C53030', fontWeight: 600 }}>{lfResult.video_url}</a>
                  </p>
                )}
                {lfResult.blog_url && (
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>📝 블로그:</strong>{' '}
                    <a href={lfResult.blog_url} target="_blank" rel="noopener noreferrer" style={{ color: '#C53030', fontWeight: 600 }}>{lfResult.blog_url}</a>
                  </p>
                )}
                {lfResult.x_url && (
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>𝕏 X:</strong>{' '}
                    <a href={lfResult.x_url} target="_blank" rel="noopener noreferrer" style={{ color: '#C53030', fontWeight: 600 }}>{lfResult.x_url}</a>
                  </p>
                )}
                <p style={{ margin: '0' }}>
                  <strong>출력:</strong>{' '}
                  <code style={{ background: '#E2E8F0', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{lfResult.output_dir}</code>
                </p>
              </div>
              <button onClick={resetLongform}
                style={{ marginTop: 14, padding: '10px 20px', borderRadius: 8, border: '1px solid #C6F6D5', background: '#FFF', color: '#276749', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                🔄 새로운 롱폼 만들기
              </button>
            </div>
          )}

          {/* ── 롱폼: 에러 ── */}
          {lfStep === 'error' && (
            <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 14, padding: '16px', marginBottom: 16, fontSize: 13, color: '#C53030' }}>
              ⚠️ 오류: {lfError}
              <button onClick={() => { setLfStep('idle'); setLfError(''); }}
                style={{ display: 'block', marginTop: 10, padding: '8px 16px', borderRadius: 6, border: '1px solid #C53030', background: 'transparent', color: '#C53030', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                다시 시도
              </button>
            </div>
          )}

        </>}

        {/* ── Bible ── */}
        <details style={{ marginTop: 20 }}>
          <summary style={{ fontSize: 12, fontWeight: 600, color: '#888', cursor: 'pointer', padding: '8px 0' }}>📖 BluntEdge 바이블 요약 보기</summary>
          <div style={{ background: '#FFF', borderRadius: 10, padding: '14px', border: '1px solid #E5E2DB', marginTop: 8, fontSize: 12, color: '#555', lineHeight: 1.7 }}>
            <p><strong>포지션:</strong> 중도 진보 · 합리적 진보 관점 · 팩트 기반 판단</p>
            <p><strong>톤:</strong> 날카로운 논객 · 직설 + 풍자 · 팩트 퍼스트</p>
            <p><strong>언론:</strong> 보수 언론(조·중·동) 프레이밍 비판 · 진보 언론도 팩트 오류 시 지적</p>
            <p><strong>금기:</strong> 양비론, 인신공격, 감정선동, 미확인정보, 보수 언론 논조 동조</p>
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
          <div style={{ fontSize: 11, color: '#AAA' }}>BluntEdge Content Agent v3.1 · Powered by Claude</div>
        </div>
      </div>
    </div>
  );
}
