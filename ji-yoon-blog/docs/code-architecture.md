# ji-yoon-blog 코드 구조

디렉터리 배치와 모듈 책임, 실행 경계를 소유한다.
흐름은 [`flow.md`](flow.md)가, 객체와 산출물 계약은 [`data-schema.md`](data-schema.md)가 소유한다.

## 실행 경계

같은 저장소의 코드가 두 곳에서 돈다.
어디서 도는지가 그 코드가 볼 수 있는 것을 정한다.

| 경계 | 볼 수 있는 것 | 볼 수 없는 것 |
| --- | --- | --- |
| 홈서버 | S3 endpoint와 credential, 사진 원본, 네이버 세션 | 지융과의 대화 |
| 홈서버의 Hermes 컨테이너 | 홈서버와 같다. S3 값을 환경 변수로 받는다 | SSH 키 |
| 맥북 | 내려받은 사진, 초안 | S3 credential |

홈서버에는 이 저장소의 클론이 둘 있다.
하나는 운영이 읽는 것이고 하나는 사람이 작업하는 것이다.
운영은 작업용 클론에 의존하지 않으므로, 사람이 그쪽 브랜치를 바꿔도 운영이 멈추지 않는다.
Hermes 컨테이너가 보는 것은 운영 쪽이다.

**그 경로와 갱신 절차는 홈서버 운영 저장소가 소유한다.**
여기 적지 않는 이유는 둘이다.
이 저장소가 공개라 실행 환경 식별자를 담지 않고,
같은 절차를 두 곳에 적으면 한쪽만 고쳐진다.

갱신을 `git pull` 하나로 끝내지 않는다.
운영 경로를 상주 서비스가 실행 중에 읽으므로 그 서비스를 먼저 내리고 갱신한 뒤 올린다.
실측으로 그 순서를 지키지 않아 갱신 도중 서비스가 실패했고, 그때 네이버 로그인이 끊겼다.

네이버 세션은 2026-09-20 부터 홈서버의 상주 Chrome 프로필에 둔다.
그 판단과 값은 [`../references/preview-automation.md`](../references/preview-automation.md)가 소유한다.

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
| `scripts/naver_session.py` | 홈서버 | 네이버 세션을 담은 Chrome 을 상주시키고 로그인을 판정한다 |
| `scripts/cdp.py` | 맥북과 홈서버 | CDP 의 WebSocket 창구를 의존성 없이 부른다 |
| `scripts/naver_editor.py` | 맥북 | 글쓰기 화면에 제목과 본문을 넣고 임시저장한다 |
| `.claude/skills/naver-blog-draft/` | 맥북과 홈서버 | 사진에서 임시저장까지의 판단과 절차 |
| `docs/` | 문서 | 흐름, 스키마, 구조 |
| `drafts/` | 맥북 | 내려받은 사진과 초안. 추적하지 않는다 |
| `data/` | 맥북 | 수집 원본과 집계 결과. 추적하지 않는다 |

## 스킬 안의 배치

| 경로 | 책임 |
| --- | --- |
| `SKILL.md` | 언제 무엇을 하는지, 멈출 조건 |
| `scripts/photos.py` | 사진 저장소 명령을 부른다. 부르는 길을 환경을 보고 고른다 |
| `scripts/photo_set.py` | 내려받은 사진의 촬영시각을 읽어 순서를 세운다 |
| `scripts/place_hints.py` | 내려받은 사진에서 장소를 짐작할 실마리를 모은다 |
| `scripts/build_preview.py` | 초안과 사진으로 미리보기를 만든다 |
| `scripts/build_package.py` | 초안으로 사람이 붙여넣을 등록용 묶음을 만든다 |
| `scripts/test_photo_set.py` | 촬영시각 파서를 합성한 이미지로 검증한다 |
| `scripts/test_place_hints.py` | 위치 파서와 이름 단서를 합성한 이미지로 검증한다 |
| `references/iphone-upload.md` | 아이폰에서 올리는 절차와 함정 |

## 의존 방향

```text
맥북:    photos.py ──SSH──> 홈서버: photo_store.py ──> seaweed_s3.py ──> S3
홈서버:  photos.py ────────────────> photo_store.py ──> seaweed_s3.py ──> S3

어디서나: photo_set.py ──> 내려받은 파일
         place_hints.py ──> 내려받은 파일
         build_preview.py ──> draft.json + 내려받은 파일
```

`photos.py`는 같은 스킬이 두 자리에서 돌기 때문에 길을 스스로 고른다.
S3 설정을 읽을 수 있으면 같은 자리에서 `photo_store.py`를 부르고,
읽지 못하면 SSH로 홈서버의 같은 스크립트를 부른다.
고르는 조건은 `photos.py`의 `run_remote()`가 소유한다.

맥북에는 S3 설정이 없으므로 맥북에서 돌 때는 SSH 쪽만 남는다.
credential이 맥북으로 내려오지 않는다는 경계는 이 방식으로도 그대로다.
S3 설정을 읽을 수 있다는 것 자체가 S3에 닿는 자리에 있다는 뜻이기 때문이다.

홈서버 안의 Hermes 컨테이너도 S3에 닿는 자리다.
거기서는 SSH로 나갔다 들어오지 않으므로 컨테이너에 SSH 키를 넣지 않는다.
대신 `~/apps/ji-yoon-blog/config/host.env`의 S3 값을 컨테이너 환경 변수로 넣는다.

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
