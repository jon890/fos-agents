# Phase 04 — LLM 채팅 UI/API와 chat history 영속화

**Model**: sonnet
**Status**: pending

---

## 목표

Claude API를 이용한 LLM 채팅 기능을 구현하고 채팅 이력을 MySQL에 영속화한다.
채팅 컨텍스트는 career-os 파일을 읽기 전용으로 주입한다.

**범위 외**:

- career-os 파일을 수정하거나 fos-study에 발행하는 코드를 추가하지 않는다.
- 채팅 응답이 외부 사이트에 접근하거나 candidate-profile.md를 수정하지 않는다.
- 채용 공고 제출 자동화, 로그인 자동화는 구현하지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-046
- `career-os/docs/data-schema.md` — llm_chat_sessions, llm_chat_messages 스키마
- `career-os/docs/code-architecture.md` — fos-career 웹 대시보드 섹션

---

## 작업 항목

### 1. LLM 채팅 MySQL 테이블 추가 (`db/schema.ts`)

phase-03의 `~/services/fos-career/db/schema.ts`에 두 테이블을 추가한다.

**llm_chat_sessions**:
- `id`: varchar(128) primary key (UUID)
- `adminUserId`: int not null references admin_users(id) on delete cascade
- `title`: varchar(255) not null default 'New Chat'
- `createdAt`: datetime not null default now()
- `updatedAt`: datetime not null default now()

**llm_chat_messages**:
- `id`: bigint auto-increment primary key
- `sessionId`: varchar(128) not null references llm_chat_sessions(id) on delete cascade
- `role`: enum('user','assistant') not null
- `content`: text not null
- `contextSnapshotJson`: json nullable (채팅 시점 career-os 컨텍스트 요약 — 전체 파일 내용 저장 금지)
- `createdAt`: datetime not null default now()

### 2. 채팅 API (`app/api/chat/route.ts`)

POST body: `{ sessionId?: string, message: string }`

처리 순서:

1. 세션 검증 (`lib/db/session.ts` 사용)
2. `sessionId`가 없으면 `llm_chat_sessions`에 새 레코드 생성
3. career-os 컨텍스트 주입 (읽기 전용):
   - `config/candidate-profile.md` — 최대 4000자
   - frontdoor queue의 `needs_user_start_approval` 상태 레코드 목록 (최대 5개)
   - ledger의 최근 5개 레코드 (status, company, role만)
4. Anthropic SDK (`@anthropic-ai/sdk`)로 Claude API 호출 — 모델 `claude-sonnet-4-6`
5. system prompt 내용:
   - 역할: career-os 데이터를 분석해 커리어 전략을 조언하는 어시스턴트
   - 제약 명시: career-os 파일 수정 불가, fos-study 발행 불가, 외부 사이트 접근 불가, 채용 자동 제출 불가
6. 응답 스트리밍 (`ReadableStream` 반환)
7. user 메시지와 assistant 응답을 `llm_chat_messages`에 저장
8. `contextSnapshotJson`에 주입 컨텍스트 메타데이터 저장 (파일 경로 목록 + 레코드 count만, 전체 내용 아님)
9. audit_logs에 `chat.message_sent` 기록

### 3. 채팅 세션 목록 API

**GET `/api/chat/sessions/route.ts`**:
- 현재 관리자의 채팅 세션 목록 반환 (최근 20개, updatedAt 내림차순)
- 응답: `{ sessions: { id, title, createdAt, updatedAt }[] }`

**DELETE `/api/chat/sessions/[id]/route.ts`**:
- 세션 및 연결된 메시지 삭제 (cascade)
- 본인 세션인지 확인 후 삭제

**GET `/api/chat/sessions/[id]/messages/route.ts`**:
- 특정 세션의 메시지 목록 반환 (오래된 순)
- 응답: `{ messages: { id, role, content, createdAt }[] }`

### 4. 채팅 UI (`app/dashboard/chat/page.tsx`)

클라이언트 컴포넌트.

레이아웃:

- 좌측 사이드바: 채팅 세션 목록 (최근 20개) + 새 채팅 시작 버튼
- 우측 메인 영역: 선택한 세션의 대화 내용 + 하단 입력창

기능:

- 세션 목록 로드 (`GET /api/chat/sessions`)
- 메시지 목록 로드 (`GET /api/chat/sessions/[id]/messages`)
- 메시지 전송 및 스트리밍 응답 실시간 표시 (`fetch` + `ReadableStream`)
- career-os 읽기 전용 컨텍스트 사용 중임을 UI 상단에 표시 (예: "career-os 데이터를 읽기 전용으로 참조합니다")

### 5. 홈 페이지 및 네비게이션 업데이트

phase-02에서 만든 `app/page.tsx`와 공통 레이아웃에 `/dashboard/chat` 링크를 추가한다.
공통 네비게이션이 없으면 간단한 `app/dashboard/layout.tsx`를 만들어 Positions / Applications / Chat 링크를 추가한다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
cd ~/services/fos-career

# TypeScript 타입 확인
pnpm tsc --noEmit

# 파일 존재 확인
ls app/api/chat/route.ts
ls app/api/chat/sessions/route.ts
ls "app/api/chat/sessions/[id]/route.ts"
ls app/dashboard/chat/page.tsx

# 스키마에 llm_chat 테이블 포함 확인
grep -q "llm_chat_sessions\|llmChatSessions" db/schema.ts
grep -q "llm_chat_messages\|llmChatMessages" db/schema.ts

# 안전 경계: career-os 어댑터 쓰기 없음
grep -n "writeFile\|appendFile\|fs\.write\|createWriteStream" lib/career-os/adapter.ts \
  && echo "PHASE_FAILED: write operation in career-os adapter" \
  || echo "OK: career-os adapter is read-only"

# API 키 하드코딩 없음
grep -rn "sk-ant-" app/ lib/ 2>/dev/null \
  && echo "PHASE_FAILED: API key hardcoded" \
  || echo "OK: no hardcoded API key"
```

## Blocked 조건

- phase-03이 완료되지 않아 `~/services/fos-career/middleware.ts`가 없으면 `PHASE_BLOCKED: phase-03 not complete`를 출력하고 exit 2.
- `pnpm tsc --noEmit`이 에러를 반환하면 `PHASE_FAILED: TypeScript type check failed`를 출력하고 exit 1.
- career-os 어댑터에 쓰기 함수가 추가되면 `PHASE_FAILED: career-os adapter must remain read-only`를 출력하고 exit 1.
- `ANTHROPIC_API_KEY`가 코드에 하드코딩되면 `PHASE_FAILED: API key must not be hardcoded`를 출력하고 exit 1.
