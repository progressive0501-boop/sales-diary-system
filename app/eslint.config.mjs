import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import vitest from "eslint-plugin-vitest";

// Note: eslint-plugin-tailwindcss は Tailwind CSS v4 に未対応のため除外
// Note: @typescript-eslint/no-floating-promises は typed linting が必要なため除外

const eslintConfig = defineConfig([
  // Next.js + TypeScript 基本設定
  ...nextVitals,
  ...nextTs,

  // 全ファイル共通ルール
  {
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/consistent-type-imports": "error",

      // 一般
      "no-throw-literal": "error",
    },
  },

  // テストファイル専用ルール
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/expect-expect": "error",
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "warn",
      "vitest/consistent-test-it": ["warn", { fn: "test" }],
    },
  },

  // ignores
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
