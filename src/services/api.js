import { BLUNTEDGE_SYSTEM, CHANNEL_PROMPTS } from '../config/bible.js';

// Claude 호출은 로컬 파이프라인 서버를 거칩니다.
// 키는 서버의 .env(ANTHROPIC_API_KEY)에만 있고, 앱에는 넣지 않습니다.
const PIPELINE_URL = 'http://localhost:5050';
const API_URL = `${PIPELINE_URL}/api/claude`;

export async function generateContent(channel, topic, context = '') {
  const chConfig = CHANNEL_PROMPTS[channel];
  if (!chConfig) throw new Error(`Unknown channel: ${channel}`);

  const userMsg = context.trim()
    ? `[주제] ${topic.trim()}\n\n[추가 맥락/참고 정보]\n${context.trim()}\n\n${chConfig.prompt}`
    : `[주제] ${topic.trim()}\n\n${chConfig.prompt}`;

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: BLUNTEDGE_SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
  } catch {
    throw new Error('로컬 서버에 연결할 수 없습니다. 파이프라인 폴더에서 python server.py 를 실행하세요.');
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Error code: ${response.status} - ${errBody}`);
  }

  const data = await response.json();
  return data.content?.map((b) => b.text || '').join('\n') || '결과를 생성하지 못했습니다.';
}
