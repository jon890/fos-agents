# Phase 03 — dashboard 버튼과 상태 표시

## 목표

fos-career application workbench에서 공고별 `보류`, `제외`, `지원 준비` 버튼과 요청 상태 표시를 제공한다.

## 범위

- application list/detail 화면의 action affordance 추가.
- 버튼 라벨은 한글: `보류`, `제외`, `지원 준비`.
- reason 입력은 optional.
- 요청 생성 API 연결.
- latest request status 표시: `pending`, `running`, `done`, `failed`, `stale`.
- 실패/stale 사유 표시.
- 중복 pending/running 요청이 있으면 새 요청보다 기존 요청 상태를 우선 노출.

## 범위 밖

- 이력서 본문 편집 UI.
- PDF 미리보기 UI.
- 외부 제출/업로드 버튼.

## 구현 힌트

- destructive하게 보일 수 있는 `제외`는 확인 affordance를 둔다.
- `지원 준비`는 외부 제출이 아니라 내부 산출물 생성임을 버튼 주변 텍스트가 아니라 상태와 결과로 보여준다.
- 화면 문구는 한글 산출물 정책을 따른다.

## 성공 기준

- 미인증 사용자는 요청 API를 호출할 수 없다.
- 버튼 클릭은 fos-career DB request만 생성하고 career-os 파일을 직접 쓰지 않는다.
- UI에서 latest request status와 optional reason이 확인된다.
- fos-career build 또는 TypeScript 검증이 통과한다.

## PHASE_BLOCKED

- existing workbench projection이 recordType/recordId를 안정적으로 제공하지 못하면 `PHASE_BLOCKED: missing stable record identity`를 출력한다.

## PHASE_FAILED

- UI에서 외부 제출로 오해되는 copy나 제출 자동화 button이 추가되면 실패로 본다.
