# 결과 블록 예

6단계에서 JSON 예가 필요할 때만 읽는다.
칸과 판정 기준은 [본문](../SKILL.md)의 6단계를 따른다.

## 알릴 것이 없을 때

```text
<fos-check-result>
{"version": 1, "outcome": "NOTHING_NEW", "findings": []}
</fos-check-result>
```

## 공부 발견이 있을 때

```text
<fos-check-result>
{
  "version": 1,
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
  "sourceFailures": []
}
</fos-check-result>
```
