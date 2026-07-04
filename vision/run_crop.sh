#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_IMAGE="${1:-$SCRIPT_DIR/example.png}"
EXTRACTION_JSON="${2:-$SCRIPT_DIR/output.json}"
OUTPUT_IMAGE="${3:-$SCRIPT_DIR/cropped_product.png}"
PYTHON_BIN="${VISION_PYTHON_BIN:-}"

if [[ -z "$PYTHON_BIN" && -x "$SCRIPT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
fi

if [[ -z "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" "$SCRIPT_DIR/crop_product_image.py" "$INPUT_IMAGE" "$EXTRACTION_JSON" "$OUTPUT_IMAGE"
