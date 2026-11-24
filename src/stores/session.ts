import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";

import { Session } from "@/types/session";
import { isKeychainLocked } from "@/utils/keychain";
import { logBase } from "@/utils/logger";

const log = logBase.extend("session");

const AUTH_STORAGE_KEY = "Ambry_userSessionV2";

interface SessionState {
  session: Session | null;
}

export const initialSessionState: SessionState = {
  session: null,
};

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

let keychainError: unknown = null;

export const useSession = create<SessionState>()(
  persist(
    (): SessionState => ({
      session: null,
    }),
    {
      storage,
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        session: state.session,
      }),
      onRehydrateStorage: () => (_state, error) => {
        keychainError = isKeychainLocked(error) ? error : null;
      },
    },
  ),
);

/**
 * Forces sign out without calling the API.
 * Use this when we've gotten an unauthorized error back from the server
 * with the current token, meaning we've been signed out server-side.
 */
export function clearSession() {
  log.info("Clearing session");
  useSession.setState({ session: null });
}

/**
 * Why the stored session could not be read, if the keychain was locked. A null
 * session does not mean signed out while this is set.
 */
export function sessionKeychainError() {
  return keychainError;
}

/** Storage is synchronous, so the session is loaded when this returns. */
export function reloadSession() {
  useSession.persist.rehydrate();
}

/**
 * Reset store to initial state for testing.
 */
export function resetForTesting() {
  keychainError = null;
  useSession.setState(initialSessionState, true);
}
