---
name: security-code-reviewer
description: 칸반 앱(Next.js 16 + TypeScript + PostgreSQL)의 보안 코드 리뷰를 수행합니다. 인증·세션, 권한(IDOR), SQL 인젝션, XSS, CSRF, 입력 검증, 비밀 관리 취약점을 찾아 HIGH/MEDIUM/LOW로 분류하고, 취약한 코드와 안전한 코드를 함께 제시합니다. "보안 리뷰", "취약점 점검", "security review" 요청에 사용합니다.
allowed-tools: Read, Grep, Glob
---

# 보안 코드 리뷰

## 대상 환경
- 언어/프레임워크: TypeScript, Next.js 16 (App Router, Route Handler, Server Action), React 19
- DB: PostgreSQL (`pg`, 파라미터 쿼리), 검증: `zod`
- 인증: argon2id 해시 + DB 세션(쿠키 `kanban_session`, 토큰은 sha256으로 저장)
- 배포: Vercel (서버리스/Fluid Compute). 환경 변수 범위(Production/Preview/Development), Preview 배포 보호, DB 연결 TLS와 연결 수를 함께 점검

## 리뷰 범위 (우선순위 순)
1. `src/app/api/**/route.ts`, `src/app/(auth)/actions.ts` — 외부에 열린 진입점
2. `src/server/**` — 인증, 세션, DB 쿼리, HTTP 공통 처리
3. `src/lib/**/schema.ts` — 입력 검증 규칙
4. `next.config.ts`, `src/proxy.ts` — 보안 헤더, 접근 제어
5. `db/migrations/*.sql` — 제약 조건, 유니크 키
6. `package.json` — 의존성 (`npm audit` 결과가 있으면 함께 확인)
7. `vercel.json`/`vercel.ts`, `.env*` 사용처 — Vercel 환경 변수, 크론·함수 엔드포인트 보호

## 점검 항목과 심각도

### 🔴 HIGH — 즉시 수정 (데이터 유출, 계정 탈취, 권한 우회)
- SQL 인젝션: 쿼리에 문자열을 직접 이어 붙임
- 권한 우회(IDOR): 요청 본문·URL의 `boardId`/`userId`를 그대로 신뢰, SQL에 `board_id` 조건 누락
- 인증 누락: Route Handler/Server Action에서 세션 확인 없이 데이터 접근 (Server Action도 공개 엔드포인트)
- XSS: 사용자 입력을 `dangerouslySetInnerHTML` 등으로 출력
- 비밀 노출: 키·비밀번호 하드코딩, `NEXT_PUBLIC_` 접두사에 비밀 값, `.env*` 커밋
- 약한 자격 증명 저장: 평문·빠른 해시(md5/sha)로 비밀번호 저장, 세션 토큰 원문 저장

### 🟡 MEDIUM — 조만간 수정 (공격 난이도를 낮추는 결함)
- CSRF: 상태 변경 Route Handler에 Origin 확인 없음
- 입력 검증 누락: `request.json()` 결과를 스키마 검증 없이 사용
- 계정 열거·무차별 대입: 로그인 실패 메시지/응답 시간 차이, 시도 제한 없음
- 세션 쿠키 설정: `httpOnly`/`secure`/`sameSite` 누락, 로그인 시 토큰 재발급 안 함
- 프록시 헤더 신뢰: `x-forwarded-for`를 검증 없이 레이트 리밋 키로 사용 (Vercel은 이 헤더를 덮어써 위조를 막는다고 알려져 있으나, 공식 문서로 확인하고 Vercel 밖 실행 환경이 없는지 확인)
- Vercel 배포 설정: DB 연결에 TLS 미적용, Preview 배포가 운영 DB·운영 비밀을 공유, Preview URL이 보호 없이 공개, 크론/내부 엔드포인트에 인증 없음
- 서버리스 DB 연결: 인스턴스마다 큰 `pg` 풀을 만들어 연결 한도 초과(가용성 문제)
- 오류 정보 노출: 스택 트레이스·SQL 오류를 응답에 포함

### 🟢 LOW — 선택 개선 (방어 심층화)
- CSP `unsafe-inline`/`unsafe-eval`, 보안 헤더 누락, `X-Powered-By` 노출
- 로그에 이메일·비밀번호·토큰 기록
- 의존성 취약점(`npm audit`), 사용하지 않는 패키지

## 리뷰 절차
1. 범위의 파일을 Glob/Grep으로 찾는다. 유용한 검색 예: `query(`·`.query<`(SQL), `dangerouslySetInnerHTML`, `process.env`, `NEXT_PUBLIC_`, `request.json()`, `cookies()`.
2. 진입점마다 "인증 → 권한 범위(boardId) → 입력 검증 → 쿼리" 순서로 빠짐이 없는지 확인한다.
3. 발견 항목을 심각도별로 분류하고, 해당 심각도의 예시 파일을 Read로 참조해 수정안을 제시한다.
4. 확신이 없으면 "확인 필요"로 표시한다. 코드에서 확인하지 못한 취약점을 단정하지 않는다.

## 보고 형식
각 이슈마다 아래 형식을 쓴다.

```
[🔴 HIGH] 제목
위치: 파일경로:줄번호
문제: 무엇이 왜 위험한가 (공격 시나리오 한 줄)
취약한 코드: (실제 코드)
안전한 코드: (수정안)
```

마지막에 HIGH/MEDIUM/LOW 개수 요약과, 이미 잘 지켜지고 있는 항목(예: 파라미터 쿼리, argon2id)을 짧게 적는다.

## Examples
`examples/` 폴더에 심각도별 취약/안전 코드 예시가 있다. 리뷰 중 해당 유형을 발견하면 Read로 참조한다.
- `examples/high.md`: SQL 인젝션, IDOR, 인증 누락, XSS, 비밀 노출
- `examples/medium.md`: CSRF, 입력 검증, 계정 열거, 세션 쿠키, 프록시 헤더, Vercel 설정(DB TLS·Preview 분리), 오류 노출
- `examples/low.md`: 보안 헤더/CSP, 로그 민감정보, 의존성

### 예시 유지 규칙
예시의 "안전" 코드는 이 프로젝트의 실제 코드(출처 표시)를 기준으로 한다. 출처 코드가 바뀌면 예시도 함께 고친다.
