#!/usr/bin/env python3
import json
import os
import re
from datetime import datetime


TARGET_UNIT_ALIASES = {
    "59A": {"59a", "59-a", "59 a", "59", "전용59", "전용 59", "59㎡", "59.0", "59형"}
}
AREA_TOLERANCE_M2 = 1.5
ROOT_KEYS = [
    "generatedAt",
    "target",
    "sources",
    "recentTransactions",
    "listingSummary",
    "comparison",
    "notes",
    "focusUnit",
    "focusSummary",
]


def compact(text):
    if text is None:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()


def normalize_unit_text(value):
    text = compact(value).lower()
    text = text.replace("㎡", "").replace("m2", "")
    text = re.sub(r"[^0-9a-z가-힣.]+", "", text)
    return text


def as_float(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = re.search(r"\d+(?:\.\d+)?", str(value))
    return float(m.group(0)) if m else None


def build_focus_norms(focus_label):
    labels = TARGET_UNIT_ALIASES.get(focus_label, {focus_label}) if focus_label else set()
    return {normalize_unit_text(x) for x in labels if normalize_unit_text(x)}


def find_focus_area_matches(type_profiles, focus_exclusive_area):
    matches = []
    for profile in type_profiles or []:
        exclusive = as_float(profile.get("exclusiveAreaEstimateM2"))
        if exclusive is None or focus_exclusive_area is None:
            continue
        if abs(exclusive - focus_exclusive_area) <= AREA_TOLERANCE_M2:
            matches.append(profile)
    return matches


def infer_match_status(item, focus_label, focus_exclusive_area, focus_supply_areas):
    unit = compact(item.get("unit"))
    unit_norm = normalize_unit_text(unit)
    if unit_norm and unit_norm != "unknown" and unit_norm in build_focus_norms(focus_label):
        return "exact"

    supply_area = as_float(item.get("supplyAreaApprox"))
    if supply_area is not None and focus_supply_areas:
        if any(abs(supply_area - area) <= 1 for area in focus_supply_areas):
            return "exact"
        return "non-match"

    source_profile = item.get("sourceTypeProfile") or {}
    exclusive = as_float(source_profile.get("exclusiveAreaEstimateM2"))
    if exclusive is not None and focus_exclusive_area is not None:
        if abs(exclusive - focus_exclusive_area) <= AREA_TOLERANCE_M2:
            return "exact"
        return "non-match"

    if unit_norm and unit_norm != "unknown":
        return "non-match"
    return compact(item.get("matchStatus")) or "unverified"


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("output")
    args = p.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        raw = json.load(f)

    target = raw.get("target", {})
    focus_unit = raw.get("focusUnit") or target.get("focusUnit", {})
    focus_label = compact(focus_unit.get("label"))
    focus_exclusive_area = as_float(focus_unit.get("exclusiveAreaM2"))

    listing_summary = raw.get("listingSummary", {})
    if isinstance(listing_summary, dict):
        listing_summary = dict(listing_summary)
        listing_summary.setdefault("focusUnit", focus_label)
    type_profiles = listing_summary.get("typeProfiles", []) if isinstance(listing_summary, dict) else []
    focus_area_matches = find_focus_area_matches(type_profiles, focus_exclusive_area)
    focus_supply_areas = [as_float(x.get("supplyAreaM2")) for x in focus_area_matches if as_float(x.get("supplyAreaM2")) is not None]

    recent_transactions = raw.get("recentTransactions", [])
    normalized_transactions = []
    exact_matches = 0
    provisional_matches = 0
    non_matches = 0
    for item in recent_transactions:
        row = dict(item)
        row["unit"] = compact(row.get("unit")) or "unknown"
        row["matchStatus"] = infer_match_status(row, focus_label, focus_exclusive_area, focus_supply_areas)
        if row["matchStatus"] == "exact":
            exact_matches += 1
        elif row["matchStatus"] == "unverified":
            provisional_matches += 1
        elif row["matchStatus"] == "non-match":
            non_matches += 1
        normalized_transactions.append(row)

    focus_notes = []
    if focus_area_matches:
        focus_notes.append(f"KB Land 타입 프로필에서 전용 {focus_exclusive_area:g}㎡ 후보 {len(focus_area_matches)}개를 찾았다.")
    elif type_profiles:
        focus_notes.append(f"KB Land 타입 프로필 기준 전용 {focus_exclusive_area:g}㎡와 맞는 평형을 찾지 못했다.")

    out = {
        "generatedAt": datetime.now().isoformat(),
        "target": target,
        "focusUnit": focus_unit,
        "sources": raw.get("sources", []),
        "recentTransactions": normalized_transactions,
        "listingSummary": listing_summary,
        "comparison": raw.get("comparison", {}),
        "notes": [compact(x) for x in raw.get("notes", []) if compact(x)],
        "focusSummary": {
            "label": focus_label,
            "exclusiveAreaM2": focus_exclusive_area,
            "recentTransactionExactMatches": exact_matches,
            "recentTransactionUnverified": provisional_matches,
            "recentTransactionNonMatches": non_matches,
            "hasExactMatchData": exact_matches > 0,
            "kbTypeProfileCount": len(type_profiles),
            "kbFocusAreaMatchCount": len(focus_area_matches),
            "kbFocusAreaMatches": focus_area_matches,
            "notes": focus_notes,
        },
    }

    for key in ROOT_KEYS:
        out.setdefault(key, {} if key in ("target", "listingSummary", "comparison", "focusUnit", "focusSummary") else [])
    out["generatedAt"] = out.get("generatedAt") or datetime.now().isoformat()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
