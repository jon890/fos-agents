# phase-01: config 파일 생성 (position-collection·candidate-config)

## 목표
wanted.ts에 하드코딩된 수집 설정을 `config/position-collection.json`으로, 후보자 경력을 `config/candidate-config.json`으로 외부화한다 (ADR-099). 이 phase는 **config 파일만 만든다**(코드는 phase-02).

## 먼저 읽을 것
- `career-os/docs/adr/ADR-099-*.md` — 결정 근거
- `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts` — 옮길 값 출처: `job_group_id`(=518, fetchWanted 안), `WANTED_TARGET_KEYWORDS`(28개 배열)
- `career-os/config/candidate-profile.md` — 후보자 경력 7년 근거(문장에 "약 7년차")

## 변경할 파일 (신규)
- `career-os/config/position-collection.json`
- `career-os/config/candidate-config.json`

## 내용
`position-collection.json`:
```json
{
  "_meta": { "purpose": "position-recommender 수집 설정. wanted.ts 하드코딩을 외부화 (ADR-099)." },
  "wanted": {
    "jobGroupId": 518,
    "targetKeywords": [ <wanted.ts의 WANTED_TARGET_KEYWORDS 28개를 그대로> ]
  }
}
```
`candidate-config.json`:
```json
{
  "_meta": { "purpose": "후보자 구조화 사실. 코드가 읽는 사실 정본. profile.md는 prose 서술 (ADR-099, 거울 구조)." },
  "experienceYears": 7
}
```
- targetKeywords는 wanted.ts에서 **정확히 복사**한다(누락·순서 변경 금지).
- experienceYears는 candidate-profile의 "약 7년차"를 따른다.

## 성공 기준 (실행 가능)
```bash
cd career-os
python3 -m json.tool config/position-collection.json > /dev/null && echo "position-collection 유효"
python3 -m json.tool config/candidate-config.json > /dev/null && echo "candidate-config 유효"
# 키워드 수가 wanted.ts와 일치
python3 -c "import json; n=len(json.load(open('config/position-collection.json'))['wanted']['targetKeywords']); print('targetKeywords:', n); assert n==28, '28개여야'"
python3 -c "import json; print('experienceYears:', json.load(open('config/candidate-config.json'))['experienceYears'])"
```

## 금지 사항
- wanted.ts·collect 등 코드 수정 금지 (phase-02 영역).
- docs/ADR 수정 금지.

## 완료 시
```bash
cd career-os && git add config/position-collection.json config/candidate-config.json && \
git -C .. commit -q -m "feat(career-os): position 수집 설정·후보자 config 외부화 (ADR-099 phase-01)
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## 막히면
`PHASE_BLOCKED: <이유>` stdout 출력 후 종료.
