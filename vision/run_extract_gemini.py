#!/usr/bin/env python3

import base64
import json
import mimetypes
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


REQUIRED_FIELDS = {
    "product_name",
    "category",
    "shop_name",
    "price_text",
    "price_value",
    "product_image_bbox",
    "confidence",
    "warnings",
}


def _extract_text(payload):
    output_text = payload.get("output_text")
    if output_text:
        return output_text

    steps = payload.get("steps") or []
    for step in steps:
        for item in step.get("content") or []:
            text = item.get("text")
            if text:
                return text

    for item in payload.get("output", []):
        text = item.get("text")
        if text:
            return text

    for candidate in payload.get("candidates", []):
        content = candidate.get("content") or {}
        for part in content.get("parts", []):
            text = part.get("text")
            if text:
                return text
    preview = json.dumps(payload, ensure_ascii=False)[:4000]
    raise RuntimeError(f"Gemini response did not include a text payload. payload={preview}")


def _strip_code_fences(text):
    stripped = text.strip()
    if stripped.startswith("```") and stripped.endswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            return "\n".join(lines[1:-1]).strip()
    return stripped


def _load_json_output(text):
    payload = json.loads(_strip_code_fences(text))
    if not isinstance(payload, dict):
        raise RuntimeError("Gemini response was not a JSON object.")

    missing_fields = REQUIRED_FIELDS - payload.keys()
    if missing_fields:
        missing_list = ", ".join(sorted(missing_fields))
        raise RuntimeError(f"Gemini response is missing required fields: {missing_list}")

    return payload


def _sanitize_schema(schema):
    if isinstance(schema, bool):
        return schema

    if isinstance(schema, list):
        return [_sanitize_schema(item) for item in schema]

    if not isinstance(schema, dict):
        return schema

    schema = dict(schema)
    schema.pop("$schema", None)
    schema.pop("additionalProperties", None)

    schema_type = schema.get("type")
    if isinstance(schema_type, list):
        variants = []
        for item_type in schema_type:
            if item_type == "null":
                variants.append({"type": "null"})
            else:
                variant = {key: value for key, value in schema.items() if key != "type"}
                variant["type"] = item_type
                variants.append(_sanitize_schema(variant))
        return {"anyOf": variants}

    allowed_keys = {
        "type",
        "properties",
        "items",
        "required",
        "enum",
        "description",
        "anyOf",
        "minimum",
        "maximum",
        "minItems",
        "maxItems",
        "title",
    }

    sanitized = {}
    for key, value in schema.items():
        if key not in allowed_keys:
            continue
        if key == "properties":
            sanitized[key] = {
                property_name: _sanitize_schema(property_schema)
                for property_name, property_schema in value.items()
            }
        elif key in {"items", "anyOf"}:
            sanitized[key] = _sanitize_schema(value)
        else:
            sanitized[key] = value

    return sanitized


def _build_request(prompt_path, image_path, schema_path):
    prompt_text = prompt_path.read_text(encoding="utf-8")
    schema = _sanitize_schema(json.loads(schema_path.read_text(encoding="utf-8")))
    mime_type = mimetypes.guess_type(image_path.name)[0] or "image/png"
    image_data = base64.b64encode(image_path.read_bytes()).decode("ascii")

    return {
        "model": None,
        "input": [
            {
                "type": "text",
                "text": prompt_text,
            },
            {
                "type": "image",
                "data": image_data,
                "mime_type": mime_type,
            },
        ],
        "response_format": {
            "type": "text",
            "mime_type": "application/json",
            "schema": schema,
        },
        "generation_config": {
            "thinking_level": "minimal",
        },
    }


def main():
    if len(sys.argv) not in {6, 7}:
        raise SystemExit(
            "usage: python vision/run_extract_gemini.py <input_image> <output_json> <prompt_path> <schema_path> <api_key> [model]"
        )

    input_image = Path(sys.argv[1])
    output_json = Path(sys.argv[2])
    prompt_path = Path(sys.argv[3])
    schema_path = Path(sys.argv[4])
    api_key = sys.argv[5]
    model = sys.argv[6] if len(sys.argv) > 6 else "gemini-2.5-flash"

    request_payload = _build_request(prompt_path, input_image, schema_path)
    request_payload["model"] = model
    request_body = json.dumps(request_payload).encode("utf-8")
    endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions"
    request = urllib.request.Request(
        endpoint,
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"Gemini API request failed: {detail or error.reason}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Gemini API request failed: {error.reason}") from error

    extracted = _load_json_output(_extract_text(payload))
    output_json.write_text(json.dumps(extracted, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
