import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "http://localhost:4000/gql",
  documents: ["src/**/*.{ts,tsx}"],
  ignoreNoDocuments: true,
  generates: {
    "./src/graphql/client/": {
      preset: "client",
      config: {
        documentMode: "string",
        enumType: "native",
        scalars: {
          Date: { input: "Date | string", output: "string" },
          DateTime: { input: "Date | string", output: "string" },
          Decimal: "string",
        },
      },
    },
    "./src/graphql/schema.graphql": {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
};

export default config;
