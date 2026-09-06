# ji-yoon-blog 코드 구조

디렉터리 배치와 모듈 책임, 실행 경계를 소유한다.
흐름은 [`flow.md`](flow.md)가, 객체와 산출물 계약은 [`data-schema.md`](data-schema.md)가 소유한다.

## 실행 경계

같은 저장소의 코드가 두 곳에서 돈다.
어디서 도는지가 그 코드가 볼 수 있는 것을 정한다.

| 경계 | 볼 수 있는 것 | 볼 수 없는 것 |
| --- | --- | --- |
| 홈서버 | S3 endpoint와 credential, 사진 원본 | 네이버 세션, 지융과의 대화 |
| 맥북 | 내려받은 사진, 네이버 브라우저 프로필 | S3 credential |

홈서버에는 `~/fos-agents`가 클론돼 있다.
`git pull`이 곧 배포이며 별도 설치 단계가 없다.

## 디렉터리

| 경로 | 어디서 도나 | 책임 |
| --- | --- | --- |
| `references/` | 판단 자료 | 페르소나, 카테고리 모듈, 미리보기 경계 |
| `scripts/collect_naver_posts.py` | 맥북 | 블로그 글 목록과 본문 수집 |
| `scripts/enrich_naver_posts.py` | 맥북 | 카테고리 이름과 태그 보강 |
| `scripts/analyze_persona.py` | 맥북 | 페르소나 문서가 인용하는 수치 집계 |
| `scripts/seaweed_s3.py` | 홈서버 | S3 접근. 서명, 목록, 조회 |
| `scripts/photo_store.py` | 홈서버 | 사진 폴더와 객체 조회, 전송 |
| `scripts/verify_photo_store.py` | 홈서버 | 연결과 권한 경계 확인 |
| `.claude/skills/naver-blog-draft/` | 맥북 | 사진에서 임시저장까지의 판단과 절차 |
| `docs/` | 문서 | 흐름, 스키마, 구조 |
| `drafts/` | 맥북 | 내려받은 사진과 초안. 추적하지 않는다 |
| `data/` | 맥북 | 수집 원본과 집계 결과. 추적하지 않는다 |

## 스킬 안의 배치

| 경로 | 책임 |
| --- | --- |
| `SKILL.md` | 언제 무엇을 하는지, 멈출 조건 |
| `scripts/photos.py` | SSH로 홈서버 명령을 부른다 |
| `scripts/photo_set.py` | 내려받은 사진의 촬영시각을 읽어 순서를 세운다 |
| `scripts/build_preview.py` | 초안과 사진으로 미리보기를 만든다 |
| `scripts/test_photo_set.py` | 촬영시각 파서를 합성한 이미지로 검증한다 |
| `references/iphone-upload.md` | 아이폰에서 올리는 절차와 함정 |

## 의존 방향

```text
맥북:  photos.py ──SSH──> 홈서버: photo_store.py ──> seaweed_s3.py ──> S3
       photo_set.py ──> 내려받은 파일
       build_preview.py ──> draft.json + 내려받은 파일
```

맥북 코드가 `seaweed_s3.py`를 직접 부르지 않는다.
부를 수 있게 두면 credential이 맥북으로 내려와야 한다.

## 의존성

새로 들이는 외부 라이브러리가 없다.

| 어디 | 무엇 |
| --- | --- |
| 맥북 | `python3`, `beautifulsoup4`(수집기만) |
| 홈서버 | `python3` 표준 라이브러리 |
| 브라우저 | `browser-driver` |

사진의 촬영시각은 이미지 라이브러리 없이 JPEG의 EXIF를 직접 읽는다.
홈서버에 Pillow가 있지만 맥북에는 없고, 순서를 세우는 일은 맥북에서 하기 때문이다.

## 워크스페이스 경계

`career-os`도 같은 홈서버 저장소를 쓰지만 코드를 공유하지 않는다.
bucket이 다르고 credential이 다르며 서로의 bucket에 접근하면 403이다.

`career-os`는 bun으로 컴파일한 실행 파일을 홈서버에 설치하는 방식을 쓴다.
이 워크스페이스는 Python 스크립트를 그대로 실행하므로 빌드 단계가 없다.
같은 문제를 다르게 푼 것이며 어느 쪽도 상대를 참조하지 않는다.
