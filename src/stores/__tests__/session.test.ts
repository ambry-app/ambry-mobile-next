/**
 * Tests for the session store.
 *
 * Uses Detroit-style testing: we mock only the network boundary (fetch),
 * letting the real API functions and store code run.
 */

import { CreateSessionErrorCode } from "@/graphql/api";
import { signIn, signOut } from "@/services/auth-service";
import { clearSession, useSession } from "@/stores/session";
import {
  graphqlError,
  graphqlSuccess,
  installFetchMock,
  mockGraphQL,
  mockNetworkError,
} from "@test/fetch-mock";
import { clearSecureStore } from "@test/jest-setup";

// Initial state for resetting between tests
const initialSessionState = { session: null };

describe("session store", () => {
  let mockFetch: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    // Reset store state
    useSession.setState(initialSessionState);
    // Clear SecureStore
    clearSecureStore();
    // Install fresh fetch mock
    mockFetch = installFetchMock();
  });

  // ===========================================================================
  // Initial state
  // ===========================================================================

  describe("initial state", () => {
    it("starts with null session", () => {
      const state = useSession.getState();
      expect(state.session).toBeNull();
    });
  });

  // ===========================================================================
  // signIn
  // ===========================================================================

  describe("signIn", () => {
    const testUrl = "https://example.com";
    const testEmail = "test@example.com";
    const testPassword = "password123";
    const testToken = "auth-token-123";

    it("sets session on successful sign in", async () => {
      // Mock successful GraphQL response
      mockGraphQL(
        mockFetch,
        graphqlSuccess({ createSession: { token: testToken } }),
      );

      const result = await signIn(testUrl, testEmail, testPassword);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${testUrl}/gql`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("CreateSession"),
        }),
      );

      const state = useSession.getState();
      expect(state.session).toEqual({
        token: testToken,
        email: testEmail,
        url: testUrl,
      });
    });

    it("returns error on invalid credentials", async () => {
      // Mock GraphQL error response for invalid credentials
      mockGraphQL(mockFetch, graphqlError("invalid username or password"));

      const result = await signIn(testUrl, testEmail, testPassword);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(
          CreateSessionErrorCode.INVALID_CREDENTIALS,
        );
      }

      // Session should remain null
      const state = useSession.getState();
      expect(state.session).toBeNull();
    });

    it("returns error on network failure", async () => {
      // Mock network error
      mockNetworkError(mockFetch, "Network request failed");

      const result = await signIn(testUrl, testEmail, testPassword);

      expect(result.success).toBe(false);

      // Session should remain null
      const state = useSession.getState();
      expect(state.session).toBeNull();
    });
  });

  // ===========================================================================
  // signOut
  // ===========================================================================

  describe("signOut", () => {
    const testSession = {
      token: "auth-token-123",
      email: "test@example.com",
      url: "https://example.com",
    };

    it("clears session and calls deleteSession API", async () => {
      // Set up initial session
      useSession.setState({ session: testSession });

      // Mock successful deleteSession response
      mockGraphQL(
        mockFetch,
        graphqlSuccess({ deleteSession: { deleted: true } }),
      );

      await signOut();

      expect(mockFetch).toHaveBeenCalledWith(
        `${testSession.url}/gql`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${testSession.token}`,
          }),
        }),
      );

      const state = useSession.getState();
      expect(state.session).toBeNull();
    });

    it("does nothing when no session exists", async () => {
      // Session is already null from beforeEach

      await signOut();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // clearSession
  // ===========================================================================

  describe("clearSession", () => {
    const testSession = {
      token: "auth-token-123",
      email: "test@example.com",
      url: "https://example.com",
    };

    it("clears session without calling API", () => {
      // Set up initial session
      useSession.setState({ session: testSession });

      clearSession();

      // Should NOT call the API
      expect(mockFetch).not.toHaveBeenCalled();

      // Session should be cleared
      const state = useSession.getState();
      expect(state.session).toBeNull();
    });

    it("works when session is already null", () => {
      // Session is already null from beforeEach

      // Should not throw
      expect(() => clearSession()).not.toThrow();

      const state = useSession.getState();
      expect(state.session).toBeNull();
    });
  });
});
