import { useState, useRef, useEffect } from 'react';
import { CHANNEL_PROMPTS } from './config/bible.js';
import { generateContent } from './services/api.js';

// ── Loading dots ──
function LoadingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 400);
    return () => clearInterval(t);
  }, []);
  return <span>{dots}</span>;
}

// ── Tab button ──
function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '12px 6px', border: 'none', borderRadius: 10,
        background: active ? '#1A1A1A' : 'transparent',
        color: active ? '#FFF' : '#777',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Content display with copy ──
function ContentDisplay({ content, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  };

  return (
    <div style={{
      background: '#FAFAF8', border: '1px solid #E5E2DB',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid #E5E2DB',
        background: '#F5F3EE',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>{label}</span>
        <button onClick={handleCopy} style={{
          background: copied ? '#2D8544' : '#2D2D2D',
          color: '#FFF', border: 'none', borderRadius: 6,
          padding: '5px 12px', fontSize: 11, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
        }}>
          {copied ? '✓ 복사됨' : '📋 복사'}
        </button>
      </div>
      <div style={{
        padding: '16px', fontSize: 14, lineHeight: 1.8,
        color: '#2D2D2D', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 500, overflowY: 'auto', fontFamily: 'inherit',
      }}>
        {content}
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [activeTab, setActiveTab] = useState('youtube');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleGenerate = async (channel) => {
    if (!topic.trim()) return;
    setLoading((prev) => ({ ...prev, [channel]: true }));
    setError((prev) => ({ ...prev, [channel]: null }));

    try {
      const text = await generateContent(channel, topic, context);
      setResults((prev) => ({ ...prev, [channel]: text }));
    } catch (err) {
      setError((prev) => ({ ...prev, [channel]: err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, [channel]: false }));
    }
  };

  const generateAll = async () => {
    if (!topic.trim()) return;
    setGeneratingAll(true);
    for (const ch of ['youtube', 'x', 'blog']) {
      await handleGenerate(ch);
    }
    setGeneratingAll(false);
  };

  const channelKeys = ['youtube', 'x', 'blog'];
  const activeConfig = CHANNEL_PROMPTS[activeTab];
  const hasAnyResult = Object.values(results).some(Boolean);

  return (
    <div style={{ minHeight: '100vh', background: '#F0EDEA' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px 60px' }}>

        {/* ── Header ── */}
        <div style={{ padding: '28px 0 20px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #2D2D2D, #555)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, border: '2px solid #C53030',
            }}>🔪</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: -0.5 }}>
              BluntEdge
            </h1>
          </div>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0', fontWeight: 500 }}>
            정치 콘텐츠 에이전트 · "무딘 척하지만, 벤다."
          </p>
        </div>

        {/* ── Input Section ── */}
        <div style={{
          background: '#FFF', borderRadius: 14, padding: '20px',
          border: '1px solid #E0DDD6', marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, display: 'block' }}>
            📰 오늘의 이슈
          </label>
          <input
            ref={inputRef}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 국회 예산안 강행 처리, 한미 정상회담 결과..."
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid #E0DDD6', fontSize: 14, fontFamily: 'inherit',
              background: '#FAFAF8', color: '#1A1A1A', transition: 'border 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#C53030')}
            onBlur={(e) => (e.target.style.borderColor = '#E0DDD6')}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) generateAll(); }}
          />

          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', marginTop: 14, marginBottom: 8, display: 'block' }}>
            📎 추가 맥락 (선택)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="관련 기사 URL, 핵심 수치, 배경 정보 등을 붙여넣으세요..."
            rows={3}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1.5px solid #E0DDD6', fontSize: 13, fontFamily: 'inherit',
              background: '#FAFAF8', color: '#1A1A1A', resize: 'vertical',
              transition: 'border 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#C53030')}
            onBlur={(e) => (e.target.style.borderColor = '#E0DDD6')}
          />

          <button
            onClick={generateAll}
            disabled={!topic.trim() || generatingAll}
            style={{
              width: '100%', marginTop: 14, padding: '12px', borderRadius: 10, border: 'none',
              background: topic.trim() && !generatingAll
                ? 'linear-gradient(135deg, #C53030, #9B2C2C)' : '#DDD',
              color: topic.trim() && !generatingAll ? '#FFF' : '#999',
              fontSize: 14, fontWeight: 700,
              cursor: topic.trim() && !generatingAll ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            {generatingAll ? (
              <span style={{ animation: 'pulse 1.5s infinite' }}>⚡ 3채널 생성 중...</span>
            ) : '⚡ 3채널 한번에 생성'}
          </button>
        </div>

        {/* ── Channel Tabs ── */}
        <div style={{
          display: 'flex', gap: 3, background: '#E5E2DB',
          borderRadius: 12, padding: 3, marginBottom: 16,
        }}>
          {channelKeys.map((ch) => (
            <TabBtn
              key={ch}
              active={activeTab === ch}
              onClick={() => setActiveTab(ch)}
              icon={CHANNEL_PROMPTS[ch].icon}
              label={CHANNEL_PROMPTS[ch].label}
            />
          ))}
        </div>

        {/* ── Single Channel Generate ── */}
        {!results[activeTab] && !loading[activeTab] && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{activeConfig.icon}</div>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>
              {activeConfig.label} 콘텐츠를 생성하려면<br />주제를 입력하고 아래 버튼을 눌러주세요.
            </div>
            <button
              onClick={() => handleGenerate(activeTab)}
              disabled={!topic.trim()}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: topic.trim() ? '#2D2D2D' : '#DDD',
                color: topic.trim() ? '#FFF' : '#999',
                fontSize: 13, fontWeight: 600, cursor: topic.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {activeConfig.label}만 생성
            </button>
          </div>
        )}

        {/* ── Loading State ── */}
        {loading[activeTab] && (
          <div style={{ textAlign: 'center', padding: '40px 0', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ fontSize: 36, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>
              {activeConfig.icon}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>
              BluntEdge가 {activeConfig.label} 작성 중<LoadingDots />
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
              팩트부터 깔고 가는 중입니다
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {error[activeTab] && (
          <div style={{
            background: '#FFF5F5', border: '1px solid #FED7D7',
            borderRadius: 10, padding: '14px 16px', marginBottom: 12,
            fontSize: 13, color: '#C53030',
          }}>
            ⚠️ 오류: {error[activeTab]}
            <button onClick={() => handleGenerate(activeTab)} style={{
              display: 'block', marginTop: 8, padding: '6px 14px',
              borderRadius: 6, border: '1px solid #C53030',
              background: 'transparent', color: '#C53030',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              다시 시도
            </button>
          </div>
        )}

        {/* ── Result ── */}
        {results[activeTab] && !loading[activeTab] && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <ContentDisplay
              content={results[activeTab]}
              label={`${activeConfig.icon} ${activeConfig.label} — BluntEdge`}
            />
            <button onClick={() => handleGenerate(activeTab)} style={{
              width: '100%', marginTop: 12, padding: '10px', borderRadius: 8,
              border: '1px solid #E0DDD6', background: '#FFF', color: '#555',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              🔄 다시 생성
            </button>
          </div>
        )}

        {/* ── Status Bar ── */}
        {hasAnyResult && (
          <div style={{
            marginTop: 20, padding: '12px 14px', borderRadius: 10,
            background: '#FFF', border: '1px solid #E5E2DB',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8 }}>생성 현황</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {channelKeys.map((ch) => (
                <div key={ch} style={{
                  flex: 1, textAlign: 'center', padding: '6px', borderRadius: 6,
                  fontSize: 11, fontWeight: 600,
                  background: results[ch] ? '#F0FFF4' : loading[ch] ? '#FFFBEB' : '#F5F3EE',
                  color: results[ch] ? '#276749' : loading[ch] ? '#975A16' : '#AAA',
                  border: `1px solid ${results[ch] ? '#C6F6D5' : loading[ch] ? '#FEFCBF' : '#E5E2DB'}`,
                }}>
                  {CHANNEL_PROMPTS[ch].icon}{' '}
                  {results[ch] ? '✓ 완료' : loading[ch] ? '생성중' : '대기'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Bible Reference ── */}
        <details style={{ marginTop: 20 }}>
          <summary style={{ fontSize: 12, fontWeight: 600, color: '#888', cursor: 'pointer', padding: '8px 0' }}>
            📖 BluntEdge 바이블 요약 보기
          </summary>
          <div style={{
            background: '#FFF', borderRadius: 10, padding: '14px',
            border: '1px solid #E5E2DB', marginTop: 8,
            fontSize: 12, color: '#555', lineHeight: 1.7,
          }}>
            <p><strong>포지션:</strong> 중도 실용주의 · 진영 논리 거부</p>
            <p><strong>톤:</strong> 날카로운 논객 · 직설 + 풍자 · 팩트 퍼스트</p>
            <p><strong>금기:</strong> 양비론, 인신공격, 감정선동, 미확인정보, 어그로</p>
            <p><strong>구조:</strong> 통념 제시 → 팩트로 뒤집기 → 한 줄 결론</p>
            <p style={{ marginTop: 8, borderTop: '1px solid #EEE', paddingTop: 8 }}>
              <strong>시그니처:</strong><br />
              "팩트부터 깔고 가자" · "핵심은 딱 하나다" · "진짜 문제는 따로 있다"
            </p>
          </div>
        </details>

        {/* ── Footer ── */}
        <div style={{
          marginTop: 30, textAlign: 'center',
          padding: '16px 0', borderTop: '1px solid #E0DDD6',
          fontSize: 11, color: '#AAA',
        }}>
          BluntEdge Content Agent v1.0 · Powered by Claude
        </div>
      </div>
    </div>
  );
}
