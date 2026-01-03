/**
 * Tests for the session store.
 */

import { CreateSessionErrorCode } from "@/graphql/api";
import { signIn, signOut } from "@/services/auth-service";
import { clearSession, useSession } from "@/stores/session";
import {
  clearSecureStore,
  mockCreateSession,
  mockDeleteSession,
} from "@test/jest-setup";

// Initial state for resetting between tests
const initialSessionState = { session: null };

describe("session store", () => {
  beforeEach(() => {
    // Reset store state
    useSession.setState(initialSessionState);
    // Clear SecureStore
    clearSecureStore();
    // Reset mocks
    mockCreateSession.mockReset();
    mockDeleteSession.mockReset();
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
      mockCreateSession.mockResolvedValue({
        success: true,
        result: { token: testToken },
      });

      const result = await signIn(testUrl, testEmail, testPassword);

      expect(result.success).toBe(true);
      expect(mockCreateSession).toHaveBeenCalledWith(
        testUrl,
        testEmail,
        testPassword,
      );

      const state = useSession.getState();
      expect(state.session).toEqual({
        token: testToken,
        email: testEmail,
        url: testUrl,
      });
    });

    it("returns error on invalid credentials", async () => {
      mockCreateSession.mockResolvedValue({
        success: false,
        error: { code: CreateSessionErrorCode.INVALID_CREDENTIALS },
      });

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
      mockCreateSession.mockResolvedValue({
        success: false,
        error: { code: "NETWORK_ERROR" },
      });

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
      mockDeleteSession.mockResolvedValue({ success: true });

      await signOut();

      expect(mockDeleteSession).toHaveBeenCalledWith(
        testSession.url,
        testSession.token,
      );

      const state = useSession.getState();
      expect(state.session).toBeNull();
    });

    it("does nothing when no session exists", async () => {
      // Session is already null from beforeEach

      await signOut();

      expect(mockDeleteSession).not.toHaveBeenCalled();
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

      // Should NOT call deleteSession API
      expect(mockDeleteSession).not.toHaveBeenCalled();

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
