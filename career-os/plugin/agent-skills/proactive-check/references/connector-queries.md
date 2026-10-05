# 포지션 제외 판정

5단계에서 제외 기준이 `ready` 일 때만 읽는다.
조회 경로와 실패 처리는 [본문](../SKILL.md)의 3단계와 5단계를 따른다.

`ready` 일 때 공고 하나를 아래 순서로 판정한다. 하나라도 걸리면 그 공고는 내지 않는다.

1. `scope: posting` 규칙의 `url` 이 공고 주소와 같다
2. `scope: company` 규칙의 `company` 가 공고의 회사와 같다
3. `scope: company-role` 규칙의 `company` 가 같고 `titleKeywords` 가운데 하나가 공고 제목에 있다
4. `companyPreferences` 에서 그 회사의 `disposition` 이 `exclude` 다

규칙의 `expiresAt` 이 지났으면 그 규칙은 보지 않는다. Backend 가 이미 뺐지만 날짜를 한 번 더 본다.
