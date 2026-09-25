"""네이버 블로그 초안의 필수 필드와 블록 순서를 검사한다."""

from __future__ import annotations

BLOCK_FIELDS = {
    "sticker": "stickerCode",
    "text": "lines",
    "image": "path",
    "map": "name",
}
STICKER_CODES = {
    "hello": "ogq_5db4314bac2f0-1",
    "location": "ogq_5db4314bac2f0-4",
    "price": "ogq_5db4314bac2f0-6",
    "self_paid": "ogq_5db4314bac2f0-23",
}


def validate(draft: dict) -> list[str]:
    """초안이 `data-schema.md` 의 계약을 지키는지 본다. 어긋난 것을 문장으로 돌려준다.

    `lines` 에 문자열 하나를 넣는 실수가 가장 잦다.
    그대로 두면 미리보기가 글자 하나를 한 문단으로 그리고 종료 코드는 0 이라
    줄 나눔이 무너진 것을 사람이 알아채지 못한다.
    """
    problems: list[str] = []

    if not isinstance(draft.get("title"), str) or not draft["title"].strip():
        problems.append("title 이 비어 있다")
    if not isinstance(draft.get("category"), str) or not draft["category"].strip():
        problems.append("category 가 비어 있다")

    tags = draft.get("tags")
    if not isinstance(tags, list) or not tags or not all(isinstance(t, str) and t.strip() and not t.startswith("#") for t in tags):
        problems.append("tags 는 # 없는 비어 있지 않은 문자열 배열이어야 한다")
    if not isinstance(draft.get("sponsored"), bool):
        problems.append("sponsored 는 지융에게 확인한 참 또는 거짓이어야 한다")

    blocks = draft.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        problems.append("blocks 는 비어 있지 않은 배열이어야 한다")
        return problems

    for i, block in enumerate(blocks):
        where = f"blocks[{i}]"
        if not isinstance(block, dict):
            problems.append(f"{where} 가 객체가 아니다")
            continue
        kind = block.get("type")
        if kind not in BLOCK_FIELDS:
            problems.append(f"{where} 의 type 이 모르는 값이다: {kind!r}")
            continue
        field = BLOCK_FIELDS[kind]
        if field not in block:
            problems.append(f"{where}({kind}) 에 {field} 가 없다")
            continue
        value = block[field]
        if kind == "text":
            if not isinstance(value, list):
                problems.append(f"{where}(text) 의 lines 가 배열이 아니다. 한 줄도 배열로 넣는다")
            elif not all(isinstance(line, str) for line in value):
                problems.append(f"{where}(text) 의 lines 에 문자열이 아닌 원소가 있다")
            elif not value:
                problems.append(f"{where}(text) 의 lines 가 비어 있다")
        elif not isinstance(value, str) or not value.strip():
            problems.append(f"{where}({kind}) 의 {field} 가 비어 있다")
        if kind == "sticker" and value not in STICKER_CODES.values():
            problems.append(f"{where}(sticker) 의 stickerCode 를 모른다: {value!r}")
        if kind == "map" and (not isinstance(block.get("address"), str) or not block["address"].strip()):
            problems.append(f"{where}(map) 의 address 가 없다")

    if draft.get("category") in ("맛집로그", "카페로그"):
        codes = [b.get("stickerCode") for b in blocks if isinstance(b, dict) and b.get("type") == "sticker"]
        if not isinstance(blocks[0], dict) or blocks[0].get("stickerCode") != STICKER_CODES["hello"]:
            problems.append("첫 블록은 안녕하세요 스티커여야 한다")
        if not isinstance(blocks[-1], dict) or blocks[-1].get("stickerCode") != STICKER_CODES["location"]:
            problems.append("마지막 블록은 위치정보 스티커여야 한다")
        menu_images = [i for i, b in enumerate(blocks) if isinstance(b, dict) and b.get("type") == "image" and b.get("role") == "menu"]
        if len(menu_images) != 1 or menu_images[0] == 0 or not isinstance(blocks[menu_images[0] - 1], dict) or blocks[menu_images[0] - 1].get("stickerCode") != STICKER_CODES["price"]:
            problems.append("메뉴판 사진 하나 바로 앞에 가격표 스티커를 둔다")
        if codes.count(STICKER_CODES["self_paid"]) != (0 if draft.get("sponsored") else 1):
            problems.append("내돈내산 글에만 내돈내산 스티커를 하나 둔다")
        if not any(isinstance(b, dict) and b.get("type") == "map" and b.get("name") and b.get("address") for b in blocks):
            problems.append("상호명과 주소가 있는 지도 블록을 둔다")

    return problems
