import logging
import json
import os
import shutil
import subprocess
import tempfile
import time
from glob import glob
from pathlib import Path
from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from .models import Item

REPO_ROOT = Path(__file__).resolve().parents[3]
VISION_DIR = REPO_ROOT / "vision"
RUN_EXTRACT_SCRIPT = VISION_DIR / "run_extract.sh"
RUN_CROP_SCRIPT = VISION_DIR / "run_crop.sh"
VISION_ENV_FILE = VISION_DIR / ".env"
logger = logging.getLogger("apps.items.vision")


class VisionExtractionError(Exception):
    def __init__(self, detail, *, error_code="unknown", provider=None, retryable=False, status_code=502):
        super().__init__(detail)
        self.detail = detail
        self.error_code = error_code
        self.provider = provider
        self.retryable = retryable
        self.status_code = status_code


VISION_RETRY_ATTEMPTS = 3
VISION_RETRY_DELAY_SECONDS = 1
GEMINI_API_KEY_FALLBACK_SUFFIXES = tuple(str(index) for index in range(2, 10))


def _truncate_for_log(value, limit=2000):
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[:limit]}...<truncated>"


def _extract_provider_from_command_error():
    return _build_vision_environment().get("VISION_PROVIDER", "unknown")


def _dedupe_non_empty(values):
    seen = set()
    result = []
    for value in values:
        normalized = str(value or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def _parse_api_key_list(raw_value):
    normalized = str(raw_value or "").strip()
    if not normalized:
        return []

    if normalized.startswith("[") and normalized.endswith("]"):
        normalized = normalized[1:-1]

    return [
        part.strip().strip("'\"")
        for part in normalized.split(",")
        if part.strip().strip("'\"")
    ]


def _build_vision_error(detail, *, provider=None):
    normalized_detail = (detail or "").strip() or "스크린샷 AI 추출에 실패했습니다."
    provider = provider or _extract_provider_from_command_error()
    lower_detail = normalized_detail.lower()

    if "too many requests" in lower_detail or '"code":"too_many_requests"' in lower_detail:
        return VisionExtractionError(
            "현재 AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
            error_code="too_many_requests",
            provider=provider,
            retryable=False,
            status_code=429,
        )

    if "internal server error" in lower_detail or '"code":"api_error"' in lower_detail:
        return VisionExtractionError(
            "AI 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            error_code="api_error",
            provider=provider,
            retryable=True,
            status_code=502,
        )

    if "timed out" in lower_detail or "temporary failure" in lower_detail:
        return VisionExtractionError(
            "AI 서버 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.",
            error_code="temporary_network_error",
            provider=provider,
            retryable=True,
            status_code=502,
        )

    if "gemini api key not found" in lower_detail:
        return VisionExtractionError(
            "AI API 키가 설정되지 않았습니다.",
            error_code="missing_api_key",
            provider=provider,
            retryable=False,
            status_code=502,
        )

    if "api_key_invalid" in lower_detail or "api key not valid" in lower_detail:
        return VisionExtractionError(
            "Gemini API 키가 유효하지 않습니다. AI Studio에서 발급된 올바른 키인지 확인해 주세요.",
            error_code="invalid_api_key",
            provider=provider,
            retryable=False,
            status_code=502,
        )

    return VisionExtractionError(
        normalized_detail,
        error_code="unknown",
        provider=provider,
        retryable=False,
        status_code=502,
    )


def _normalize_extracted_category(category):
    normalized = str(category or "").strip()
    if normalized in Item.Category.values:
        return normalized
    return Item.Category.ETC


def _find_codex_bin(env):
    configured = env.get("VISION_CODEX_BIN")
    if configured:
        configured_path = Path(configured).expanduser()
        if configured_path.is_file():
            return str(configured_path)

    resolved = shutil.which("codex", path=env.get("PATH"))
    if resolved:
        return resolved

    home_dir = Path(env.get("HOME") or Path.home()).expanduser()
    nvm_matches = sorted(
        glob(str(home_dir / ".nvm" / "versions" / "node" / "*" / "bin" / "codex")),
        reverse=True,
    )
    if nvm_matches:
        return nvm_matches[0]

    return None


def _build_vision_environment():
    env = os.environ.copy()
    env.setdefault("HOME", str(Path.home()))
    env.setdefault("PATH", os.defpath)
    env.setdefault("VISION_PROVIDER", env.get("VISION_PROVIDER", "gemini"))
    env_file_values = {}

    if VISION_ENV_FILE.is_file():
        for raw_line in VISION_ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'\"")
            if key and value:
                env_file_values[key] = value
                env[key] = value

    if env["VISION_PROVIDER"] == "codex":
        codex_bin = _find_codex_bin(env)
        if codex_bin:
            env["VISION_CODEX_BIN"] = codex_bin
            # Keep the user-facing bin dir so the matching `node` binary remains on PATH.
            codex_bin_dir = str(Path(codex_bin).expanduser().parent)
            current_path = env.get("PATH", "")
            path_parts = [part for part in current_path.split(os.pathsep) if part]
            if codex_bin_dir not in path_parts:
                env["PATH"] = os.pathsep.join([codex_bin_dir, *path_parts]) if path_parts else codex_bin_dir

    if not env.get("VISION_GEMINI_API_KEY"):
        for key_name in ("GEMINI_API_KEY", "API_KEY"):
            if env.get(key_name):
                env["VISION_GEMINI_API_KEY"] = env[key_name]
                break

    env["_VISION_ENV_KEYS"] = json.dumps(env_file_values, ensure_ascii=False, sort_keys=True)

    return env


def _build_gemini_api_key_candidates(env):
    env_file_values = json.loads(env.get("_VISION_ENV_KEYS", "{}"))
    candidates = []
    has_env_file_key_list = any(
        env_file_values.get(key_name)
        for key_name in ("VISION_GEMINI_API_KEYS", "GEMINI_API_KEYS", "API_KEYS")
    )

    def add_candidate(value, source):
        candidates.append({"value": value, "source": source})

    if not has_env_file_key_list:
        add_candidate(env.get("VISION_GEMINI_API_KEY"), "VISION_GEMINI_API_KEY")
        if "GEMINI_API_KEY" not in env_file_values:
            add_candidate(env.get("GEMINI_API_KEY"), "GEMINI_API_KEY")
        if "API_KEY" not in env_file_values:
            add_candidate(env.get("API_KEY"), "API_KEY")

    list_keys = (
        "VISION_GEMINI_API_KEYS",
        "GEMINI_API_KEYS",
        "API_KEYS",
    )
    for key_name in list_keys:
        raw_value = env.get(key_name, "")
        if raw_value:
            for index, value in enumerate(_parse_api_key_list(raw_value), start=1):
                add_candidate(value, f"{key_name}[{index}]")

    numbered_keys = ("VISION_GEMINI_API_KEY", "GEMINI_API_KEY", "API_KEY")
    for suffix in GEMINI_API_KEY_FALLBACK_SUFFIXES:
        for key_name in numbered_keys:
            full_key_name = f"{key_name}_{suffix}"
            add_candidate(env.get(full_key_name), full_key_name)

    deduped_candidates = []
    seen = set()
    for candidate in candidates:
        normalized = str(candidate["value"] or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped_candidates.append(
            {
                "value": normalized,
                "source": candidate["source"],
            }
        )
    return deduped_candidates


def _build_vision_execution_environments():
    base_env = _build_vision_environment()
    if base_env.get("VISION_PROVIDER") != "gemini":
        return [{"env": base_env, "api_key_source": None}]

    api_keys = _build_gemini_api_key_candidates(base_env)
    if not api_keys:
        return [{"env": base_env, "api_key_source": None}]

    execution_envs = []
    for api_key in api_keys:
        env = base_env.copy()
        env["VISION_GEMINI_API_KEY"] = api_key["value"]
        execution_envs.append(
            {
                "env": env,
                "api_key_source": api_key["source"],
            }
        )
    return execution_envs


def _run_command(command):
    execution_envs = _build_vision_execution_environments()
    provider = execution_envs[0]["env"].get("VISION_PROVIDER", "unknown")
    try:
        for key_index, execution_env_meta in enumerate(execution_envs, start=1):
            execution_env = execution_env_meta["env"]
            api_key_source = execution_env_meta["api_key_source"]
            should_fallback_to_next_key = False
            for attempt in range(1, VISION_RETRY_ATTEMPTS + 1):
                try:
                    subprocess.run(
                        command,
                        check=True,
                        capture_output=True,
                        text=True,
                        cwd=REPO_ROOT,
                        env=execution_env,
                    )
                    return
                except subprocess.CalledProcessError as error:
                    detail = (error.stderr or error.stdout or "").strip()
                    vision_error = _build_vision_error(detail, provider=provider)
                    logger.exception(
                        "Vision command failed | context=%s",
                        json.dumps(
                            {
                                "api_key_slot": key_index,
                                "api_key_slots_total": len(execution_envs),
                                "api_key_source": api_key_source,
                                "attempt": attempt,
                                "command": command,
                                "cwd": str(REPO_ROOT),
                                "error_code": vision_error.error_code,
                                "provider": vision_error.provider,
                                "retryable": vision_error.retryable,
                                "returncode": error.returncode,
                                "stdout": _truncate_for_log(error.stdout),
                                "stderr": _truncate_for_log(error.stderr),
                            },
                            ensure_ascii=False,
                            sort_keys=True,
                        ),
                    )
                    if (
                        provider == "gemini"
                        and vision_error.error_code == "too_many_requests"
                        and key_index < len(execution_envs)
                    ):
                        logger.warning(
                            "Falling back to next Gemini API key after quota exhaustion | context=%s",
                            json.dumps(
                                {
                                    "command": command,
                                    "current_api_key_slot": key_index,
                                    "current_api_key_source": api_key_source,
                                    "next_api_key_slot": key_index + 1,
                                    "next_api_key_source": execution_envs[key_index]["api_key_source"],
                                    "provider": vision_error.provider,
                                },
                                ensure_ascii=False,
                                sort_keys=True,
                            ),
                        )
                        should_fallback_to_next_key = True
                        break
                    if not vision_error.retryable or attempt == VISION_RETRY_ATTEMPTS:
                        raise vision_error from error
                    logger.warning(
                        "Retrying vision command after transient failure | context=%s",
                        json.dumps(
                            {
                                "api_key_slot": key_index,
                                "api_key_source": api_key_source,
                                "attempt": attempt,
                                "command": command,
                                "error_code": vision_error.error_code,
                                "next_attempt": attempt + 1,
                                "provider": vision_error.provider,
                            },
                            ensure_ascii=False,
                            sort_keys=True,
                        ),
                    )
                    time.sleep(VISION_RETRY_DELAY_SECONDS)
            if should_fallback_to_next_key:
                continue
            break
    except FileNotFoundError as error:
        logger.exception(
            "Vision command executable missing | context=%s",
            json.dumps(
                {
                    "command": command,
                    "cwd": str(REPO_ROOT),
                    "error_code": "command_not_found",
                    "provider": provider,
                    "retryable": False,
                },
                ensure_ascii=False,
                sort_keys=True,
            ),
        )
        raise VisionExtractionError(
            "비전 추출 스크립트를 실행할 수 없습니다.",
            error_code="command_not_found",
            provider=provider,
            retryable=False,
            status_code=502,
        ) from error


def _save_uploaded_file(uploaded_file, destination):
    with destination.open("wb") as file_obj:
        for chunk in uploaded_file.chunks():
            file_obj.write(chunk)


def _store_cropped_image(cropped_path):
    extension = cropped_path.suffix.lower() or ".png"
    storage_path = f"ai-item-crops/{uuid4().hex}{extension}"
    saved_path = default_storage.save(storage_path, ContentFile(cropped_path.read_bytes()))
    return default_storage.url(saved_path)


def extract_item_info_from_screenshot(uploaded_file):
    if not RUN_EXTRACT_SCRIPT.is_file() or not RUN_CROP_SCRIPT.is_file():
        raise VisionExtractionError("vision 스크립트 파일을 찾을 수 없습니다.")

    suffix = Path(uploaded_file.name or "screenshot.png").suffix or ".png"

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        screenshot_path = temp_dir_path / f"input{suffix}"
        output_json_path = temp_dir_path / "output.json"
        cropped_path = temp_dir_path / "cropped.png"

        _save_uploaded_file(uploaded_file, screenshot_path)
        _run_command(["bash", str(RUN_EXTRACT_SCRIPT), str(screenshot_path), str(output_json_path)])
        _run_command(
            [
                "bash",
                str(RUN_CROP_SCRIPT),
                str(screenshot_path),
                str(output_json_path),
                str(cropped_path),
            ]
        )

        payload = json.loads(output_json_path.read_text(encoding="utf-8"))
        cropped_image_url = _store_cropped_image(cropped_path)

    return {
        "product_name": payload.get("product_name", "").strip(),
        "category": _normalize_extracted_category(payload.get("category")),
        "shop_name": payload.get("shop_name", "").strip(),
        "price_text": payload.get("price_text", "").strip(),
        "price_value": payload.get("price_value"),
        "cropped_image_url": cropped_image_url,
        "confidence": payload.get("confidence") or {},
        "warnings": payload.get("warnings") or [],
    }
