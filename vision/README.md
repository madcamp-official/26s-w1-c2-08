# Vision Pipeline

온라인 쇼핑몰 스크린샷에서 상품 정보를 추출하는 파이프라인입니다. 기본 provider는 `gemini`이고, 필요하면 `codex`로 전환할 수 있습니다.

기본 입력 파일은 [example.png](/root/workspace/ggultem/vision/example.png) 입니다.

실행:

```bash
bash vision/run_extract.sh
```

다른 입력/출력 파일 지정:

```bash
bash vision/run_extract.sh vision/example.png vision/output.json
```

Gemini로 실행:

```bash
VISION_PROVIDER=gemini GEMINI_API_KEY=your_key bash vision/run_extract.sh
```

출력 JSON 필드:

- `product_name`
- `shop_name`
- `price_text`
- `price_value`
- `product_image_bbox`
- `confidence`
- `warnings`

현재 단계에서는 bbox만 추출합니다. 실제 이미지 crop은 별도 코드에서 이 좌표를 사용해 처리하면 됩니다.

crop 실행:

```bash
bash vision/run_crop.sh
```

다른 입력/출력 파일 지정:

```bash
bash vision/run_crop.sh vision/example.png vision/output.json vision/cropped_product.png
```

주의:

- `VISION_PROVIDER` 기본값은 `gemini` 입니다. `codex`, `gemini` 두 provider를 지원합니다.
- `codex`는 기본적으로 현재 로그인된 Codex 인증을 그대로 사용합니다.
- `codex`에서 격리된 홈 디렉터리가 필요하면 `VISION_CODEX_HOME=/some/path bash vision/run_extract.sh` 형태로 실행하고, 그 홈에서 `codex login` 또는 `OPENAI_API_KEY` 설정을 먼저 해둬야 합니다.
- `gemini`는 `VISION_GEMINI_API_KEY`, `GEMINI_API_KEY`, `API_KEY` 중 하나가 필요합니다. 모델은 `VISION_GEMINI_MODEL`으로 바꿀 수 있고 기본값은 `gemini-2.5-flash` 입니다.
- crop 단계는 `Pillow`가 필요합니다. `vision/.venv`를 만들고 `Pillow`를 설치해뒀으며, `run_crop.sh`는 그 인터프리터를 자동 우선 사용합니다.
