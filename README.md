# 26s-w1-c2-08

## 공통과제 I : 웹 기반 프로젝트 (2인 1팀)

**목적:** 공통 과제를 함께 수행하며 웹 개발의 전체 흐름을 빠르게 익히고 협업에 적응하기

**결과물:** 기획부터 배포까지 완료된 웹 서비스와 관련 문서 일체

---

## 팀원

| 이름 | GitHub | 역할 |
|------|--------|------|
|박채훈|-|-|
|이서영|-|-|
|최재윤|-|-|

---

## 기획안

> 프로젝트 주제, 목적, 핵심 기능, 예상 사용자, 팀원별 역할 등 정리

- **주제:**

아이템 추천 웹 서비스
- **목적:**

기존 commercial 서비스와 다르게 아이템 중심이 아닌 User 중심의 생태계로 특정 아이템에서 영향력이 있는 사람의 추천목록 그리고 여러 사람들이 좋아한 아이템을 쉽게 보여주고자 한다. 
- **핵심 기능:**
  - 아이템 등록/탐색: 유저가 구매 사이트를 캡처해서 올리면 AI가 브랜드, 아이템 정보를 인식해 등록
  - User 피드: 카테고리별 공감수 기반 아이템 랭킹
  - 팔로우: 특정 카테고리에서 영향력 있는 유저를 팔로우해 그들의 추천을 지속적으로 받아보기
  - 리뷰/평가 : 아이템에 대한 다른 유저들의 코멘트, 추가 정보

- **예상 사용자:**
  - 웹 검색을 할 수 있고 특정 카테고리에서 어떤 아이템이 좋을지 알아보고 싶은 사람
  - 여러 SNS를 돌아다니며 추천 콘텐츠를 찾는 데 피로를 느끼는 사람
  - 특정 분야에 신뢰하는 인플루언서/유저의 추천을 따라가고 싶은 사람
---

## 기능 명세서

> 구현할 기능을 사용자 관점에서 정리하고, 필수 기능과 선택 기능을 구분

### 필수 기능

- [ ]

### 선택 기능

- [ ]

---

## IA 및 화면 설계서

> 서비스의 전체 페이지 구조와 페이지 간 이동 흐름; 각 페이지의 주요 UI 구성, 입력 요소, 버튼, 사용자 행동 흐름 등을 간단한 와이어프레임 형태로 정리

<!-- Figma 링크 또는 이미지 첨부 -->

---

## DB 스키마

> 필요한 테이블, 주요 필드, 데이터 타입, 테이블 간 관계를 정리

<!-- ERD 이미지 또는 테이블 정의 -->

---

## API 문서

> API 주소, 요청 방식, 요청값, 응답값, 에러 상황을 정리

| Method | Endpoint | 설명 | 요청 | 응답 |
|---|---|---|---|---|
|  |  |  |  |  |

---

## 배포 결과물

> 접속 가능한 링크, 실행 방법, 주요 구현 내용

- **서비스 URL:**
- **실행 방법:**

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

상태 확인 API:

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

### Frontend

```bash
cd frontend
npm install
npm run dev
```

개발 서버 기본 주소:

```text
http://localhost:5173/
```

Backend 상세 실행 방법은 `backend/README.md`를 참고합니다.

---

## 회고 문서

> 개발 과정에서의 어려움, 해결 방법, 역할 분담, 다음에 개선할 점 (KPT 방법론 참고)

### Keep

### Problem

### Try

---

## 참고 자료

- [SDD(스펙 주도 개발) 이해하기](https://news.hada.io/topic?id=21338)
- [Software Design Document Best Practices](https://www.atlassian.com/work-management/project-management/design-document)
- [IA 정보구조도 작성 방법](https://brunch.co.kr/@nyonyo/7)
- [기획자 화면설계서 작성법](https://brunch.co.kr/@soup/10)
- [Figma 와이어프레임 가이드](https://www.figma.com/ko-kr/resource-library/what-is-wireframing/)
- [무료 Figma 와이어프레임 키트](https://www.figma.com/ko-kr/templates/wireframe-kits/)
- [ERD/DB 설계 총정리](https://inpa.tistory.com/entry/DB-%F0%9F%93%9A-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%AA%A8%EB%8D%B8%EB%A7%81-%EA%B0%9C%EB%85%90-ERD-%EB%8B%A4%EC%9D%B4%EC%96%B4%EA%B7%B8%EB%9E%A8)
- [API 명세서 작성 가이드라인](https://velog.io/@sebinChu/BackEnd-API-%EB%AA%85%EC%84%B8%EC%84%9C-%EC%9E%91%EC%84%B1-%EA%B0%80%EC%9D%B4%EB%93%9C-%EB%9D%BC%EC%9D%B8)
- [좋은 README 작성하는 방법](https://velog.io/@sabo/good-readme)
- [단기 프로젝트 회고 KPT 방법론](https://velog.io/@habwa/%EB%8B%A8%EA%B8%B0-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%ED%9A%8C%EA%B3%A0-KPT-%EB%B0%A9%EB%B2%95%EB%A1%A0)
