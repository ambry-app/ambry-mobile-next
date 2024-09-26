import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "http://localhost:4000/gql",
  documents: ["db/**/*.ts"],
  ignoreNoDocuments: true,
  generates: {
    "./graphql/client/": {
      preset: "client",
      config: {
        documentMode: "string",
      },
    },
    "./graphql/schema.graphql": {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
};

export default config;
