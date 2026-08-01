/**
 * Tests for the auth service.
 *
 * Uses Detroit-style testing: we mock only:
 * - Native modules (expo-secure-store, expo-file-system, etc.)
 * - Network boundary (fetch)
 *
 * The real auth service, GraphQL API, and stores run.
 */

import { signOut } from "@/services/auth-service";
import { useDataVersion } from "@/stores/data-version";
import { useDownloads } from "@/stores/downloads";
import {
  resetForTesting as resetSessionStore,
  useSession,
} from "@/stores/session";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import {
  graphqlSuccess,
  installFetchMock,
  mockGraphQL,
} from "@test/fetch-mock";

setupTestDatabase();

describe("signOut", () => {
  let mockFetch: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    mockFetch = installFetchMock();
    resetSessionStore();
    useSession.setState({ session: DEFAULT_TEST_SESSION });
  });

  it("clears the session and resets session-scoped stores", async () => {
    mockGraphQL(
      mockFetch,
      graphqlSuccess({ deleteSession: { deleted: true } }),
    );

    // Simulate a previous session having initialized these stores; the JS
    // context can outlive a sign-out, so they must be reset explicitly
    useDataVersion.setState({
      initialized: true,
      libraryDataVersion: Date.parse("2024-01-15T10:00:00.000Z"),
    });
    useDownloads.setState({ initialized: true });

    await signOut();

    expect(useSession.getState().session).toBeNull();
    expect(useDataVersion.getState().initialized).toBe(false);
    expect(useDataVersion.getState().libraryDataVersion).toBeNull();
    expect(useDownloads.getState().initialized).toBe(false);
    expect(useDownloads.getState().downloads).toEqual({});
  });
});
