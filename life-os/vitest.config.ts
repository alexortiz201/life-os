// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [
    // Reads tsconfig.json and applies:
    // baseUrl: "src"
    // paths: { "#/*": ["*"] }
    tsconfigPaths(),
  ],

  resolve: {
    alias: [
      // Optional hard fallback. With tsconfigPaths() this usually isn’t needed,
      // but it’s helpful if something ever runs without the plugin.
      {
        find: /^#\/(.*)$/,
        replacement: path.resolve(__dirname, "src") + "/$1",
      },
    ],
  },

  test: {
    environment: "node",

    // Since you're coming from node:test/assert, you may prefer "no magic".
    // If you WANT describe/it/expect globals, flip to true.
    globals: false,

    // Your tsconfig includes ["src", "tests"], so match both.
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "tests/**/*.test.ts",
      "tests/**/*.spec.ts",
    ],

    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{git,cache,output,temp}/**",
    ],

    testTimeout: 10_000,
    hookTimeout: 10_000,

    reporters: ["default"],

    // If you hit any ESM/CJS friction with NodeNext deps, uncomment:
    // deps: { inline: ["fp-ts", "zod"] },
  },

  esbuild: {
    target: "es2022",
  },
});
