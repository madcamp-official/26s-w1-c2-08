# Frontend

React 19 + Vite 기반 프론트엔드입니다. 개발 환경에서는 `/api`, `/media` 요청을 Django 백엔드로 프록시합니다.

## 요구 사항

- Node.js 20 이상 권장
- npm

## 실행

```bash
cd frontend
npm install
npm run dev
```

기본 개발 서버:

- `http://127.0.0.1:5175`

기본 프록시 대상:

- `http://127.0.0.1:8000`

다른 백엔드를 연결하려면:

```bash
cd frontend
VITE_BACKEND_TARGET=http://127.0.0.1:8010 npm run dev
```

## 빌드

```bash
cd frontend
npm install
VITE_API_BASE_URL=/api npm run build
```

빌드 결과물은 `frontend/dist`에 생성됩니다.

## 주요 화면

- 홈
- 로그인 / 회원가입
- 랭킹
- 아이템 등록
- 아이템 상세
- 리뷰 작성 / 리뷰 상세
- 마이페이지
- 유저 목록 / 유저 프로필
- 팔로워 / 팔로잉 목록
- username 변경

## API 경로 규칙

- 기본 API base URL은 `VITE_API_BASE_URL`이며 지정하지 않으면 `/api`를 사용합니다.
- 개발 서버에서는 `vite.config.js`가 `/api`, `/media`를 백엔드로 프록시합니다.

## 사용 가능한 스크립트

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
