/**
 * Fetch mock utilities for testing GraphQL API calls.
 *
 * Instead of mocking our own @/graphql/api functions, we mock at the network
 * boundary (fetch). This allows us to test real API function code while
 * controlling network responses.
 */

type GraphQLResponse<T = unknown> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};

type MockedFetch = jest.Mock<
  Promise<Response>,
  [input: RequestInfo | URL, init?: RequestInit]
>;

/**
 * Install a mock for global.fetch that can be configured per-test.
 * Call this in beforeEach to get a fresh mock.
 */
export function installFetchMock(): MockedFetch {
  const mockFetch = jest.fn<
    Promise<Response>,
    [input: RequestInfo | URL, init?: RequestInit]
  >();
  global.fetch = mockFetch;
  return mockFetch;
}

/**
 * Create a successful GraphQL response.
 */
export function graphqlSuccess<T>(data: T): GraphQLResponse<T> {
  return { data };
}

/**
 * Create a GraphQL error response.
 */
export function graphqlError(
  message: string,
  code?: string,
): GraphQLResponse<never> {
  return {
    errors: [{ message, extensions: code ? { code } : undefined }],
  };
}

/**
 * Create an unauthorized GraphQL error response.
 * This simulates what happens when the server rejects an invalid token.
 */
export function graphqlUnauthorized(): GraphQLResponse<never> {
  return graphqlError("unauthorized", "UNAUTHORIZED");
}

/**
 * Create a Response object that returns JSON.
 */
export function jsonResponse<T>(
  body: T,
  status = 200,
  statusText = "OK",
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone: function () {
      return this;
    },
  } as Response;
}

/**
 * Create a network error response.
 */
export function networkError(message = "Network error"): never {
  throw new TypeError(message);
}

/**
 * Configure mock fetch to return a GraphQL response.
 *
 * @example
 * ```typescript
 * const mockFetch = installFetchMock();
 *
 * // Success response
 * mockGraphQL(mockFetch, graphqlSuccess({ user: { id: "1", name: "Test" } }));
 *
 * // Error response
 * mockGraphQL(mockFetch, graphqlError("Unauthorized", "UNAUTHORIZED"));
 *
 * // Now call your API function - it will use the mocked fetch
 * const result = await getUser("1");
 * ```
 */
export function mockGraphQL<T>(
  mockFetch: MockedFetch,
  response: GraphQLResponse<T>,
  status = 200,
): void {
  mockFetch.mockResolvedValueOnce(jsonResponse(response, status));
}

/**
 * Configure mock fetch to return multiple GraphQL responses in sequence.
 * Useful for testing retry logic or multiple API calls.
 */
export function mockGraphQLSequence<T>(
  mockFetch: MockedFetch,
  responses: { response: GraphQLResponse<T>; status?: number }[],
): void {
  for (const { response, status = 200 } of responses) {
    mockFetch.mockResolvedValueOnce(jsonResponse(response, status));
  }
}

/**
 * Configure mock fetch to reject with a network error.
 */
export function mockNetworkError(
  mockFetch: MockedFetch,
  message = "Network error",
): void {
  mockFetch.mockRejectedValueOnce(new TypeError(message));
}

/**
 * Configure mock fetch to return an HTTP error (non-2xx status).
 */
export function mockHttpError(
  mockFetch: MockedFetch,
  status: number,
  statusText = "Error",
  body?: unknown,
): void {
  mockFetch.mockResolvedValueOnce(
    jsonResponse(body ?? { error: statusText }, status, statusText),
  );
}

/**
 * Assert that fetch was called with expected GraphQL operation.
 * Checks the request body for the operation name.
 */
export function expectGraphQLOperation(
  mockFetch: MockedFetch,
  operationName: string,
  callIndex = 0,
): void {
  expect(mockFetch).toHaveBeenCalled();
  const call = mockFetch.mock.calls[callIndex];
  expect(call).toBeDefined();

  const [, init] = call!;
  expect(init?.method).toBe("POST");
  expect(init?.body).toBeDefined();

  const body = JSON.parse(init!.body as string);
  expect(body.operationName).toBe(operationName);
}

/**
 * Get the variables from a GraphQL request.
 */
export function getGraphQLVariables(
  mockFetch: MockedFetch,
  callIndex = 0,
): Record<string, unknown> | undefined {
  const call = mockFetch.mock.calls[callIndex];
  if (!call) return undefined;

  const [, init] = call;
  if (!init?.body) return undefined;

  const body = JSON.parse(init.body as string);
  return body.variables;
}
