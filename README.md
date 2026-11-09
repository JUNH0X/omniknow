# PROJECT OMNIKNOW

자율형 인터넷 조사·지식 축적 AI 시스템 (Autonomous Internet Research & Knowledge Accumulation AI System)

## 현재 단계
MVP 초기: 주제(Topic) CRUD 기반 + Cloudflare Workers + D1

## 기술 스택
- Frontend: 단일 `public/index.html` (다크 테마 대시보드)
- Backend: Cloudflare Workers
- Database: Cloudflare D1 (SQLite 호환)
- 로컬 개발: Wrangler

## 설정 방법

1. Cloudflare 계정에서 D1 데이터베이스 생성:
   ```bash
   wrangler d1 create omniknow-db
   ```
   생성 후 나온 `database_id`를 `wrangler.toml`에 입력하세요.

2. 로컬 개발:
   ```bash
   npm install -g wrangler
   wrangler login
   wrangler d1 migrations apply omniknow-db --local
   wrangler dev
   ```

3. 배포:
   ```bash
   wrangler deploy
   ```

## API Endpoints
- `GET /api/health` - 서버 상태
- `GET /api/topics` - 주제 목록
- `POST /api/topics` - 주제 생성
- `PATCH /api/topics/:id` - 주제 수정
- `DELETE /api/topics/:id` - 주제 삭제

프론트엔드는 같은 원신에서 서빙됩니다.
