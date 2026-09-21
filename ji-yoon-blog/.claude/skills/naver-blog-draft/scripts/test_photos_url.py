"""Admin UI 파일 화면의 폴더 주소 생성을 검증한다."""

import unittest

from photos import StoreConfigError, folder_url


class FolderUrlTest(unittest.TestCase):
    def test_files_url_adds_folder_to_query_path(self):
        env = {
            "JI_YOON_BLOG_STORAGE_URL": (
                "https://storage.example.com/files?path=/buckets/ji-yoon-blog"
            )
        }
        self.assertEqual(
            folder_url(env, "photos/순돌이곱창/"),
            "https://storage.example.com/files?path=%2Fbuckets%2Fji-yoon-blog%2Fphotos%2F"
            "%EC%88%9C%EB%8F%8C%EC%9D%B4%EA%B3%B1%EC%B0%BD",
        )

    def test_legacy_bucket_url_still_builds_files_url(self):
        env = {"JI_YOON_BLOG_STORAGE_URL": "https://storage.example.com/buckets/ji-yoon-blog"}
        self.assertEqual(
            folder_url(env, "photos/test/"),
            "https://storage.example.com/files?path=%2Fbuckets%2Fji-yoon-blog%2Fphotos%2Ftest",
        )

    def test_missing_bucket_path_fails(self):
        env = {"JI_YOON_BLOG_STORAGE_URL": "https://storage.example.com/files"}
        with self.assertRaises(StoreConfigError):
            folder_url(env, "photos/test/")


if __name__ == "__main__":
    unittest.main()
