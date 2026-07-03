# Backend

Django REST Framework 기반의 백엔드 서버입니다. 현재는 서버 실행 테스트를 위한 최소 API만 포함되어 있습니다.

## 요구 사항

- Python 3.10 이상
- pip

## 처음 실행하기

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

서버가 실행되면 아래 주소에서 상태 확인 API를 호출할 수 있습니다.

```text
http://127.0.0.1:8000/api/health/
```

정상 응답:

```json
{
  "status": "ok",
  "message": "Backend server is running."
}
```

## 이미 venv가 있는 경우

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

## Git에 올리는 파일

`venv/`, `db.sqlite3`, `__pycache__/` 등 로컬 실행 산출물은 `.gitignore`에 의해 제외됩니다. 팀원은 Git에 올라간 `requirements.txt`와 Django 소스 코드를 기준으로 같은 환경을 다시 만들면 됩니다.
