import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // "node" by default (not jsdom) — this repo's tests so far are pure
    // functions and server-only route helpers, and jsdom's `browser`
    // package.json condition resolution breaks the `server-only` guard
    // package. Component tests can opt into jsdom per-file via a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // "server-only"'s guard throws unconditionally once Vite resolves it
      // via the package's "browser" export condition (which it does by
      // default, independent of the jsdom/node test environment) — stub it
      // to a no-op here so server-only utilities (rate-limit.ts,
      // firebase-admin.ts) are still testable. The real Next.js build never
      // uses this alias, so the guard still works for its actual purpose
      // (catching an accidental client-side import) in production.
      "server-only": path.resolve(__dirname, "./vitest.server-only-stub.ts"),
    },
  },
});
