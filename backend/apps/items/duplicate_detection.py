import re
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from django.db.models import Count

from .models import Item


PROMOTIONAL_PHRASES = (
    "무료배송",
    "당일출고",
    "정품",
    "공식",
    "특가",
    "행사",
    "한정",
    "대용량",
    "세트",
    "1개입",
)

TOKEN_STOPWORDS = set(PROMOTIONAL_PHRASES)
TRIGRAM_WEIGHT = 0.60
TOKEN_WEIGHT = 0.25
BRAND_WEIGHT = 0.10
PRICE_WEIGHT = 0.05
HIGH_CONFIDENCE_THRESHOLD = 0.85
LOW_CONFIDENCE_THRESHOLD = 0.72


@dataclass
class NormalizedItemInput:
    raw_name: str
    name: str
    tokens: list[str]
    model_tokens: set[str]
    brand: str
    original_url: str
    price: int | None


def _collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_url(value: str) -> str:
    stripped = (value or "").strip()
    if not stripped:
        return ""

    parts = urlsplit(stripped)
    scheme = parts.scheme.lower()
    netloc = parts.netloc.lower()
    path = parts.path.rstrip("/")
    query = urlencode(sorted(parse_qsl(parts.query, keep_blank_values=False)))
    normalized = urlunsplit((scheme, netloc, path, query, ""))
    return normalized


def normalize_text(value: str) -> str:
    normalized = (value or "").lower().strip()
    if not normalized:
        return ""

    normalized = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", normalized)
    normalized = normalized.replace("-", " ")
    normalized = normalized.replace("_", " ")
    normalized = normalized.replace("/", " ")
    normalized = normalized.replace("|", " ")
    normalized = normalized.replace(",", " ")
    normalized = re.sub(r"[^0-9a-zA-Z가-힣\s]", " ", normalized)

    for phrase in PROMOTIONAL_PHRASES:
        normalized = normalized.replace(phrase.lower(), " ")

    return _collapse_spaces(normalized)


def strip_leading_brand_from_name(name: str, brand: str) -> str:
    if not name or not brand:
        return name

    if name == brand:
        return name

    if name.startswith(f"{brand} "):
        return name[len(brand) :].strip()

    return name


def tokenize_name(name: str) -> list[str]:
    if not name:
        return []

    return [token for token in name.split(" ") if token and token not in TOKEN_STOPWORDS]


def extract_model_tokens(tokens: Iterable[str]) -> set[str]:
    model_tokens: set[str] = set()
    for token in tokens:
        if any(char.isdigit() for char in token):
            model_tokens.add(token)
    return model_tokens


def build_normalized_input(name: str, brand: str = "", original_url: str = "", price=None) -> NormalizedItemInput:
    normalized_brand = normalize_text(brand)
    normalized_name = normalize_text(name)
    normalized_name = strip_leading_brand_from_name(normalized_name, normalized_brand)
    tokens = tokenize_name(normalized_name)

    parsed_price = None
    if isinstance(price, str):
        cleaned = price.replace(",", "").replace("₩", "").strip()
        parsed_price = int(cleaned) if cleaned.isdigit() else None
    elif isinstance(price, (int, float)) and price > 0:
        parsed_price = int(price)

    return NormalizedItemInput(
        raw_name=(name or "").strip(),
        name=normalized_name,
        tokens=tokens,
        model_tokens=extract_model_tokens(tokens),
        brand=normalized_brand,
        original_url=normalize_url(original_url),
        price=parsed_price,
    )


def trigram_similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0

    if left == right:
        return 1.0

    def _trigram_dice(value_left: str, value_right: str) -> float:
        left_padded = f"  {value_left} "
        right_padded = f"  {value_right} "
        left_grams = {left_padded[index : index + 3] for index in range(len(left_padded) - 2)}
        right_grams = {right_padded[index : index + 3] for index in range(len(right_padded) - 2)}

        if not left_grams or not right_grams:
            return 0.0

        overlap = len(left_grams & right_grams)
        return (2 * overlap) / (len(left_grams) + len(right_grams))

    spaced_score = _trigram_dice(left, right)
    compact_score = _trigram_dice(left.replace(" ", ""), right.replace(" ", ""))
    return max(spaced_score, compact_score)


def token_overlap_score(left_tokens: list[str], right_tokens: list[str]) -> float:
    left_set = set(left_tokens)
    right_set = set(right_tokens)

    if not left_set or not right_set:
        return 0.0

    return len(left_set & right_set) / len(left_set | right_set)


def brand_similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    if left in right or right in left:
        return 0.5
    return 0.0


def price_similarity(left: int | None, right: int | None) -> float:
    if not left or not right:
        return 0.0

    diff_ratio = abs(left - right) / max(left, right)
    return max(0.0, 1 - min(diff_ratio, 1.0))


def model_token_adjustment(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0

    if left & right:
        return 0.03

    return -0.12


def explain_reason(name_score: float, token_score: float, brand_score: float, url_matched: bool) -> str:
    if url_matched:
        return "원본 URL이 일치합니다."
    if name_score >= 0.9 and brand_score >= 0.5:
        return "상품명과 브랜드가 매우 유사합니다."
    if name_score >= 0.85:
        return "상품명이 매우 유사합니다."
    if token_score >= 0.5 and brand_score >= 0.5:
        return "핵심 상품명 토큰과 브랜드가 유사합니다."
    if token_score >= 0.5:
        return "핵심 상품명 토큰이 많이 겹칩니다."
    return "입력한 상품과 유사한 이름 패턴이 확인되었습니다."


def is_duplicate_candidate(
    score: float,
    brand_score: float,
    common_token_count: int,
    model_tokens_overlap: bool,
) -> bool:
    if brand_score >= 1.0 and common_token_count >= 2:
        return True

    if score >= HIGH_CONFIDENCE_THRESHOLD:
        return True

    if score < LOW_CONFIDENCE_THRESHOLD:
        return False

    return brand_score >= 1.0 or common_token_count >= 2 or model_tokens_overlap


def build_candidate_payload(item: Item, score: float, reason: str) -> dict:
    image_url = item.image_file.url if item.image_file else (item.image_url or "")
    return {
        "id": item.id,
        "name": item.name,
        "shop_or_brand_name": item.shop_or_brand_name,
        "price": item.price,
        "image_url": image_url,
        "starCount": getattr(item, "starCount", 0),
        "similarity_score": round(score, 3),
        "reason": reason,
    }


def find_duplicate_candidates(
    name: str,
    brand: str = "",
    original_url: str = "",
    price=None,
    limit: int = 5,
) -> list[dict]:
    normalized_input = build_normalized_input(name, brand, original_url, price)
    if not normalized_input.name:
        return []

    candidates: list[dict] = []
    queryset = Item.objects.annotate(starCount=Count("star"))

    for item in queryset:
        normalized_item = build_normalized_input(
            name=item.name,
            brand=item.shop_or_brand_name,
            original_url=item.original_url or "",
            price=item.price,
        )

        url_matched = bool(
            normalized_input.original_url
            and normalized_item.original_url
            and normalized_input.original_url == normalized_item.original_url
        )
        if url_matched:
            candidates.append(build_candidate_payload(item, 1.0, explain_reason(0.0, 0.0, 0.0, True)))
            continue

        name_score = trigram_similarity(normalized_input.name, normalized_item.name)
        token_score = token_overlap_score(normalized_input.tokens, normalized_item.tokens)
        brand_score = brand_similarity(normalized_input.brand, normalized_item.brand)
        price_score = price_similarity(normalized_input.price, normalized_item.price)
        adjustment = model_token_adjustment(
            normalized_input.model_tokens,
            normalized_item.model_tokens,
        )
        exact_brand_and_name_bonus = 0.0
        if brand_score >= 1.0 and token_score >= 0.75:
            exact_brand_and_name_bonus = 0.12

        score = (
            name_score * TRIGRAM_WEIGHT
            + token_score * TOKEN_WEIGHT
            + brand_score * BRAND_WEIGHT
            + price_score * PRICE_WEIGHT
            + adjustment
            + exact_brand_and_name_bonus
        )
        common_token_count = len(set(normalized_input.tokens) & set(normalized_item.tokens))
        model_overlap = bool(normalized_input.model_tokens & normalized_item.model_tokens)

        if not is_duplicate_candidate(score, brand_score, common_token_count, model_overlap):
            continue

        candidates.append(
            build_candidate_payload(
                item,
                score,
                explain_reason(name_score, token_score, brand_score, False),
            )
        )

    candidates.sort(key=lambda candidate: candidate["similarity_score"], reverse=True)
    return candidates[:limit]
