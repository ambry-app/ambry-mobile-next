import { GraphQLClient } from "graphql-request";
import type { TypedDocumentString } from "./graphql";
import type { Result } from "@/types/result";

export enum ExecuteAuthenticatedErrorCode {
  NETWORK_ERROR = "ExecuteAuthenticatedErrorCodeNetworkError",
  SERVER_ERROR = "ExecuteAuthenticatedErrorCodeServerError",
  GQL_ERROR = "ExecuteAuthenticatedErrorCodeGqlError",
  UNAUTHORIZED = "ExecuteAuthenticatedErrorCodeUnauthorized",
}

interface AuthenticatedNetworkError {
  code: ExecuteAuthenticatedErrorCode.NETWORK_ERROR;
}

interface AuthenticatedServerError {
  code: ExecuteAuthenticatedErrorCode.SERVER_ERROR;
  status: number;
}

interface AuthenticatedGqlError {
  code: ExecuteAuthenticatedErrorCode.GQL_ERROR;
  message: string;
  additionalErrors?: string[];
}

interface AuthenticatedUnauthorizedError {
  code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED;
}

export type ExecuteAuthenticatedError =
  | AuthenticatedNetworkError
  | AuthenticatedServerError
  | AuthenticatedGqlError
  | AuthenticatedUnauthorizedError;

export async function executeAuthenticated<TResult, TVariables>(
  url: string,
  token: string,
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<Result<TResult, ExecuteAuthenticatedError>> {
  let response;

  try {
    response = await fetch(`${url}/gql`, {
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
  } catch (error) {
    return {
      success: false,
      error: {
        code: ExecuteAuthenticatedErrorCode.NETWORK_ERROR,
      },
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: {
        code: ExecuteAuthenticatedErrorCode.SERVER_ERROR,
        status: response.status,
      },
    };
  }

  const json = await response.json();

  if (json.errors?.[0]?.message === "unauthorized") {
    return {
      success: false,
      error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
    };
  }

  if (json.errors?.length >= 1) {
    const [error, ...rest] = json.errors;

    return {
      success: false,
      error: {
        code: ExecuteAuthenticatedErrorCode.GQL_ERROR,
        message: error.message,
        additionalErrors: rest.map(
          (error: { message: string }) => error.message,
        ),
      },
    };
  }

  return { success: true, result: json.data as TResult };
}

export enum ExecuteErrorCode {
  NETWORK_ERROR = "ExecuteErrorCodeNetworkError",
  GQL_ERROR = "ExecuteErrorCodeGqlError",
  SERVER_ERROR = "ExecuteErrorCodeServerError",
}

interface NetworkError {
  code: ExecuteErrorCode.NETWORK_ERROR;
}

interface ServerError {
  code: ExecuteErrorCode.SERVER_ERROR;
  status: number;
}

interface GqlError {
  code: ExecuteErrorCode.GQL_ERROR;
  message: string;
  additionalErrors?: string[];
}

export type ExecuteError = NetworkError | ServerError | GqlError;

export async function execute<TResult, TVariables>(
  url: string,
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<Result<TResult, ExecuteError>> {
  let response;

  try {
    response = await fetch(`${url}/gql`, {
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
  } catch (error) {
    return {
      success: false,
      error: {
        code: ExecuteErrorCode.NETWORK_ERROR,
      },
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: {
        code: ExecuteErrorCode.SERVER_ERROR,
        status: response.status,
      },
    };
  }

  const json = await response.json();

  if (json.errors?.length >= 1) {
    const [error, ...rest] = json.errors;

    return {
      success: false,
      error: {
        code: ExecuteErrorCode.GQL_ERROR,
        message: error.message,
        additionalErrors: rest.map(
          (error: { message: string }) => error.message,
        ),
      },
    };
  }

  return { success: true, result: json.data as TResult };
}
