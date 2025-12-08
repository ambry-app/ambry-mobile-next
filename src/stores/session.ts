import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";

import {
  createSession,
  CreateSessionError,
  deleteSession,
} from "@/graphql/api";
import { Result } from "@/types/result";

const AUTH_STORAGE_KEY = "Ambry_userSessionV2";

export interface Session {
  token: string;
  email: string;
  url: string;
}

interface SessionState {
  session: Session | null;
}

// Custom storage interface for Expo SecureStore
const secureStorage: StateStorage = {
  getItem: (name: string): string | null => {
    return SecureStore.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    SecureStore.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

const storage = createJSONStorage(() => secureStorage);

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      isLoading: false,
      error: null,
      session: null,
    }),
    {
      storage,
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        session: state.session,
      }),
    },
  ),
);

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

export async function signOut() {
  const session = useSession.getState().session;

  if (session) {
    await deleteSession(session.url, session.token);
    useSession.setState({ session: null });
  }
}

// forces sign out without calling the API, this should be used when we've
// gotten an unauthorized error back from the server with the current token,
// meaning we've been signed out server-side
export function forceSignOut() {
  console.log("[Session] Forcing sign out");
  useSession.setState({ session: null });
}
