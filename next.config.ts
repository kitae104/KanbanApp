import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * 보안 헤더 (plan §8, T-024).
 *
 * 이 앱은 정적으로 렌더링되고(향후 정적 호스팅 예정), Next.js의 nonce 방식은 동적 렌더링에서만
 * 동작한다. 그래서 Next.js 공식 가이드의 "nonce 없는 CSP"를 따른다. Next.js가 넣는 인라인
 * 스크립트 때문에 script-src에 'unsafe-inline'이 필요하고, 개발 서버의 HMR은 'unsafe-eval'을 쓴다.
 * dnd-kit은 드래그 위치를 인라인 style로 주므로 style-src에도 'unsafe-inline'이 필요하다.
 * XSS의 1차 방어는 React 텍스트 출력과 ESLint react/no-danger 규칙이다 (NFR-9).
 * 로컬 http 환경에서 테스트하므로 upgrade-insecure-requests는 넣지 않는다.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
