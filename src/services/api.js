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

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: BLUNTEDGE_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.content?.map((b) => b.text || '').join('\n') || '결과를 생성하지 못했습니다.';
}
