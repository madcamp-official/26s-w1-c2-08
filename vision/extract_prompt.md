온라인 쇼핑몰 상품 상세 스크린샷에서 상품 정보를 추출하라.

반드시 JSON 객체 하나만 반환하라.
설명 문장, 코드펜스, 마크다운은 금지한다.
모르는 값은 추측하지 말고 빈 문자열 또는 null로 둔다.

반환 스키마 의미:
- `product_name`: 실제 판매 상품명. 브랜드명이나 쇼핑몰명이 별도 필드(`shop_name`)에 있으면 앞에 중복해서 붙이지 않는다.
- `category`: 다음 중 하나만 반환한다. `fashion`, `food`, `beauty`, `electronics`, `appliances`, `living`, `health`, `sports`, `books_hobby`, `kids_pets`, `etc`
- `shop_name`: 쇼핑몰명 또는 브랜드명
- `price_text`: 화면에 보이는 대표 가격 원문
- `price_value`: 가격 숫자 정수값. 불확실하면 null
- `product_image_bbox`: 대표 상품 이미지의 픽셀 좌표. `{x, y, width, height}`. 찾지 못하면 null
- `confidence`: 각 필드의 신뢰도. 0부터 1까지
- `warnings`: 애매한 점이나 추출 실패 이유 목록

추출 규칙:
1. 광고, 추천 상품, 리뷰 이미지, 배너는 무시한다.
2. 가격이 여러 개면 현재 판매가로 보이는 값을 우선한다.
3. 쿠폰가, 회원가, 정가가 섞여 있으면 `warnings`에 기록한다.
4. 상품 이미지는 주변 UI를 최대한 제외한 대표 상품 사진 기준으로 bbox를 잡는다.
5. bbox 좌표는 입력 이미지의 실제 픽셀 기준으로 반환한다.
6. 카테고리는 반드시 위 허용값 중 하나만 사용한다. 적절한 카테고리가 없으면 `etc`를 반환한다.
7. 확신이 낮으면 빈 값 또는 null을 반환하고 `warnings`에 이유를 남긴다.
