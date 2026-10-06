import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Component and lib tests. Async Server Components can't render here;
// they are covered by Playwright (docs/decisions/2026-10-06-frontend-stack.md).
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/components/**", "src/lib/**"],
      exclude: ["**/*.test.{ts,tsx}"],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
