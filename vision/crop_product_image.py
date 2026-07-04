#!/usr/bin/env python3

import json
import sys
from pathlib import Path

from PIL import Image


def clamp(value, lower, upper):
    return max(lower, min(value, upper))


def load_bbox(payload):
    bbox = payload.get("product_image_bbox")
    if bbox is None:
        raise ValueError("product_image_bbox is null")

    required_keys = ("x", "y", "width", "height")
    missing_keys = [key for key in required_keys if key not in bbox]
    if missing_keys:
        raise ValueError(f"product_image_bbox is missing keys: {', '.join(missing_keys)}")

    return {key: int(bbox[key]) for key in required_keys}


def main():
    if len(sys.argv) not in {3, 4}:
        print(
            "usage: python vision/crop_product_image.py <image_path> <extraction_json> [output_image]",
            file=sys.stderr,
        )
        return 1

    image_path = Path(sys.argv[1])
    extraction_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3]) if len(sys.argv) == 4 else image_path.with_name("cropped_product.png")

    if not image_path.is_file():
        print(f"image not found: {image_path}", file=sys.stderr)
        return 1

    if not extraction_path.is_file():
        print(f"extraction json not found: {extraction_path}", file=sys.stderr)
        return 1

    payload = json.loads(extraction_path.read_text(encoding="utf-8"))
    bbox = load_bbox(payload)

    with Image.open(image_path) as image:
        image_width, image_height = image.size

        left = clamp(bbox["x"], 0, image_width)
        top = clamp(bbox["y"], 0, image_height)
        right = clamp(bbox["x"] + bbox["width"], 0, image_width)
        bottom = clamp(bbox["y"] + bbox["height"], 0, image_height)

        if right <= left or bottom <= top:
            raise ValueError("product_image_bbox is outside the image bounds")

        cropped = image.crop((left, top, right, bottom))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(output_path)

    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
