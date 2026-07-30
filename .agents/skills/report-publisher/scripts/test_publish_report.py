#!/usr/bin/env python3
"""Unit tests for the report publisher validation boundary."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

MODULE_PATH = Path(__file__).with_name("publish_report.py")
SPEC = importlib.util.spec_from_file_location("publish_report", MODULE_PATH)
assert SPEC and SPEC.loader
PUBLISH_REPORT = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PUBLISH_REPORT
SPEC.loader.exec_module(PUBLISH_REPORT)


class PublishReportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.repo = (self.root / "repo").resolve()
        self.repo.mkdir()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def prepare(self, source: Path, slug: str = "sample-report"):
        stage = self.root / "stage"
        with mock.patch.object(PUBLISH_REPORT, "repo_root", return_value=self.repo):
            return PUBLISH_REPORT.prepare_report(
                str(source),
                slug,
                "fos-reports",
                None,
                stage,
            )

    def test_single_self_contained_html_is_prepared(self) -> None:
        source = self.repo / "report.html"
        source.write_text(
            '<!doctype html><title>여행</title><a href="#map">지도</a>',
            encoding="utf-8",
        )
        result = self.prepare(source)
        self.assertEqual(result.entry, "index.html")
        self.assertEqual(result.files, ["index.html"])

    def test_single_html_with_local_asset_is_rejected(self) -> None:
        source = self.repo / "report.html"
        source.write_text('<img src="photo.png">', encoding="utf-8")
        with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "허용되지 않은 URL"):
            self.prepare(source)

    def test_absolute_home_path_is_rejected(self) -> None:
        source = self.repo / "report.html"
        source.write_text("<p>/Users/person/private/file.txt</p>", encoding="utf-8")
        with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "absolute home path"):
            self.prepare(source)

    def test_invalid_slug_is_rejected(self) -> None:
        source = self.repo / "report.html"
        source.write_text("<title>Sample</title>", encoding="utf-8")
        with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "slug"):
            self.prepare(source, "Invalid Slug")

    def test_hidden_file_in_directory_is_rejected(self) -> None:
        source = self.repo / "site"
        source.mkdir()
        (source / "index.html").write_text("<title>Sample</title>", encoding="utf-8")
        (source / ".env").write_text("SECRET=value", encoding="utf-8")
        with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "숨김"):
            self.prepare(source)

    def test_wrangler_zero_exit_without_login_is_rejected(self) -> None:
        output = "You are not authenticated. Please run `wrangler login`."
        with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "인증이 없습니다"):
            PUBLISH_REPORT.check_authentication(output)

    def test_wrangler_output_redacts_account_identity(self) -> None:
        output = (
            "user@example.com "
            "eb3c84c94df0c2cd8deb91d2cd313ca1 "
            "token=secret-value"
        )
        cleaned = PUBLISH_REPORT.clean_output(output)
        self.assertNotIn("user@example.com", cleaned)
        self.assertNotIn("eb3c84c94df0c2cd8deb91d2cd313ca1", cleaned)
        self.assertNotIn("secret-value", cleaned)

    def test_insecure_external_reference_is_rejected(self) -> None:
        source = self.repo / "report.html"
        source.write_text(
            '<a href="javascript:alert(1)">run</a>'
            '<img src="http://example.com/image.png">',
            encoding="utf-8",
        )
        with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "HTTPS"):
            self.prepare(source)

    def test_local_srcset_is_rejected(self) -> None:
        source = self.repo / "report.html"
        source.write_text(
            '<img srcset="photo.png 1x, photo@2x.png 2x">',
            encoding="utf-8",
        )
        with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "HTTPS"):
            self.prepare(source)

    def test_absolute_entry_is_rejected(self) -> None:
        source = self.repo / "site"
        source.mkdir()
        (source / "index.html").write_text("<title>Safe</title>", encoding="utf-8")
        outside = self.repo / "outside.html"
        outside.write_text("<title>Secret</title>", encoding="utf-8")
        stage = self.root / "stage"
        with mock.patch.object(PUBLISH_REPORT, "repo_root", return_value=self.repo):
            with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "상대 경로"):
                PUBLISH_REPORT.prepare_report(
                    str(source),
                    "sample-report",
                    "fos-reports",
                    str(outside),
                    stage,
                )

    def test_parent_entry_is_rejected(self) -> None:
        source = self.repo / "site"
        source.mkdir()
        (source / "index.html").write_text("<title>Safe</title>", encoding="utf-8")
        (self.repo / "outside.html").write_text("<title>Secret</title>", encoding="utf-8")
        stage = self.root / "stage"
        with mock.patch.object(PUBLISH_REPORT, "repo_root", return_value=self.repo):
            with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "상위 경로"):
                PUBLISH_REPORT.prepare_report(
                    str(source),
                    "sample-report",
                    "fos-reports",
                    "../outside.html",
                    stage,
                )

    def test_production_branch_slug_is_rejected(self) -> None:
        source = self.repo / "report.html"
        source.write_text("<title>Sample</title>", encoding="utf-8")
        with self.assertRaisesRegex(PUBLISH_REPORT.PublishError, "production branch"):
            self.prepare(source, "main")

    def test_published_deployment_url_is_primary_when_alias_is_missing(self) -> None:
        prepared = PUBLISH_REPORT.PreparedReport(
            source="report.html",
            slug="sample-report",
            project_name="fos-reports",
            entry="index.html",
            file_count=1,
            total_bytes=20,
            files=["index.html"],
            expected_branch_url="https://sample-report.fos-reports.pages.dev/",
            warnings=[],
        )
        deployment_url = "https://abc123.fos-reports.pages.dev"
        args = SimpleNamespace(
            confirm_public=True,
            source="report.html",
            slug="sample-report",
            project_name="fos-reports",
            entry=None,
        )
        verification_results = [
            {
                "ok": True,
                "status": 200,
                "title": "Sample",
                "url": f"{deployment_url}/",
            },
            {
                "ok": False,
                "status": None,
                "title": "",
                "url": prepared.expected_branch_url,
                "error": "404",
            },
        ]
        with (
            mock.patch.object(
                PUBLISH_REPORT,
                "prepare_report",
                return_value=prepared,
            ),
            mock.patch.object(
                PUBLISH_REPORT,
                "run_wrangler",
                return_value=f"Deployment complete: {deployment_url}",
            ),
            mock.patch.object(
                PUBLISH_REPORT,
                "verify_url",
                side_effect=verification_results,
            ),
            mock.patch.object(
                PUBLISH_REPORT,
                "repo_root",
                return_value=self.repo,
            ),
        ):
            result = PUBLISH_REPORT.publish_report(args)

        self.assertEqual(result["public_url"], deployment_url)
        self.assertEqual(result["deployment_url"], deployment_url)
        self.assertIsNone(result["branch_url"])


if __name__ == "__main__":
    unittest.main()
