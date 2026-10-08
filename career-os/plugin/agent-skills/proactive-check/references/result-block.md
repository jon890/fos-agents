# 결과 블록 예

6단계에서 JSON 예가 필요할 때만 읽는다.
칸과 판정 기준은 [본문](../SKILL.md)의 6단계를 따른다.

## 알릴 것이 없을 때

```text
<fos-check-result>
{"version": 3, "outcome": "NOTHING_NEW", "findings": [], "problemCandidates": []}
</fos-check-result>
```

## 업무 준비 부족을 문제 후보로 낼 때

아래 맥락은 합성 예다. 사용자는 다음 달 Kafka 업무를 맡으며 트랜잭션 처리 경계를 아직 모른다고 밝혔다.

```text
<fos-check-result>
{
  "version": 3,
  "outcome": "FINDINGS",
  "summary": "다음 달 맡을 이벤트 파이프라인에 필요한 Kafka 트랜잭션 자료를 찾았어요.",
  "findings": [
    {
      "area": "study",
      "topicKey": "study:kafka-exactly-once",
      "title": "Kafka 트랜잭션과 exactly-once 처리 설명서",
      "sourceUrl": "https://docs.example.org/kafka/transactions",
      "checkedAt": "2026-10-05T00:00:00Z",
      "publishedAt": "2026-08-20",
      "freshness": "CURRENT",
      "whyItMatters": "learning-interests 가 이번 주에 Kafka 정확히 한 번 처리를 우선 주제로 올렸다.",
      "facts": ["transactional.id 를 설정한 producer 만 트랜잭션을 연다고 설명한다"],
      "inferences": ["consumer 쪽 isolation.level 설정도 함께 봐야 할 것으로 보인다"],
      "unknowns": ["맡을 업무가 쓰는 Kafka 버전"],
      "next": {"type": "ACTION", "text": "설명서의 트랜잭션 절을 읽고 outbox 방식과 비교해 본다"}
    }
  ],
  "questions": [],
  "followUpCandidates": [],
  "sourceFailures": [],
  "report": {"changed": ["Kafka 학습 우선순위가 바뀌었어요."], "done": ["트랜잭션 원문을 확인했어요."], "next": ["업무 준비에 필요한 설정을 비교해 보세요."]},
  "problemCandidates": [
    {
      "problemKey": "study:preparation:kafka-transactions",
      "problem": "다음 달 이벤트 파이프라인 업무를 맡지만 트랜잭션 설정과 처리 경계를 아직 이해하지 못했다.",
      "relatedGoal": "다음 달 Kafka 이벤트 파이프라인 업무 준비",
      "evidence": ["study:kafka-exactly-once"],
      "proposedAction": {"type": "ACTION", "text": "트랜잭션 설정과 outbox 방식의 처리 경계를 비교해 본다"},
      "confidence": "MEDIUM",
      "expectedBenefit": "업무 시작 전에 중복 처리와 트랜잭션 경계를 판단하는 데 도움이 될 수 있다",
      "sideEffect": "NONE"
    }
  ]
}
</fos-check-result>
```

## 발견은 있지만 문제가 없을 때

새 자료를 확인했어도 사용자의 목표를 막는 문제가 없으면 `FINDINGS` 의 발견은 그대로 두고 `problemCandidates` 만 `[]` 로 쓴다.
위 공부 예에서 사용자가 이미 업무 준비를 끝냈고 새 설명서를 참고하려는 경우가 해당한다.

```text
<fos-check-result>
{
  "version": 3,
  "outcome": "FINDINGS",
  "summary": "Kafka 트랜잭션 설명서를 확인했어요.",
  "findings": [
    {
      "area": "study",
      "topicKey": "study:kafka-exactly-once",
      "title": "Kafka 트랜잭션과 exactly-once 처리 설명서",
      "sourceUrl": "https://docs.example.org/kafka/transactions",
      "checkedAt": "2026-10-05T00:00:00Z",
      "publishedAt": "2026-08-20",
      "freshness": "CURRENT",
      "whyItMatters": "사용자가 업무 준비를 마쳤고, 필요할 때 참고할 설명서를 요청했다.",
      "facts": ["transactional.id 를 설정한 producer 만 트랜잭션을 연다고 설명한다"],
      "inferences": [],
      "unknowns": [],
      "next": {"type": "ACTION", "text": "필요할 때 트랜잭션 절을 다시 참고한다"}
    }
  ],
  "questions": [],
  "followUpCandidates": [],
  "sourceFailures": [],
  "problemCandidates": []
}
</fos-check-result>
```

지켜볼 동향을 재조사했지만 원문이 그대로면 `NOTHING_NEW`, 빈 `findings` 와 빈 `problemCandidates` 로 끝내고, 본문의 watch 규칙대로 `summary` 에 조사한 항목을 남긴다.
