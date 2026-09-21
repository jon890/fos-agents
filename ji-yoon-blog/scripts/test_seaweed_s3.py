"""환경 파일 선택이 프로필의 HOME 값과 무관한지 확인한다."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import seaweed_s3


class LoadEnvTest(unittest.TestCase):
    def test_host_file_uses_default_path_with_profile_home(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            host_env = root / "host.env"
            host_env.write_text("JI_YOON_BLOG_S3_BUCKET=server\n", encoding="utf-8")
            with patch.dict(os.environ, {"HOME": str(root / "profile" / "home")}, clear=True):
                with patch.object(seaweed_s3, "WORKSPACE_ENV", root / "missing.env"):
                    with patch.object(seaweed_s3, "DEFAULT_HOST_ENV", host_env):
                        self.assertEqual(seaweed_s3.load_env()["JI_YOON_BLOG_S3_BUCKET"], "server")

    def test_host_file_path_can_be_overridden(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            host_env = root / "custom.env"
            host_env.write_text("JI_YOON_BLOG_S3_BUCKET=custom\n", encoding="utf-8")
            with patch.dict(os.environ, {"JI_YOON_BLOG_HOST_ENV_PATH": str(host_env)}, clear=True):
                with patch.object(seaweed_s3, "WORKSPACE_ENV", root / "missing.env"):
                    with patch.object(seaweed_s3, "DEFAULT_HOST_ENV", root / "default.env"):
                        self.assertEqual(seaweed_s3.load_env()["JI_YOON_BLOG_S3_BUCKET"], "custom")

    def test_workspace_file_takes_precedence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            workspace_env = root / ".env"
            host_env = root / "host.env"
            workspace_env.write_text("JI_YOON_BLOG_S3_BUCKET=workspace\n", encoding="utf-8")
            host_env.write_text("JI_YOON_BLOG_S3_BUCKET=server\n", encoding="utf-8")
            with patch.dict(os.environ, {"JI_YOON_BLOG_HOST_ENV_PATH": str(host_env)}, clear=True):
                with patch.object(seaweed_s3, "WORKSPACE_ENV", workspace_env):
                    self.assertEqual(seaweed_s3.load_env()["JI_YOON_BLOG_S3_BUCKET"], "workspace")


if __name__ == "__main__":
    unittest.main()
