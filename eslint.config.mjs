import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // NFR-9: 사용자 입력은 텍스트 노드로만 출력한다.
      "react/no-danger": "error",
    },
  },
  {
    // NFR-6: SQL은 파라미터 바인딩($1)만 쓴다. query()에 값이 보간된 템플릿 문자열을 넘기지 않는다.
    files: ["src/server/**", "scripts/**", "tests/db/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...["callee.name", "callee.property.name"].map((callee) => ({
          selector: `CallExpression[${callee}='query'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length>0]`,
          message: "SQL에 값을 보간하지 말고 $1 파라미터와 values 배열을 쓰세요.",
        })),
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
