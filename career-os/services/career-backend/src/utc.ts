/**
 * 프로세스 시간대를 UTC 로 고정한다.
 *
 * 시각 컬럼이 모두 `DATETIME(3)` 이라 시간대를 저장하지 않는다.
 * 프로세스가 UTC 가 아니면 드라이버가 저장된 값을 지역 시간으로 해석해,
 * 다시 읽은 시각이 실제와 어긋난다.
 *
 * 다른 모듈보다 먼저 평가되도록 진입점의 첫 import 로 둔다.
 * 연결 수준의 고정은 `src/prisma/prisma.service.ts` 의 `timezone` 옵션이 담당한다.
 */
process.env.TZ = "UTC";
