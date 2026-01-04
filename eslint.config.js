const { defineConfig, globalIgnores } = require("eslint/config");

const prettier = require("eslint-plugin-prettier");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const boundaries = require("eslint-plugin-boundaries");
const js = require("@eslint/js");

const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    extends: compat.extends("expo", "prettier"),

    plugins: {
      prettier,
      "simple-import-sort": simpleImportSort,
      boundaries,
    },

    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    settings: {
      "boundaries/elements": [
        { type: "ui", pattern: "src/components/**" },
        { type: "stores", pattern: "src/stores/**" },
        { type: "services", pattern: "src/services/**" },
        { type: "graphql", pattern: "src/graphql/**" },
        { type: "db", pattern: "src/db/**" },
        { type: "utils", pattern: "src/utils/**" },
      ],
      "boundaries/ignore": ["**/*.test.ts", "**/*.test.tsx"],
    },

    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-deprecated": "warn",

      // Import sorting: auto-fixable, separates external from internal
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // External packages (react, expo, etc.)
            ["^react", "^@?\\w"],
            // Internal aliases (@/, @assets/, @drizzle/, @test/)
            ["^@/", "^@assets/", "^@drizzle/", "^@test/"],
            // Relative imports
            ["^\\."],
          ],
        },
      ],
      "simple-import-sort/exports": "error",

      // Enforce absolute imports over relative parent imports
      // and restrict direct TrackPlayer imports
      // "no-restricted-imports": [
      //   "error",
      //   {
      //     paths: [
      //       {
      //         name: "react-native-track-player",
      //         message:
      //           "Import from @/services/trackplayer-wrapper instead of react-native-track-player directly.",
      //       },
      //     ],
      //     patterns: [
      //       {
      //         group: ["../*"],
      //         message:
      //           "Use absolute imports (@/... or @test/...) instead of relative parent imports",
      //       },
      //     ],
      //   },
      // ],

      ...boundaries.configs.recommended.rules,
      "boundaries/element-types": [
        2,
        {
          default: "disallow",
          rules: [
            // UI can import from services, stores, utils (not db directly)
            {
              from: "ui",
              allow: ["ui", "stores", "services", "utils"],
            },

            // Stores are PURE STATE - can only import utils and other stores
            { from: "stores", allow: ["stores", "utils"] },

            // Services can import db, graphql, utils, stores, other services (not UI)
            {
              from: "services",
              allow: ["services", "stores", "graphql", "db", "utils"],
            },

            // GraphQL layer only imports utils (pure network calls)
            { from: "graphql", allow: ["graphql", "utils"] },

            // DB layer only imports utils (and other db modules)
            { from: "db", allow: ["db", "utils"] },

            // Utils are leaf nodes - no imports from other layers
            { from: "utils", allow: ["utils"] },
          ],
        },
      ],
    },
  },
  // Allow the wrapper file to import from react-native-track-player
  // {
  //   files: ["src/services/trackplayer-wrapper.ts"],
  //   rules: {
  //     "no-restricted-imports": [
  //       "error",
  //       {
  //         patterns: [
  //           {
  //             group: ["../*"],
  //             message:
  //               "Use absolute imports (@/... or @test/...) instead of relative parent imports",
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // },
  globalIgnores(["**/expo-env.d.ts", "src/graphql/client/*"])
]);