/**
 * Authentication Service
 *
 * Handles sign in/out operations by coordinating between the GraphQL API and
 * the session store.
 */

import {
  createSession,
  CreateSessionError,
  deleteSession,
} from "@/graphql/api";
import { reset as resetDataVersion } from "@/stores/data-version";
import { reset as resetDownloads } from "@/stores/downloads";
import { useSession } from "@/stores/session";
import { Result } from "@/types/result";

/**
 * Sign in to the server and store the session.
 */
export async function signIn(
  url: string,
  email: string,
  password: string,
): Promise<Result<true, CreateSessionError>> {
  const result = await createSession(url, email, password);

  if (!result.success) {
    return result;
  }

  const {
    result: { token },
  } = result;

  useSession.setState({
    session: { token, email, url },
  });

  return { success: true, result: true };
}

/**
 * Sign out from the server and clear the session.
 */
export async function signOut() {
  const session = useSession.getState().session;

  if (session) {
    await deleteSession(session.url, session.token);
    useSession.setState({ session: null });

    // The JS context can outlive a sign-out (the player's foreground service
    // keeps it alive), so session-scoped stores must not stay initialized —
    // otherwise the next sign-in skips re-initialization and the initial sync.
    resetDataVersion();
    resetDownloads();
  }
}
