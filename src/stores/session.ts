import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";

import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";

const log = logBase.extend("session");

const AUTH_STORAGE_KEY = "Ambry_userSessionV2";

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
    (): SessionState => ({
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

/**
 * Forces sign out without calling the API.
 * Use this when we've gotten an unauthorized error back from the server
 * with the current token, meaning we've been signed out server-side.
 */
export function clearSession() {
  log.info("Clearing session");
  useSession.setState({ session: null });
}
