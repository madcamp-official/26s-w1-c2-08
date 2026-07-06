# Item Duplicate Detection

## Goal

`itemreg`에서 새 아이템 생성 직전에 기존 `items` DB와의 유사도를 검사해 중복 후보를 찾는다. 후보가 기준치 이상이면 새 아이템 생성 대신 기존 아이템 리뷰 작성으로 유도한다.

## Initial Scope

- 입력값:
  - `name`
  - `shop_or_brand_name`
  - `original_url`
  - `price`
- 출력값:
  - 중복 후보 존재 여부
  - 유사도 점수
  - 사용자에게 보여줄 간단한 사유 문구

## Normalization Rules

문자열 비교 전에 입력값과 DB 값을 동일한 규칙으로 정규화한다.

### Text normalization

- `lower()` 적용
- 양끝 공백 제거
- 괄호/대괄호 안 문구 제거
- `-`, `_`, `/`, `|`, `,` 같은 구분자를 공백으로 통일
- 한글, 영문, 숫자, 공백 외 문자는 제거
- 연속 공백은 한 칸으로 축소

### Promotional phrase removal

다음과 같은 판매성 문구는 비교 신호로 취급하지 않는다.

- `무료배송`
- `당일출고`
- `정품`
- `공식`
- `특가`
- `행사`
- `한정`
- `대용량`
- `1개입`
- `세트`

이 목록은 시작점이다. 실제 데이터에서 과도하게 제거되거나 누락되는 단어가 보이면 조정한다.

### Brand prefix stripping

상품명 앞에 브랜드명이 중복 포함된 경우 한 번 제거한다.

예:

- 브랜드: `moru beauty`
- 원본 상품명: `moru beauty 라벤더 세라마이드 수분크림`
- 정규화 상품명: `라벤더 세라마이드 수분크림`

## Tokenization Rules

- 정규화된 상품명을 공백 기준으로 분리한다.
- 빈 토큰은 제거한다.
- 불용어는 토큰에서도 제거한다.
- 숫자 토큰과 영문+숫자 모델 토큰은 별도로 추출한다.

예:

- 상품명: `나이키 에어맥스 97 화이트 280`
- 토큰: `나이키`, `에어맥스`, `97`, `화이트`, `280`
- 모델 토큰: `97`, `280`

## Scoring Signals

### 1. Exact URL match

- 양쪽 `original_url`가 존재하고 완전 일치하면 사실상 동일 상품으로 취급한다.
- 이 경우 최종 점수는 `1.0`으로 본다.

### 2. Name trigram similarity

- 정규화된 상품명으로 trigram Dice coefficient를 계산한다.
- 띄어쓰기, 일부 오타, 표현 차이에 비교적 강하다.

### 3. Token overlap

- 핵심 단어 집합의 겹침 정도를 본다.
- Jaccard 계열 점수를 사용한다.

### 4. Brand similarity

- 브랜드 완전 일치 시 강한 보너스를 준다.
- 한쪽이 다른 쪽을 포함하는 정도면 약한 보너스를 준다.
- 브랜드가 비어 있으면 감점하지 않는다.

### 5. Price similarity

- 보조 신호로만 사용한다.
- 같은 상품도 판매처별 가격 차이가 있으므로 비중을 작게 둔다.

## Initial Score Formula

`original_url` 완전 일치가 아니면 아래 공식을 사용한다.

```text
score =
    name_trigram_similarity * 0.60 +
    token_overlap_score     * 0.25 +
    brand_similarity        * 0.10 +
    price_similarity        * 0.05
```

## Model Token Adjustment

전자제품이나 옵션형 상품은 모델 번호가 핵심인 경우가 많다. 이름이 비슷해도 모델 토큰이 다르면 감점한다.

- 숫자 토큰이 양쪽에 있고 서로 다르면 감점
- 영문+숫자 모델 토큰이 양쪽에 있고 서로 다르면 감점

예:

- `에어팟 프로 1`
- `에어팟 프로 2`

## Candidate Gate

초기 임계값은 보수적으로 둔다.

- `score >= 0.85`: 후보 채택
- `0.75 <= score < 0.85`: 아래 중 하나 만족 시 후보 채택
  - 브랜드 일치
  - 공통 토큰 2개 이상
  - 모델 토큰 일치
- `score < 0.75`: 제외

## Why Not Use Heavier Methods Yet

초기 구현에서는 아래 방법들을 의도적으로 제외한다.

- 형태소 분석기
- 임베딩 기반 semantic search
- PostgreSQL 확장 의존
- 카테고리별 별도 모델

이유는 다음과 같다.

- 현재 요구사항은 설명 가능한 규칙 기반 판정이 더 중요하다.
- 점수 조정과 테스트 작성이 단순하다.
- 데이터 규모가 크지 않은 단계에서는 운영 복잡도 대비 이득이 작다.
- 후보 노출 용도이므로 완전 자동 병합보다 보수적이고 해석 가능한 결과가 유리하다.

## Test Priorities

- URL 완전 일치
- 브랜드 prefix 제거 후 이름 유사 판정
- 모델 번호 불일치 감점
- 브랜드 일치 보정
- 명확한 비유사 케이스 제외
