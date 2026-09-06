# 심사자가 이력서에서 보는 것

회사와 무관하게 적용하는 판단 기준이다.
회사별 채용 기준은 `library/company-notes/<회사>.md`, 공고 하나의 요구는 그 공고의 `evidence/posting.md` 가 담는다.

각 항목은 공개 자료에서 확인한 것이며 출처와 확인일을 함께 남긴다.
채용 기준은 바뀌므로, 확인일이 오래된 항목은 다시 확인한 뒤 사용한다.

## 튜토리얼로 판정되는 문장

인력 회사 KORE1 이 RAG 엔지니어 채용 안내에서 직접 나열한 문장이다.
확인일 2026-09-06, 출처 [KORE1](https://www.kore1.com/hire-rag-engineers-2026/).

- `Built a RAG chatbot using LangChain and Pinecone`
- `Fine-tuned an LLM on company documentation`
- `Implemented vector search for semantic retrieval`
- `Reduced hallucinations by 40%`

같은 글이 이렇게 판정한다.

> Each of those bullets describes a tutorial. Three of them describe the same tutorial.

공통점은 **도구 이름과 동작만 있고 그 환경에서만 생기는 문제가 없다**는 것이다.

## 운영을 겪은 사람만 쓰는 낱말

같은 글이 진짜 실무자가 말한다고 든 것이다.

- `silent retrieval drift`
- `embedding model deprecations breaking indexes`
- `hallucinations surviving evaluation systems`
- `latency spikes from vector database shard rebalancing`

AI 인프라 채용 안내도 같은 방향이다.
확인일 2026-09-06, 출처 [PowerToFly](https://powertofly.com/up/hire-ai-infrastructure-engineers).

> The strongest tell is how a candidate describes their last production incident, a deployment rollback, a drift event, or an infrastructure failure with a documented fix.

경험이 없는 지원자의 특징은 이렇게 적었다.

> describe the project in general terms and never actually land on a measurement

**가장 최근에 겪은 운영 실패를 어떻게 서술하는지가 가장 강한 신호다.**
그 실패에 수치와 조치가 붙어 있으면 데모와 구분된다.

## 평가 체계 주장을 검증하는 질문

Eugene Yan 과 Jason Liu 가 공개한 면접 질문이다.
확인일 2026-09-06, 출처 [How to Interview and Hire ML/AI Engineers](https://eugeneyan.com/writing/how-to-interview/).

- `How did you collect the initial evaluation data and build the eval harness?`
- `How did you measure model performance over time, as it was retrained or updated?`
- `When model performance breached predefined thresholds, how did you respond?`

이력서에 평가 체계를 만들었다고 쓰려면 세 질문에 답할 수 있어야 한다.
답할 수 없으면 그 문장을 쓰지 않는다.

## 소유 범위를 결을 살려 쓰는 법

같은 글이 기여도 판별 방법을 적었다.

> Some candidates may overstate their role while others may be overly humble. Asking targeted questions can help tease this out: 'What was the hardest decision made on the project and who made that call?' or 'Can you share an example of when you disagreed with the team?'

**과장과 과한 겸손이 둘 다 문제다.**
소유를 보이는 축은 인원이 아니라 결정이다.
혼자 했다고 쓸 필요 없이, 내가 내린 결정과 의견이 갈렸던 지점을 쓰면 정직성과 소유가 함께 선다.

| 유형 | 문장 |
| --- | --- |
| 과장 | 색인 배치를 설계하고 개발했습니다 |
| 과한 겸손 | 팀에서 색인 배치를 개발했습니다 |
| 결을 살린 것 | 팀원들과 함께 개발했고, 재시작할 때 진행 상태가 초기화되어 후속 처리가 멈추는 문제를 추적해 저장된 상태를 다시 불러오도록 고쳤습니다 |

인력 회사가 신뢰하지 않는 표현으로 든 것은 `"Contributed to" phrasing without measurable ownership` 이다.
확인일 2026-09-06, 출처 [KORE1](https://www.kore1.com/hire-ml-platform-engineers-2026/).

## 여러 팀이 쓰는 기반이라는 주장의 근거

사용자 수를 밝힐 수 없을 때 대신 쓸 수 있는 것이다.
모두 인원이 아니라 상태를 말하므로 사내 전용 도구에도 적용된다.

| 근거 | 확인 방법 |
| --- | --- |
| 도입이 강제인지 자발인지 | 사용자가 스스로 골라 쓰는지, 아니면 규정이나 평가로 강제되는지 |
| 계속 쓰는 비율 | 새로 붙은 팀 수가 아니라 붙은 뒤 계속 쓰는 비율 |
| 사용자 팀이 보낸 기여 | 수정, 기능과 피드백이 사용자 쪽에서 오는지 |
| 구 시스템 종료 완료와 마지막 이전을 누가 했는지 | 가장 강한 근거다. 쓰는 팀이 없었으면 제거할 일 자체가 없다 |
| 신규 사용을 차단하는 도구를 만들었는지 | 제거하면서 새 사용이 계속 생기는 것을 막았는지 |
| 셀프서비스 비율과 요청 티켓 변화 | 매번 사람이 개입하던 것이 스스로 처리되는 쪽으로 갔는지 |
| 무엇을 먼저 만들지 정한 근거와 반대 의견 | 우선순위를 어떻게 정했고 누가 반대했는지 |
| 만족도 조사와 그 결과로 바꾼 것 | 물어본 뒤 실제로 바꾼 것이 있는지 |

확인일 2026-09-06, 출처 [CNCF Platform Engineering Maturity Model](https://tag-app-delivery.cncf.io/whitepapers/platform-eng-maturity-model/), [DORA](https://dora.dev/capabilities/platform-engineering/), [Software Engineering at Google 15장](https://abseil.io/resources/swe-book/html/ch15.html), [Will Larson, Migrations](https://lethain.com/migrations/).

CNCF 문서는 강제 도입을 반대 패턴으로 두고 이렇게 적었다.

> Platforms must be compelling to use, they cannot stand on a mandate alone.

**도입 팀 수는 강제일 수도 있어 한 번 더 의심받는다.**
구 시스템을 종료했고 남은 팀의 이전을 직접 했다는 서술은 숫자가 없어도 의심할 여지가 적다.

## AI 용어를 나열할 때의 위험

기술 선별 서비스 운영자가 자사 데이터를 공개한 것이다.
확인일 2026-09-06, 출처 [Hacker News 댓글](https://news.ycombinator.com/item?id=42912647).

> I actually just looked at our data a few days ago to see how candidates who listed LLMs or related terms on their resume did on our interview. On average, they did much worse (about half the pass rate, and double the hard-fail rate). I suspect this is a general 'corporate BS factor' and not anything about LLMs specifically, but it's certainly relevant.

작성자 본인이 LLM 자체가 아니라 용어를 나열하는 경향의 문제로 해석했다.
표본 크기와 측정 기간은 공개되지 않았으므로 경향으로만 읽는다.

**기술 목록 줄은 본문 근거와 떨어져 읽힌다.**
목록에 넣은 항목은 본문 어딘가에서 그 기술로 무엇을 판단했는지 설명되어야 한다.

## 한 줄이 무너지면 전체가 의심받는다

카카오에서 20년간 면접관을 한 사람의 진술이다.
확인일 2026-09-06, 출처 한빛+ 「면접관 입장에서 가장 뽑고 싶은 지원자는?」.

이력서 한 줄이 무너지면 문서 전체의 신뢰도가 내려가며, 사실과 의견을 구분해야 한다는 것이다.

현직 매니저가 이력서를 읽는 방식도 같은 방향이다.
탈락 사유부터 찾고 GitHub 커밋 이력을 실제로 연다.
확인일 2026-09-06, 출처 김태곤 「개발자 이력서, 사소한 체크리스트」와 「개발자 면접의 10가지 적신호」.
후자는 `스케일러블한 마이크로서비스` 류 수식 나열을 첫 번째 적신호로 들었다.

## 이력서에 적은 것은 전부 면접 방어 대상이다

2024년 토스 본사 서버 직무 인터뷰에서 떨어진 사람의 회고다.
확인일 2026-09-06, 출처 [탈락 후기](https://jimoou.github.io/daily/2024/03/19/post13.html).

면접관이 이력서에 적힌 Redis 를 집중해서 물었고, 본인은 이렇게 진단했다.

> 저는 '기능 구현'에만 급급해 '왜(Why) 이 기술이어야만 하는가?'에 대한 기술적 검증과 고민이 부족했습니다.

깊이 설명할 수 없는 기술은 이력서에서 뺀다.
뺀 것이 아까우면 그 기술로 무엇을 판단했는지를 먼저 확보한다.
