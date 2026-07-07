#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_IMAGE="${1:-$SCRIPT_DIR/example.png}"
OUTPUT_JSON="${2:-$SCRIPT_DIR/output.json}"
SCHEMA_PATH="$SCRIPT_DIR/schema.json"
PROMPT_PATH="$SCRIPT_DIR/extract_prompt.md"
ENV_PATH="$SCRIPT_DIR/.env"
PROVIDER="${VISION_PROVIDER:-gemini}"
CODEX_BIN="${VISION_CODEX_BIN:-codex}"
GEMINI_MODEL="${VISION_GEMINI_MODEL:-gemini-2.5-flash}"
GEMINI_API_KEY="${VISION_GEMINI_API_KEY:-${GEMINI_API_KEY:-${API_KEY:-}}}"

if [[ -f "$ENV_PATH" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_PATH"
  set +a
fi

PROVIDER="${VISION_PROVIDER:-gemini}"
CODEX_BIN="${VISION_CODEX_BIN:-codex}"
GEMINI_MODEL="${VISION_GEMINI_MODEL:-gemini-2.5-flash}"
GEMINI_API_KEY="${VISION_GEMINI_API_KEY:-${GEMINI_API_KEY:-${API_KEY:-}}}"

if [[ "$PROVIDER" == "codex" && "$CODEX_BIN" == */* ]]; then
  export PATH="$(dirname "$CODEX_BIN"):${PATH:-}"
fi

if [[ ! -f "$INPUT_IMAGE" ]]; then
  echo "input image not found: $INPUT_IMAGE" >&2
  exit 1
fi

if [[ ! -f "$SCHEMA_PATH" ]]; then
  echo "schema not found: $SCHEMA_PATH" >&2
  exit 1
fi

if [[ ! -f "$PROMPT_PATH" ]]; then
  echo "prompt not found: $PROMPT_PATH" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_JSON")"

if [[ "$PROVIDER" == "codex" ]]; then
  if [[ -n "${VISION_CODEX_HOME:-}" ]]; then
    mkdir -p "$VISION_CODEX_HOME"
    export CODEX_HOME="$VISION_CODEX_HOME"
  fi

  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    if ! "$CODEX_BIN" login status >/dev/null 2>&1; then
      echo "codex authentication not found." >&2
      echo "run 'codex login' or set OPENAI_API_KEY before running this script." >&2
      echo "if you need an isolated Codex home, set VISION_CODEX_HOME and log in there." >&2
      exit 1
    fi
  fi
elif [[ "$PROVIDER" == "gemini" ]]; then
  if [[ -z "$GEMINI_API_KEY" ]]; then
    echo "gemini api key not found." >&2
    echo "set VISION_GEMINI_API_KEY, GEMINI_API_KEY, or API_KEY before running this script." >&2
    exit 1
  fi
else
  echo "unsupported vision provider: $PROVIDER" >&2
  echo "supported providers: codex, gemini" >&2
  exit 1
fi

TMP_OUTPUT="$(mktemp)"
cleanup() {
  rm -f "$TMP_OUTPUT"
}
trap cleanup EXIT

if [[ "$PROVIDER" == "codex" ]]; then
  "$CODEX_BIN" exec \
    --ephemeral \
    --skip-git-repo-check \
    --output-schema "$SCHEMA_PATH" \
    --output-last-message "$TMP_OUTPUT" \
    --image "$INPUT_IMAGE" \
    - < "$PROMPT_PATH"
else
  python3 "$SCRIPT_DIR/run_extract_gemini.py" \
    "$INPUT_IMAGE" \
    "$TMP_OUTPUT" \
    "$PROMPT_PATH" \
    "$SCHEMA_PATH" \
    "$GEMINI_API_KEY" \
    "$GEMINI_MODEL"
fi

mv "$TMP_OUTPUT" "$OUTPUT_JSON"
echo "saved extraction result to $OUTPUT_JSON"
