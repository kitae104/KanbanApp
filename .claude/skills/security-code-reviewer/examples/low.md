# 🟢 LOW 취약점 예시

## 1. 보안 헤더 / CSP

### 취약
- 문제: 헤더가 없으면 클릭재킹, MIME 스니핑, 프레임워크 정보 노출이 쉬움

```typescript
const nextConfig: NextConfig = {};
export default nextConfig;
```

### 안전
- 개선: 기본 보안 헤더 지정, `X-Powered-By` 제거 (출처: `next.config.ts`)

```typescript
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};
```

> 현재 CSP는 Next.js 인라인 스크립트 때문에 `script-src 'unsafe-inline'`을 허용한다. nonce 기반 CSP 전환은 후속 과제로 알려져 있으니, 리뷰에서는 "수용된 위험"으로 표기하고 `unsafe-eval`이 운영에 새는지만 확인한다.

## 2. 로그에 민감정보 기록

### 취약
- 문제: 로그가 유출되거나 수집 도구에 쌓이면 비밀번호·토큰이 노출됨

```typescript
console.log("login attempt", { email, password });
console.error("session created", token);
```

### 안전
- 개선: 식별 가능한 최소 정보만 남기고 비밀 값은 제외

```typescript
console.log("login attempt", { userId });
```

## 3. 의존성 취약점

### 취약
- 문제: 알려진 CVE가 있는 버전을 계속 사용

```json
{ "dependencies": { "some-lib": "1.2.0" } }
```

### 안전
- 개선: 정기적으로 점검하고 패치 버전을 올림. 이 프로젝트는 버전을 고정(`"next": "16.3.6"`)해 두었으므로 업데이트는 의식적으로 수행

```bash
npm audit --omit=dev
npm outdated
```
