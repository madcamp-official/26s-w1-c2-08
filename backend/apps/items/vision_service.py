import json
import os
import shutil
import subprocess
import tempfile
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


class VisionExtractionError(Exception):
    pass


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

    codex_bin = _find_codex_bin(env)
    if codex_bin:
        env["VISION_CODEX_BIN"] = codex_bin
        # Keep the user-facing bin dir so the matching `node` binary remains on PATH.
        codex_bin_dir = str(Path(codex_bin).expanduser().parent)
        current_path = env.get("PATH", "")
        path_parts = [part for part in current_path.split(os.pathsep) if part]
        if codex_bin_dir not in path_parts:
            env["PATH"] = os.pathsep.join([codex_bin_dir, *path_parts]) if path_parts else codex_bin_dir

    return env


def _run_command(command):
    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            env=_build_vision_environment(),
        )
    except FileNotFoundError as error:
        raise VisionExtractionError("비전 추출 스크립트를 실행할 수 없습니다.") from error
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "").strip()
        if detail:
            raise VisionExtractionError(detail) from error
        raise VisionExtractionError("스크린샷 AI 추출에 실패했습니다.") from error


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
