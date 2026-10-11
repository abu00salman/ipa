import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: {
      DATA_DIR: "./data/test",
      CERT_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
      ADMIN_EMAIL: "admin@example.com",
    },
  },
});
