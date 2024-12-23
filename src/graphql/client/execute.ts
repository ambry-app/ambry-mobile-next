import { router } from "expo-router";
import type { TypedDocumentString } from "./graphql";

export async function executeAuthenticated<TResult, TVariables>(
  url: string,
  token: string,
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch(`${url}/gql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/graphql-response+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (response.status === 401) {
    return router.replace("/sign-out");
  }

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const json = await response.json();
  return json.data as TResult;
}

export async function execute<TResult, TVariables>(
  url: string,
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch(`${url}/gql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/graphql-response+json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const json = await response.json();
  return json.data as TResult;
}
