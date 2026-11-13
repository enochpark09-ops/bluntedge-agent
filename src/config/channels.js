// ── 채널 전환 (v3.8, 2026-11-13) ──
// 앱 하나로 두 채널을 운영한다. 고른 채널은 이 브라우저에만 기억되고, 연결 서버(포트)·색·시리즈·문구가 바뀐다.
// 대본 생성 지침(바이블)은 각 채널 서버의 bible.py가 가진다.

export const CHANNEL_DEFS = {
  bluntedge: {
    id: 'bluntedge',
    name: 'BluntEdge',
    label: '블런트엣지',
    port: 5050,
    emoji: '🔪',
    slogan: '무딘 척하지만, 벤다.',
    tagline: '정치 콘텐츠 에이전트',
    accent: '#C53030',
    ink: '#1A1A1A',
    logoBg: 'linear-gradient(135deg,#2D2D2D,#555)',
    pageBg: '#F0EDEA',
    requireFactcheck: false,
    links: [
      { key: 'youtube', label: '블런트엣지', url: 'https://www.youtube.com/@bluntedge_inJ', icon: '▶️', color: '#FF0000' },
      { key: 'x', label: '@blunt_edge_', url: 'https://x.com/blunt_edge_', icon: '𝕏', color: '#000000' },
      { key: 'blog', label: 'thebluntedge.com', url: 'https://thebluntedge.com/', icon: '📝', color: '#21759B' },
    ],
    series: [
      { id: 'editorial', name: '사설을 벤다', icon: '✂️', desc: '보수 언론 사설 비판', color: '#C53030' },
      { id: 'statement', name: '발언을 벤다', icon: '🎤', desc: '정치인 발언 팩트체크', color: '#D69E2E' },
      { id: 'conspiracy', name: '음모론을 벤다', icon: '🧪', desc: '음모론 검증 (진보 쪽 포함)', color: '#2F855A' },
      { id: 'factline', name: '팩트 한 줄', icon: '📌', desc: '쇼츠 한 줄 팩트 + 반전', color: '#3182CE' },
      { id: 'free', name: '자유 분석', icon: '🔪', desc: '주제 자유 선택', color: '#C53030' },
    ],
    freeLabel: '🔪 BluntEdge 자유 분석',
    bibleSummary: [
      ['포지션', '중도 진보 · 합리적 진보 관점 · 팩트 기반 판단'],
      ['톤', '날카로운 논객 · 직설 + 풍자 · 팩트 퍼스트 · 해요체'],
      ['언론', '보수 언론(조·중·동) 프레이밍 비판 · 진보 언론도 팩트 오류 시 지적'],
      ['사실 확인', '핵심 사실은 출처 2곳 이상 · 미확인 의혹은 의혹으로만'],
      ['금기', '양비론, 인신공격, 감정선동, 미확인정보, 보수 언론 논조 동조, 다른 채널 언급'],
    ],
    publishDefaults: { youtube: true, blog: true, x: true },
    // 사설 모드 지시문
    editorial(paper, context) {
      if (paper.stance === 'conservative') {
        return `[출처: ${paper.name} 사설]
${context}

[핵심 지시 — 반드시 따를 것]
${paper.name}은 보수 언론이다. 이 사설을 BluntEdge의 중도 진보 관점에서 비판적으로 해체하라.
- 이 사설이 설정한 프레임(논조, 전제, 결론 유도)을 찾아내고, 그 프레이밍의 의도를 폭로하라.
- 사설이 주장하는 결론에 동조하지 마라. 같은 팩트라도 BluntEdge는 반대 해석을 내려야 한다.
- 사설이 빠뜨린 팩트, 축소한 맥락, 과장한 부분을 짚어라.
- "이 사설의 진짜 의도는 ~다"라는 식으로 숨겨진 목적을 드러내라.
- 어조: 냉소적이고 날카롭게. 사설의 논리를 조목조목 반박하라.
- 절대로 이 사설의 논조에 동의하거나 수긍하는 문장을 쓰지 마라.`;
      }
      return `[출처: ${paper.name} 사설]
${context}

[지시] 이 사설을 BluntEdge 관점에서 분석하는 스크립트를 만들어줘.`;
    },
  },

  oreunpen: {
    id: 'oreunpen',
    name: '오른펜',
    label: '오른펜',
    port: 5051,
    emoji: '🖋️',
    slogan: '옳은 건 옳게, 틀린 건 빨간 줄로',
    tagline: 'Right Pen 논평 에이전트',
    accent: '#B8901F',
    ink: '#1B2A4A',
    logoBg: 'linear-gradient(135deg,#1B2A4A,#2E4370)',
    pageBg: '#EEF1F6',
    requireFactcheck: true,
    links: [],   // 채널 개설 후 추가
    series: [
      { id: 'redline', name: '오늘의 첨삭', icon: '🖍️', desc: '발언·정책 하나에 빨간 줄', color: '#B8901F' },
      { id: 'conspiracy', name: '음모론 지우개', icon: '🧽', desc: '음모론 검증 (보수 쪽 포함)', color: '#2F855A' },
      { id: 'free', name: '자유 첨삭', icon: '🖋️', desc: '주제 자유 선택', color: '#1B2A4A' },
    ],
    freeLabel: '🖋️ 오른펜 자유 첨삭',
    bibleSummary: [
      ['포지션', '중도우파 · 법치·시장경제·재정 건전성·한미동맹 · 여당·정부를 기록과 숫자로 검증'],
      ['톤', '합니다체 · 차분하고 건조하게 · 강할 땐 짧은 단정문 · 약속 vs 실제'],
      ['자료', '1차 자료 우선 (회의록·보도자료·예산서·판결문·통계·KTV/국회방송) · 보수 언론도 검증 대상'],
      ['사실 확인', '출처 2곳 이상 · ❌ 남으면 발행 불가 · CEO 확인 필수'],
      ['금기', '음모론 단정, 낙인·혐오 표현, 인신공격, 어그로 수식어, 맥락 자르기, 다른 채널 언급'],
    ],
    publishDefaults: { youtube: true, blog: false, x: false },
    editorial(paper, context) {
      return `[출처: ${paper.name} 사설]
${context}

[지시] 이 사설을 오른펜 관점에서 첨삭하는 '오늘의 첨삭' 대본을 써라.
- 사설이 다루는 정부·여당의 발언·정책을 기록(회의록·보도자료·예산·통계)과 맞대라.
- 사설 주장 중 기록과 맞는 것은 맞다고 인정하고, 틀리거나 과장된 것에는 빨간 줄을 그어라. 보수 언론 사설도 그대로 받지 않는다.
- 사설 문장을 그대로 읽지 말고, 확인된 사실만 쓴다. 미확인 내용은 의혹으로만.
- 합니다체, 차분하고 건조하게.`;
    },
  },
};

export function getChannelId() {
  try {
    const v = localStorage.getItem('hanok_channel');
    return CHANNEL_DEFS[v] ? v : 'bluntedge';
  } catch {
    return 'bluntedge';
  }
}

export const CH = CHANNEL_DEFS[getChannelId()];
export const PIPELINE_URL = `http://localhost:${CH.port}`;
export const ACCENT = CH.accent;

export function switchChannel(id) {
  if (!CHANNEL_DEFS[id] || id === CH.id) return;
  try { localStorage.setItem('hanok_channel', id); } catch { /* 저장이 안 되면 이번 화면만 */ }
  window.location.reload();
}
