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

로컬 개발에서도 프론트는 `/api` 상대경로를 사용하고, `vite` 개발 서버가 이를 기본적으로 `http://127.0.0.1:8000` Django 백엔드로 프록시합니다.

다른 백엔드 주소를 쓰려면:

```bash
VITE_BACKEND_TARGET=http://127.0.0.1:8010 npm run dev
```

백엔드를 같이 띄우려면:

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

기본 개발 서버:

```text
http://127.0.0.1:5175
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

즉 경로 규칙은 개발/배포가 같습니다.

- 개발: `vite`가 `/api`, `/media`를 Django로 프록시
- 배포: `nginx`가 `/api`, `/media`를 gunicorn/Django로 프록시

## Nginx 배포

프론트는 `Nginx`가 `dist`를 정적 서빙하고, `/api/`, `/media/`는 Django 백엔드로 프록시하는 구성을 기준으로 합니다.
