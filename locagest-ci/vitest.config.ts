import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Les modules sont importes avec le prefixe @/, comme le fait Next.js
      // grace au chemin "@/*" declare dans tsconfig.json.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
