// api/qt.js — QT 묵상 도움 (서버에서만 Claude 호출: 키가 브라우저에 노출되지 않음)
import { callClaude } from "./_lib/utils.js";

const SYSTEM = `당신은 기독교 QT(경건의 시간) 묵상을 도와주는 AI입니다.
Enoch님은 바쁜 일상 속에서 매일 QT를 실천하고 있습니다.
말씀을 깊이 묵상할 수 있도록 3가지 질문을 제시하고, 오늘 하루에 적용할 수 있는 실천 방향을 간결하게 제안해주세요.
따뜻하고 격려하는 톤으로, 한국어로 답변하세요.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 허용됩니다" });
  const { verse = "", verseText = "" } = req.body || {};
  if (!String(verse).trim() && !String(verseText).trim()) return res.status(400).json({ error: "말씀을 입력해 주세요" });
  if (String(verse).length + String(verseText).length > 4000) return res.status(400).json({ error: "본문이 너무 깁니다" });
  try {
    const text = await callClaude(SYSTEM, `오늘의 말씀: ${verse}${verseText ? `\n본문: ${verseText}` : ""}\n\n이 말씀으로 QT 묵상을 도와주세요.`, 600);
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: "묵상 도움을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
}
