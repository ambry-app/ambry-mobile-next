const { defineConfig, globalIgnores } = require("eslint/config");

const prettier = require("eslint-plugin-prettier");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
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
    },

    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
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
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native-track-player",
              message:
                "Import from @/services/trackplayer-wrapper instead of react-native-track-player directly.",
            },
          ],
          patterns: [
            {
              group: ["../*"],
              message:
                "Use absolute imports (@/... or @test/...) instead of relative parent imports",
            },
          ],
        },
      ],
    },
  },
  // Allow the wrapper file to import from react-native-track-player
  {
    files: ["src/services/trackplayer-wrapper.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Use absolute imports (@/... or @test/...) instead of relative parent imports",
            },
          ],
        },
      ],
    },
  },
  globalIgnores(["**/expo-env.d.ts", "src/graphql/client/*"]),
]);
