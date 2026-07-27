#!/usr/bin/env python3

from __future__ import annotations

import unittest

from audit_collection import audit
from score_opportunities import first_win_sort_key, score


class ScoreOpportunitiesTest(unittest.TestCase):
    def test_small_clear_project_is_promoted_to_first_win_track(self) -> None:
        item = {
            "platform": "Wishket",
            "title": "거래소 공지 감지 스크립트",
            "budget_krw": 200_000,
            "duration_days": 1,
            "applicants": 4,
            "fit": 4,
            "risk": 3,
            "portfolio": 3,
            "remote": 3,
            "remote_only_pass": None,
            "scope_clarity": 5,
            "delivery_confidence": 4,
            "experience_match": 4,
            "reputation_value": 5,
        }

        result = score(item, remote_only=True)

        self.assertEqual(result["score"], 62)
        self.assertEqual(result["action"], "clarify-first")
        self.assertEqual(result["first_win_score"], 77)
        self.assertEqual(result["first_win_action"], "clarify-first")
        self.assertEqual(result["recommended_track"], "first-win")

    def test_remote_block_applies_to_first_win_track(self) -> None:
        item = {
            "budget_krw": 500_000,
            "duration_days": 3,
            "applicants": 1,
            "fit": 5,
            "risk": 1,
            "remote": 1,
            "remote_only_pass": False,
            "scope_clarity": 5,
            "delivery_confidence": 5,
            "experience_match": 5,
            "reputation_value": 5,
        }

        result = score(item, remote_only=True)

        self.assertEqual(result["first_win_score"], 49)
        self.assertEqual(result["first_win_action"], "avoid")
        self.assertEqual(result["recommended_track"], "standard")

    def test_long_project_stays_on_standard_track(self) -> None:
        result = score(
            {
                "budget_krw": 10_000_000,
                "duration_days": 60,
                "fit": 5,
                "risk": 2,
                "portfolio": 5,
                "remote": 5,
                "remote_only_pass": True,
            },
            remote_only=True,
        )

        self.assertNotIn("first_win_score", result)
        self.assertEqual(result["recommended_track"], "standard")

    def test_unknown_budget_is_clarified_not_dropped(self) -> None:
        result = score(
            {
                "budget_krw": None,
                "duration_days": 3,
                "applicants": 2,
                "fit": 5,
                "risk": 2,
                "remote": 5,
                "remote_only_pass": True,
                "scope_clarity": 5,
                "delivery_confidence": 5,
                "experience_match": 5,
                "reputation_value": 5,
            },
            remote_only=True,
        )

        self.assertEqual(result["recommended_track"], "first-win")
        self.assertEqual(result["first_win_action"], "clarify-first")

    def test_zero_budget_is_not_first_win_even_when_explicitly_enabled(self) -> None:
        result = score(
            {
                "first_win_candidate": True,
                "budget_krw": 0,
                "duration_days": 3,
                "fit": 5,
                "risk": 1,
                "remote": 5,
                "remote_only_pass": True,
            },
            remote_only=True,
        )

        self.assertEqual(result["recommended_track"], "standard")
        self.assertNotIn("first_win_score", result)

    def test_first_win_sort_does_not_promote_avoid_candidate(self) -> None:
        standard = {
            "score": 100,
            "recommended_track": "standard",
        }
        rejected_first_win = {
            "score": 49,
            "first_win_score": 49,
            "first_win_action": "avoid",
            "recommended_track": "standard",
        }

        rows = sorted(
            [rejected_first_win, standard],
            key=first_win_sort_key,
            reverse=True,
        )

        self.assertIs(rows[0], standard)


class AuditCollectionTest(unittest.TestCase):
    def test_reports_complete_collection(self) -> None:
        payload = {
            "collection": [
                {
                    "platform": "Wishket",
                    "source_id": "wishket-outsourcing-open",
                    "advertised_count": 1,
                }
            ],
            "items": [
                {
                    "platform": "Wishket",
                    "project_id": "157210",
                    "title": "공지 감지",
                    "url": "https://www.wishket.com/project/157210/",
                    "registered_at": "2026-07-27",
                    "collected_at": "2026-07-27T16:15:00+09:00",
                    "list_page": 1,
                    "collection_source": "wishket-outsourcing-open",
                    "detail_status": "confirmed",
                    "eligibility_status": "candidate",
                    "exclusion_reason": None,
                }
            ],
        }

        result = audit(payload)

        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["coverage"][0]["missing_count"], 0)

    def test_reports_missing_items_and_duplicate_ids(self) -> None:
        item = {
            "platform": "Wishket",
            "project_id": "157210",
            "title": "공지 감지",
            "url": "https://www.wishket.com/project/157210/",
            "registered_at": "2026-07-27",
            "collected_at": "2026-07-27T16:15:00+09:00",
            "list_page": 1,
            "collection_source": "wishket-outsourcing-open",
            "detail_status": "confirmed",
            "eligibility_status": "candidate",
            "exclusion_reason": None,
        }
        payload = {
            "collection": [
                {
                    "platform": "Wishket",
                    "source_id": "wishket-outsourcing-open",
                    "advertised_count": 3,
                }
            ],
            "items": [item, item],
        }

        result = audit(payload)

        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["unique_item_count"], 1)
        self.assertEqual(result["coverage"][0]["missing_count"], 2)
        self.assertEqual(result["duplicate_keys"][0]["count"], 2)

    def test_requires_collection_metadata_for_coverage_claim(self) -> None:
        payload = [
            {
                "platform": "Wishket",
                "project_id": "157210",
                "title": "공지 감지",
                "url": "https://www.wishket.com/project/157210/",
                "registered_at": "2026-07-27",
                "collected_at": "2026-07-27T16:15:00+09:00",
                "list_page": 1,
                "collection_source": "wishket-outsourcing-open",
                "detail_status": "confirmed",
                "eligibility_status": "candidate",
                "exclusion_reason": None,
            }
        ]

        result = audit(payload)

        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["untracked_sources"], ["wishket-outsourcing-open"])

    def test_related_items_do_not_hide_primary_list_gap(self) -> None:
        def item(project_id: str, source: str) -> dict:
            return {
                "platform": "Wishket",
                "project_id": project_id,
                "title": f"공고 {project_id}",
                "url": f"https://www.wishket.com/project/{project_id}/",
                "registered_at": "2026-07-27",
                "collected_at": "2026-07-27T16:15:00+09:00",
                "list_page": 1,
                "collection_source": source,
                "detail_status": "confirmed",
                "eligibility_status": "candidate",
                "exclusion_reason": None,
            }

        payload = {
            "collection": [
                {
                    "platform": "Wishket",
                    "source_id": "wishket-outsourcing-open",
                    "advertised_count": 2,
                },
                {
                    "platform": "Wishket",
                    "source_id": "wishket-related",
                    "advertised_count": None,
                    "coverage_expected": False,
                },
            ],
            "items": [
                item("1", "wishket-outsourcing-open"),
                item("2", "wishket-related"),
            ],
        }

        result = audit(payload)

        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["coverage"][0]["missing_count"], 1)
        self.assertEqual(result["coverage"][1]["coverage_status"], "not-applicable")


if __name__ == "__main__":
    unittest.main()
