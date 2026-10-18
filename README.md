# Double Y 루틴 v6.0

doubley-agent v5.9를 개인 루틴 앱으로 줄인 버전입니다. 사업 운영(전략기획·기획부·에이전트·크리에이터, 05:00 AI 브리핑)은
HANOK 상황판과 비서실장(매일 06:50)으로 옮겼습니다.

남은 기능: 플래너(오늘의 루틴 체크·Top3·할 일·QT), 구글 캘린더, 백업(Google Sheets), 텔레그램 일정 알림.

## 바뀐 점
- 브라우저에서 Claude를 직접 부르던 코드 삭제 → VITE_ANTHROPIC_API_KEY 불필요(Vercel에서 지우세요)
- QT 묵상 도움은 서버 함수 /api/qt 로 이전 (ANTHROPIC_API_KEY 서버 변수 사용)
- 루틴 체크에서 EdgeStats·MarketEdge 제거, "웹소설 집필" → "『패수』 다듬기"
- 텔레그램: 05:00은 AI 없이 루틴 안내, 시간별 알림은 09:00·21:00·23:00 세 개만 (api/_lib/utils.js 의 DEFAULT_SCHEDULE에서 수정)
- 삭제한 API: briefing, editor, planner, researcher, revenue, strategist

## Vercel 환경 변수
- 유지: ANTHROPIC_API_KEY(새로 발급한 키), TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, VITE_GOOGLE_CLIENT_ID(캘린더)
- 삭제: VITE_ANTHROPIC_API_KEY

---

## v6.1 — HANOK 업무 탭 (플래너 연동)

플래너 탭 맨 앞에 **🏢 HANOK 업무**가 생겼습니다. 비서실장이 매일 06:50에 Drive `HANOK 비서실장 > 플래너 연동` 폴더에 올리는 `CEO일정-날짜.json`을 오전·오후 블록으로 보여 주고, 체크·메모는 같은 폴더의 `플래너체크-날짜.json`에 저장되어 다음 날 아침 보고에 반영됩니다.

연결은 Google Apps Script(본인 계정)로 합니다. 코드는 `apps-script/Code.gs`.

### 설정 (한 번만, 약 10분)
1. script.google.com → 새 프로젝트 → 이름 "HANOK 플래너 연동" → `Code.gs` 내용을 통째로 붙여넣기 → 저장
2. 왼쪽 ⚙ 프로젝트 설정 → 스크립트 속성 → 속성 추가: `TOKEN` = 직접 정한 연동 비밀번호(12자 이상)
3. 편집기에서 함수 `setupCheck` 선택 → 실행 → Google 권한 승인(고급 → 이동 → 허용)
4. 배포 → 새 배포 → 유형 "웹 앱" → 실행 사용자: 나 / 액세스: 모든 사용자 → 배포 → 웹 앱 URL 복사
5. 플래너 앱 → HANOK 업무 → 설정에 URL과 비밀번호 입력
6. (알림) Vercel doubley-agent → Environment Variables: `HANOK_SYNC_URL`(웹 앱 URL), `HANOK_SYNC_TOKEN`(같은 비밀번호) 추가 → Redeploy

### 텔레그램 알림 (매시 정각 호출 기준)
- 09:00 오전 블록(09:30–11:30) 할 일
- 14:00 오후 블록(14:00–17:00) 할 일
- 16:00 아직 체크 안 된 일
- 23:00 아이디어 정리 (기존)
