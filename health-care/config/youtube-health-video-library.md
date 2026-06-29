# YouTube Health Video Library — Public-Safe Index

이 파일은 아침 종합 건강 코칭에서 참고할 한국어 유튜브 영상 후보 목록이다.
개인 의료정보를 넣지 않는다.
영상 후보는 미리 검토한 뒤 추가하고, 아침 cron은 이 목록에서만 고른다.

## 선정 원칙

- 한국어 영상 우선.
- 의사, 물리치료사, 운동처방사, 재활 전문가, 공공기관·병원 채널 등 전문성이 드러나는 채널 우선.
- 과격한 다이어트, 극단적 단식, 통증을 참고 하는 운동, 깊은 스쿼트/런지/점프를 강하게 권하는 영상은 제외.
- 무릎 불안정, 목디스크/일자목, 지방간/고콜레스테롤/담낭결석/위염 맥락에서 안전한 영상만 추가한다.
- 영상은 참고 자료이며 진단·처방을 대신하지 않는다.

## 사용 규칙

아침 코칭은 매번 유튜브를 새로 검색하지 않는다.
아래 후보 중 오늘 상태에 맞는 1~3개를 고른다.
후보가 부족하면 `영상 후보 보충 필요`라고만 적고, 링크를 꾸며내지 않는다.

## 검토 수준

현재 후보는 2026-06-29에 `yt-dlp` 유튜브 검색 메타데이터로 1차 선별했다.
아직 모든 영상의 전체 자막/내용을 정밀 검수한 것은 아니므로, 아침 코칭에서는 `참고 영상`으로만 제시한다.
통증, 저림, 힘빠짐, 무릎 불안정, 붓기/열감이 있으면 영상보다 중단 기준과 진료 기준을 우선한다.

## 후보 형식

```yaml
- id: short-stable-id
  axis: weight-loss | neck-posture | knee-rehab
  title: "영상 제목"
  channel: "채널명"
  url: "https://www.youtube.com/watch?v=..."
  why: "오늘 코칭에 적합한 이유"
  caution: "주의할 점"
  good_when:
    - "적합한 상태"
  avoid_when:
    - "피해야 할 상태"
  reviewed_at: YYYY-MM-DD
  review_level: metadata-first-pass
```

## 후보 목록

```yaml
- id: wl-ldl-snuh-001
  axis: weight-loss
  title: "6 Ways to Lower LDL Cholesterol [Health by the Numbers]"
  channel: "분당서울대학교병원"
  url: "https://www.youtube.com/watch?v=_c3E1BhYxuo"
  why: "LDL 230 mg/dL과 총콜레스테롤 307 mg/dL이 핵심 이슈라 식단·생활습관 방향을 잡는 데 적합하다."
  caution: "약물치료 필요성 판단은 내과 상담을 우선한다."
  good_when:
    - "콜레스테롤 관리 원칙을 다시 상기하고 싶을 때"
    - "운동보다 식단 조절이 더 중요한 날"
  avoid_when:
    - "영상만 보고 약물치료 상담을 미루려 할 때"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: wl-ldl-dr-dingyo-001
  axis: weight-loss
  title: "콜레스테롤 높은 사람이 먹지 말아야 할 것 네 가지, 먹어야 할 것 두 가지"
  channel: "닥터딩요"
  url: "https://www.youtube.com/watch?v=HQc7NRNLUIs"
  why: "LDL 관리 식단을 한 끼 선택으로 바꾸는 데 도움이 되는 후보다."
  caution: "담낭 모래알 결석과 위염이 있으므로 극단적 절식이나 자극적 식단으로 해석하지 않는다."
  good_when:
    - "오늘 식단 선택을 단순하게 정하고 싶을 때"
    - "튀김·가공육·라면·과자류를 줄이는 리마인더가 필요할 때"
  avoid_when:
    - "개별 질환 치료법처럼 단정해 받아들일 때"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: wl-fat-kbs-001
  axis: weight-loss
  title: "의사도 고지혈증? 착한 기름으로 고지혈증 막는 의사의 식사법"
  channel: "KBS 생로병사의 비밀"
  url: "https://www.youtube.com/watch?v=0zxxpzB53ms"
  why: "고지혈증 식단에서 지방을 무조건 끊기보다 종류와 양을 조절하는 관점에 적합하다."
  caution: "담석이 있으므로 고지방 식사를 정당화하는 방향으로 해석하지 않는다."
  good_when:
    - "포화지방과 좋은 지방의 차이를 정리하고 싶을 때"
  avoid_when:
    - "기름진 식사를 늘리는 명분으로 삼으려 할 때"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: wl-low-impact-bigsis-001
  axis: weight-loss
  title: "No 관절무리 논스톱 30분 - 쉽고 재밌게 체지방 태우기 유산소 홈트"
  channel: "빅씨스 Bigsis"
  url: "https://www.youtube.com/watch?v=_yjAaOBaGh8"
  why: "무릎 부담을 줄인 유산소 후보로, 컨디션이 좋은 날 짧게 참고하기 좋다."
  caution: "30분 전체를 따라 하기보다 무릎 반응을 보며 5~10분 단위로 끊는다."
  good_when:
    - "무릎 통증·잠김·붓기 없이 가볍게 움직이고 싶은 날"
  avoid_when:
    - "무릎 걸림, 잠김, 빠질 듯함, 붓기/열감이 있는 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: wl-low-impact-bubu-001
  axis: weight-loss
  title: "NO무릎부담 전신유산소 근력 다이어트"
  channel: "Thankyou BUBU"
  url: "https://www.youtube.com/watch?v=hesjApxDlj0"
  why: "무릎 부담을 낮춘 홈트 후보로 체중감량 운동 선택지가 필요할 때 참고 가능하다."
  caution: "스쿼트·런지·점프성 동작이 나오면 생략하고, 통증을 참고 진행하지 않는다."
  good_when:
    - "평지 걷기 대신 실내에서 짧게 움직이고 싶은 날"
  avoid_when:
    - "무릎 불안정이나 목 통증이 올라온 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: neck-os-gwanghwamun-001
  axis: neck-posture
  title: "의사와 함께하는 일자목 거북목 교정 맥켄지운동 목신전운동"
  channel: "광화문참바른정형외과"
  url: "https://www.youtube.com/watch?v=Hb3x831rOCI"
  why: "일자목과 경추 5-6번 디스크 소견이 있어 자세 리셋 후보로 적합하다."
  caution: "목 신전 중 팔저림, 손감각 저하, 힘빠짐, 통증 증가가 있으면 중단한다."
  good_when:
    - "현재 목 증상이 크지 않고 자세 관리가 필요한 날"
  avoid_when:
    - "팔저림, 힘빠짐, 감각저하가 뚜렷한 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: neck-rehab-prof-001
  axis: neck-posture
  title: "목통증 있는 사람이 무조건 피해야 하는 자세"
  channel: "현교수의 운동 재활, 건강한 다이어트"
  url: "https://www.youtube.com/watch?v=fRqqQGULjk8"
  why: "운동보다 먼저 피해야 할 자세를 잡는 데 적합하다."
  caution: "증상이 심하면 영상 운동보다 진료 기준을 우선한다."
  good_when:
    - "컴퓨터·스마트폰 사용 시간이 길 예정인 날"
  avoid_when:
    - "급성 통증이나 신경 증상이 있는 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: neck-ebs-001
  axis: neck-posture
  title: "귀하신 몸 - 목 디스크 막는 2주의 기적"
  channel: "EBSDocumentary (EBS 다큐)"
  url: "https://www.youtube.com/watch?v=suyTW9kCm88"
  why: "목디스크 예방과 생활 자세 관리를 큰 흐름으로 보기 좋은 공공성 높은 후보다."
  caution: "영상 속 모든 동작을 한 번에 따라 하기보다 통증 없는 범위만 선택한다."
  good_when:
    - "목 관리 루틴을 이해하고 싶을 때"
  avoid_when:
    - "팔저림·힘빠짐·감각저하가 새로 생긴 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: neck-hira-001
  axis: neck-posture
  title: "거북목, 허리디스크로 아프다면? 꼭 알아야 하는 스트레칭과 교정운동"
  channel: "HIRA건강보험심사평가원"
  url: "https://www.youtube.com/watch?v=K_qM3OE_Iw4"
  why: "공공기관 채널로 자세 교정과 스트레칭을 보수적으로 참고하기 좋다."
  caution: "목을 강하게 꺾거나 통증을 참는 동작은 제외한다."
  good_when:
    - "가벼운 목·등 자세 리셋이 필요한 날"
  avoid_when:
    - "목 통증이 갑자기 심해진 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: neck-redflag-mokhuri-001
  axis: neck-posture
  title: "목디스크 파열 시 주의해야 하는 마비, 힘빠짐, 양손 증상 체크하는 법"
  channel: "모커리 근육신경재활TV"
  url: "https://www.youtube.com/watch?v=takPP6eOqD4"
  why: "손감각 둔함 같은 애매한 증상을 관찰할 때 위험 신호를 구분하는 데 참고할 수 있다."
  caution: "불안을 키우기 위한 영상이 아니라 진료 기준 확인용으로만 쓴다."
  good_when:
    - "팔저림·손감각·힘빠짐 여부를 점검하고 싶은 날"
  avoid_when:
    - "건강 불안이 심해져 반복 확인만 하게 되는 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: knee-patella-doctor-001
  axis: knee-rehab
  title: "슬개골 탈구 환자분께서 알고 계셔야 할 사항들"
  channel: "관절 알려주는 의사_뼈선생"
  url: "https://www.youtube.com/watch?v=I7B8nyfWNA0"
  why: "과거 슬개골 반복 탈구 수술 이력과 현재 불안정감 맥락에 직접 관련된다."
  caution: "개별 수술 이력과 현재 영상검사 판단은 정형외과 상담을 우선한다."
  good_when:
    - "슬개골 불안정 관리 원칙을 다시 확인하고 싶을 때"
  avoid_when:
    - "영상만 보고 현재 무릎 상태를 자가진단하려 할 때"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: knee-strength-dingyo-001
  axis: knee-rehab
  title: "무릎에 제일 좋은 근력 운동"
  channel: "닥터딩요"
  url: "https://www.youtube.com/watch?v=Nh0FtY62mrU"
  why: "무릎 통증 관리와 근력운동 원칙을 참고하기 좋은 후보다."
  caution: "깊은 스쿼트·런지·통증 유발 동작은 제외하고 현재 세트 A/B/C 기준을 우선한다."
  good_when:
    - "통증 없는 범위에서 근력운동 원칙을 확인하고 싶은 날"
  avoid_when:
    - "잠김, 걸림, 붓기/열감이 있는 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: knee-lying-strength-001
  axis: knee-rehab
  title: "무릎통증 없이 누워서 할수 있는 하체근력 운동"
  channel: "국민건강TV"
  url: "https://www.youtube.com/watch?v=QnYWTcTkOuk"
  why: "무릎 깊은 굽힘 없이 낮은 강도 하체근력을 유지하는 후보로 적합하다."
  caution: "다리 들기 중 고정 부위 당김이나 찌릿함이 있으면 중단한다."
  good_when:
    - "걷기보다 낮은 부하 운동이 필요한 날"
  avoid_when:
    - "다리 들기 자체에서 내측/앞쪽 당김이 강한 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: knee-ebs-pain-001
  axis: knee-rehab
  title: "당신이 꼭 알아야 할 무릎 통증"
  channel: "EBS"
  url: "https://www.youtube.com/watch?v=PWSi0z8ojyU"
  why: "무릎 통증을 과사용/생활관리 관점에서 이해하는 참고 영상 후보다."
  caution: "슬개골 수술 이력은 개인 맥락이 다르므로 일반 정보로만 본다."
  good_when:
    - "무릎 통증과 생활 관리 원칙을 넓게 보고 싶을 때"
  avoid_when:
    - "구체적 진단을 영상에서 찾으려 할 때"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass

- id: knee-bridge-dongguk-001
  axis: knee-rehab
  title: "[맞춤 자가 운동] 1. 엉덩이 들어 올리기"
  channel: "동국대학교의료원"
  url: "https://www.youtube.com/watch?v=uoa_YxEEhR4"
  why: "아침 세트의 글루트 브릿지와 연결되는 낮은 부하 운동 후보다."
  caution: "허리 과신전이나 무릎 통증이 생기면 범위를 줄인다."
  good_when:
    - "세트 B-light에서 엉덩이/골반 안정성을 보강하고 싶은 날"
  avoid_when:
    - "허리 통증이나 무릎 앞쪽 통증이 올라오는 날"
  reviewed_at: 2026-06-29
  review_level: metadata-first-pass
```

## 제외한 유형 메모

- HIIT, 고강도 인터벌, 칼로리 폭탄류 영상은 무릎과 목 리스크 때문에 기본 후보에서 제외한다.
- 교정 ASMR, 뼈소리, 과장된 완치 표현 영상은 기본 후보에서 제외한다.
- 개인 체험 중심이거나 검색어와 무관한 영상은 제외한다.
