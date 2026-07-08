# Backend

Django 4.2 + Django REST Framework 기반 백엔드입니다. JWT 인증, 아이템/리뷰/유저 API, Django admin을 포함합니다.

## 요구 사항

- Python 3.10 이상
- pip

## 실행

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

기본 주소:

- API root: `http://127.0.0.1:8000/api/`
- health check: `http://127.0.0.1:8000/api/health/`
- admin: `http://127.0.0.1:8000/admin/`

## 환경 개요

- 기본 DB: `backend/db.sqlite3`
- 커스텀 사용자 모델 사용: `accounts.User`
- JWT 인증: `rest_framework_simplejwt`
- 미디어 파일 경로: `backend/media/`
- 로그 파일 경로: `backend/logs/vision.log`

`backend/.env` 파일이 있으면 Django 설정에서 자동으로 읽습니다.

주요 환경 변수 예시:

```env
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5175,http://localhost:5175
DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5175,http://localhost:5175
```

프로덕션에서 `https://ggultem.madcamp-kaist.org` 도메인을 사용할 때 예시:

```env
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=ggultem.madcamp-kaist.org,localhost,127.0.0.1
DJANGO_CORS_ALLOWED_ORIGINS=https://ggultem.madcamp-kaist.org
DJANGO_CSRF_TRUSTED_ORIGINS=https://ggultem.madcamp-kaist.org
```

## 포함된 앱

- `apps.accounts`: 회원가입, 로그인, 로그아웃, 내 정보
- `apps.items`: 아이템 CRUD, 랭킹, 카테고리, 중복 후보, 스크린샷 추출, 변경 요청
- `apps.reviews`: 리뷰, 댓글, 리뷰/댓글 반응
- `apps.user`: 유저 목록/프로필, 팔로우, 팔로워/팔로잉, username 변경
- `apps.recommend`: 추천 API 엔드포인트
- `api`: API 루트와 health check

## 대표 API 경로

- `/api/accounts/`
- `/api/items/`
- `/api/reviews/`
- `/api/user/`
- `/api/recommend/`

## 기타

- 개발 중 `DEBUG=True`일 때 `/media/`를 Django가 직접 서빙합니다.
- 데이터 준비용 management command와 vision 관련 보조 코드가 저장소에 포함되어 있습니다.
