# Frontend

Vite + React 기반 프론트엔드입니다.

## 요구 사항

- Node.js 20 이상 권장
- npm

## 개발 서버 실행

```bash
cd frontend
npm install
npm run dev
```

기본 개발 서버:

```text
http://127.0.0.1:5173
```

## 프로덕션 빌드

```bash
cd frontend
cp .env.production.example .env.production
npm install
npm run build
```

`.env.production` 예시:

```bash
VITE_API_BASE_URL=/api
```

빌드 결과물은 `frontend/dist`에 생성됩니다.

## Nginx 배포

프론트는 `Nginx`가 `dist`를 정적 서빙하고, `/api/`, `/media/`는 Django 백엔드로 프록시하는 구성을 기준으로 합니다.

상세 절차는 [DEPLOY_NGINX.md](/root/workspace/ggultem/DEPLOY_NGINX.md:1)를 참고합니다.
