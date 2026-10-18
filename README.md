# 🔪 BluntEdge — 정치 콘텐츠 에이전트

> "무딘 척하지만, 벤다."

뉴스 주제를 입력하면 **YouTube 숏폼 스크립트 / X 스레드 / 블로그 포스트** 3종을 BluntEdge 톤으로 자동 생성하는 에이전트 앱입니다.

---

## 🚀 빠른 시작 (로컬)

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열고 VITE_ANTHROPIC_API_KEY에 실제 키 입력

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

---

## 📦 GitHub + Vercel 배포

### Step 1: GitHub 레포 생성 & 푸시

```bash
# 프로젝트 폴더에서
git init
git add .
git commit -m "🔪 BluntEdge Agent v1.0"

# GitHub에서 새 레포 생성 후
git remote add origin https://github.com/YOUR_USERNAME/bluntedge-agent.git
git branch -M main
git push -u origin main
```

### Step 2: Vercel 배포

1. [vercel.com](https://vercel.com) 접속 → GitHub 계정 연결
2. **"Add New Project"** → GitHub 레포 선택 (`bluntedge-agent`)
3. **Framework Preset**: `Vite` 자동 감지됨
4. **Environment Variables** 설정:
   - `VITE_ANTHROPIC_API_KEY` = `sk-ant-xxxxx` (실제 키)
5. **Deploy** 클릭

✅ 이후 `main` 브랜치에 push할 때마다 자동 배포됩니다.

---

## 🔐 보안 주의사항

⚠️ **중요**: 이 앱은 클라이언트에서 직접 Anthropic API를 호출합니다.

- `.env` 파일은 **절대 GitHub에 올리지 마세요** (`.gitignore`에 포함됨)
- Vercel 환경변수로 설정한 `VITE_` 접두사 변수는 빌드 시 번들에 포함됩니다
- **개인 사용 전용**으로 운영하거나, 프로덕션 배포 시에는 백엔드 프록시 서버를 통해 API 키를 숨기는 것을 권장합니다

### 프로덕션 보안 강화 (선택)

공개 배포할 경우 Vercel Serverless Function으로 API 키를 숨길 수 있습니다:

```
/api/generate.js → Vercel Serverless Function (서버 환경변수 사용)
프론트엔드 → /api/generate 호출 (키 노출 없음)
```

---

## 📁 프로젝트 구조

```
bluntedge-agent/
├── public/
│   └── favicon.svg
├── src/
│   ├── config/
│   │   └── bible.js          # BluntEdge 바이블 (시스템 프롬프트 + 채널별 포맷)
│   ├── services/
│   │   └── api.js             # Claude API 호출 모듈
│   ├── App.jsx                # 메인 앱 컴포넌트
│   ├── index.css              # 글로벌 스타일
│   └── main.jsx               # React 엔트리포인트
├── .env.example               # 환경변수 템플릿
├── .gitignore
├── index.html
├── package.json
├── vercel.json                # Vercel SPA 라우팅 설정
├── vite.config.js
└── README.md
```

---

## ✏️ 커스터마이징

### 톤/스타일 변경
`src/config/bible.js`의 `BLUNTEDGE_SYSTEM` 수정

### 채널 추가
`src/config/bible.js`의 `CHANNEL_PROMPTS`에 새 채널 객체 추가

### 모델 변경
`src/services/api.js`에서 `model` 값 변경

---

## 📋 향후 계획

- [ ] Vercel Serverless Function으로 API 키 보안 강화
- [ ] 생성 히스토리 로컬 저장
- [ ] 콘텐츠 캘린더 연동
- [ ] 다른 카테고리 에이전트 추가 (스포츠, 경제 등)

---

*BluntEdge Content Agent v1.0*
*더블와이스페이스 · Double Y Space*
