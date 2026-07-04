# Nginx Deployment

이 문서는 이 프로젝트를 Ubuntu 서버에서 `gunicorn + nginx`로 배포하는 실제 순서를 정리한 것입니다.

현재 기준 배포 구조:

- 프론트 정적 파일: `/var/www/ggultem/frontend/dist`
- Django static: `/var/www/ggultem/static`
- Django media: `/var/www/ggultem/media`
- Django app: `gunicorn`이 `127.0.0.1:8000`에서 실행
- 외부 접속: `nginx`가 `80` 포트에서 받아서 프론트 정적 파일을 서빙하고 `/api/`, `/admin/`은 Django로 프록시

## 0. 전제

서버 환경:

- Ubuntu 22.04 계열
- 프로젝트 위치: `/root/workspace/ggultem`
- 백엔드 가상환경 위치: `/root/workspace/ggultem/backend/venv`

아래 예시는 서버 IP `172.10.7.176` 기준입니다. 나중에 도메인을 붙이면 IP 대신 도메인으로 바꾸면 됩니다.

## 1. 백엔드 환경 변수 파일 만들기

먼저 비밀키를 생성합니다.

```bash
cd /root/workspace/ggultem/backend
./venv/bin/python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

출력된 값을 복사해서 `.env.production`에 넣습니다.

```bash
cd /root/workspace/ggultem/backend
cat > .env.production <<'EOF'
DJANGO_SECRET_KEY='여기에-생성한-비밀키'
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=172.10.7.176,127.0.0.1,localhost
DJANGO_CORS_ALLOWED_ORIGINS=http://172.10.7.176
DJANGO_CSRF_TRUSTED_ORIGINS=http://172.10.7.176
DJANGO_STATIC_ROOT=/var/www/ggultem/static
DJANGO_MEDIA_ROOT=/var/www/ggultem/media
EOF
```

주의:

- `DJANGO_SECRET_KEY`에 특수문자가 들어갈 수 있으므로 작은따옴표로 감싸는 편이 안전합니다.
- `.env.production`은 `source .env.production`으로 읽기 때문에 셸 문법에 맞아야 합니다.

## 2. 프론트 환경 파일 만들기

프론트는 같은 도메인/IP 기준으로 `/api/...`를 호출하도록 빌드해야 합니다.

```bash
cd /root/workspace/ggultem/frontend
cat > .env.production <<'EOF'
VITE_API_BASE_URL=
EOF
```

`VITE_API_BASE_URL=`를 비워두면 프론트가 현재 접속한 주소 기준으로 `/api/...`를 호출합니다.

## 3. 백엔드 의존성 설치

```bash
cd /root/workspace/ggultem/backend
source venv/bin/activate
python -m pip install -r requirements.txt
```

확인:

```bash
python -c "import django; print(django.get_version())"
python -c "import gunicorn; print(gunicorn.__version__)"
```

## 4. 프론트 빌드

```bash
cd /root/workspace/ggultem/frontend
npm install
npm run build
```

빌드 결과는 `frontend/dist`에 생깁니다.

## 5. nginx 설치

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

확인:

```bash
nginx -v
```

## 6. 배포 디렉터리 준비

`nginx`는 보통 `www-data` 권한으로 실행되므로 `/root/...` 아래 정적 파일을 직접 읽게 두는 것은 적절하지 않습니다. 정적 파일은 `/var/www/ggultem`로 복사합니다.

```bash
sudo install -d /var/www/ggultem/frontend /var/www/ggultem/static /var/www/ggultem/media
```

프론트 빌드 파일 복사:

```bash
sudo cp -a /root/workspace/ggultem/frontend/dist /var/www/ggultem/frontend/
```

기존 업로드 파일 복사:

```bash
sudo cp -a /root/workspace/ggultem/backend/media/. /var/www/ggultem/media/
```

## 7. Django 마이그레이션과 collectstatic

```bash
cd /root/workspace/ggultem/backend
source venv/bin/activate
set -a
source .env.production
set +a
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py check
```

이 단계에서 Django static 파일이 `/var/www/ggultem/static`에 수집됩니다.

## 8. gunicorn 수동 실행으로 1차 확인

처음 한 번은 수동으로 부팅 확인을 하는 편이 안전합니다.

```bash
cd /root/workspace/ggultem/backend
source venv/bin/activate
set -a
source .env.production
set +a
python -m gunicorn config.wsgi:application --bind 127.0.0.1:8000
```

다른 터미널에서 확인:

```bash
curl http://127.0.0.1:8000/api/health/
```

정상이면 응답 예시는 아래와 같습니다.

```json
{"status":"ok","message":"Backend server is running."}
```

수동 확인이 끝나면 `Ctrl+C`로 종료합니다.

중요:

- 수동 `gunicorn`을 띄운 상태에서 바로 `systemd` 서비스까지 올리면 `8000` 포트 충돌이 납니다.
- 꼭 수동 실행본을 먼저 내린 뒤 `systemd`로 넘기세요.

## 9. gunicorn systemd 등록

서비스 파일은 이미 준비돼 있습니다.

- [deploy/systemd/ggultem-gunicorn.service](/root/workspace/ggultem/deploy/systemd/ggultem-gunicorn.service:1)

등록:

```bash
sudo cp /root/workspace/ggultem/deploy/systemd/ggultem-gunicorn.service /etc/systemd/system/ggultem-gunicorn.service
sudo systemctl daemon-reload
sudo systemctl enable --now ggultem-gunicorn
sudo systemctl status ggultem-gunicorn --no-pager
```

정상이면 `Listening at: http://127.0.0.1:8000` 같은 로그가 보여야 합니다.

## 10. nginx 사이트 설정 적용

nginx 설정 파일:

- [deploy/nginx/ggultem.conf](/root/workspace/ggultem/deploy/nginx/ggultem.conf:1)

시스템에 반영:

```bash
sudo cp /root/workspace/ggultem/deploy/nginx/ggultem.conf /etc/nginx/sites-available/ggultem
sudo ln -sfn /etc/nginx/sites-available/ggultem /etc/nginx/sites-enabled/ggultem
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl status nginx --no-pager
```

기본 사이트를 계속 둬도 동작할 수는 있지만, 충돌이나 우선순위 혼란을 줄이려면 나중에 정리하는 편이 낫습니다.

예시:

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

이 단계는 기본 사이트가 실제로 방해될 때만 해도 됩니다.

## 11. 최종 확인

프론트 확인:

```bash
curl -I http://172.10.7.176
```

정상이면 `HTTP/1.1 200 OK`가 나와야 합니다.

API 프록시 확인:

```bash
curl http://172.10.7.176/api/health/
```

정상이면:

```json
{"status":"ok","message":"Backend server is running."}
```

브라우저 확인:

- `http://172.10.7.176`
- `http://172.10.7.176/api/health/`
- `http://172.10.7.176/admin/`

## 12. 배포 후 코드가 바뀌었을 때

프론트 수정 후:

```bash
cd /root/workspace/ggultem/frontend
npm run build
sudo rm -rf /var/www/ggultem/frontend/dist
sudo cp -a /root/workspace/ggultem/frontend/dist /var/www/ggultem/frontend/
```

백엔드 코드 수정 후:

```bash
cd /root/workspace/ggultem/backend
source venv/bin/activate
set -a
source .env.production
set +a
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart ggultem-gunicorn
```

## 13. 장애 확인용 명령

gunicorn 상태:

```bash
systemctl status ggultem-gunicorn --no-pager
journalctl -u ggultem-gunicorn -n 100 --no-pager
```

nginx 상태:

```bash
systemctl status nginx --no-pager
journalctl -u nginx -n 100 --no-pager
nginx -t
```

포트 8000 점유 확인:

```bash
ss -ltnp '( sport = :8000 )'
```

## 14. 자주 발생하는 문제

### `source .env.production`에서 문법 에러가 나는 경우

원인:

- `DJANGO_SECRET_KEY`에 특수문자가 있는데 따옴표가 없음

해결:

- `DJANGO_SECRET_KEY='실제값'` 형태로 감쌉니다.

### `ModuleNotFoundError: No module named 'django'`

원인:

- `venv`가 아닌 다른 파이썬으로 `gunicorn`을 실행함

해결:

```bash
cd /root/workspace/ggultem/backend
source venv/bin/activate
python -m gunicorn config.wsgi:application --bind 127.0.0.1:8000
```

### `DisallowedHost`

원인:

- `.env.production`의 `DJANGO_ALLOWED_HOSTS`에 서버 IP 또는 도메인이 없음

해결:

- 예: `DJANGO_ALLOWED_HOSTS=172.10.7.176,127.0.0.1,localhost`

### nginx는 켜졌는데 정적 파일이 안 보임

원인:

- `nginx`가 `/root/...` 경로를 못 읽음
- `collectstatic`을 안 함

해결:

- 정적 파일은 `/var/www/ggultem/...` 기준으로 배치
- `python manage.py collectstatic --noinput` 다시 실행

## 15. 도메인을 붙일 때 바꿀 값

도메인이 생기면 아래를 같이 수정합니다.

- `backend/.env.production`
  - `DJANGO_ALLOWED_HOSTS`
  - `DJANGO_CORS_ALLOWED_ORIGINS`
  - `DJANGO_CSRF_TRUSTED_ORIGINS`
- `deploy/nginx/ggultem.conf`
  - `server_name`

예:

```env
DJANGO_ALLOWED_HOSTS=example.com,www.example.com,127.0.0.1,localhost
DJANGO_CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com
```

```nginx
server_name example.com www.example.com;
```

그다음 `certbot` 등으로 HTTPS를 붙이면 됩니다.
