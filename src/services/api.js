import { BLUNTEDGE_SYSTEM, CHANNEL_PROMPTS } from '../config/bible.js';

const API_URL = 'https://api.anthropic.com/v1/messages';

export async function generateContent(channel, topic, context = '') {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'API 키가 설정되지 않았습니다. .env 파일에 VITE_ANTHROPIC_API_KEY를 추가하세요.'
    );
  }

  const chConfig = CHANNEL_PROMPTS[channel];
  if (!chConfig) throw new Error(`Unknown channel: ${channel}`);

  const userMsg = context.trim()
    ? `[주제] ${topic.trim()}\n\n[추가 맥락/참고 정보]\n${context.trim()}\n\n${chConfig.prompt}`
    : `[주제] ${topic.trim()}\n\n${chConfig.prompt}`;

  // ── 1단계: 웹서치로 보수 언론 보도 + 진보 언론 보도를 함께 수집 ──
  const searchResponse = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: `너는 한국 정치 이슈 리서처다. 주어진 주제에 대해 웹 검색을 실시하여 다음을 수집하라:
1. 보수 언론(조선일보, 중앙일보, 동아일보)의 보도 내용과 프레이밍
2. 진보 언론(한겨레, 경향신문) 또는 팩트체크 매체의 보도 내용
3. 공식 정부/기관 발표 내용

검색 결과를 바탕으로 다음 형식으로 정리하라:

[보수 언론 프레이밍]
- 어떤 매체가 어떤 논조로 보도했는지
- 어떤 프레임을 설정했는지 (예: "세금 폭탄", "포퓰리즘", "안보 위기" 등)
- 선택적으로 강조하거나 빠뜨린 팩트가 있는지

[진보/중립 언론 보도]
- 같은 사안에 대해 어떤 맥락을 추가했는지
- 보수 언론과 어떤 차이가 있는지

[팩트 정리]
- 확인된 객관적 사실들
- 양측 보도에서 공통으로 인정하는 팩트

한국어로 작성하라.`,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `다음 주제에 대해 보수 언론과 진보 언론의 보도를 비교 검색해줘:\n\n${topic.trim()}` }],
    }),
  });

  let mediaAnalysis = '';
  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    mediaAnalysis = searchData.content
      ?.map((b) => b.text || '')
      .filter(Boolean)
      .join('\n');
  }

  // ── 2단계: 수집된 언론 분석을 기반으로 BluntEdge 콘텐츠 생성 ──
  const enrichedUserMsg = mediaAnalysis
    ? `[주제] ${topic.trim()}\n\n[언론 보도 분석 — 아래 내용을 기반으로 보수 언론 프레이밍을 해체하라]\n${mediaAnalysis}\n\n${context.trim() ? `[사용자 추가 맥락]\n${context.trim()}\n\n` : ''}${chConfig.prompt}`
    : userMsg;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: BLUNTEDGE_SYSTEM,
      messages: [{ role: 'user', content: enrichedUserMsg }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.content?.map((b) => b.text || '').join('\n') || '결과를 생성하지 못했습니다.';
}
