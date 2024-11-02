import { graphql } from "@/src/graphql/client";
import { execute, executeAuthenticated } from "@/src/graphql/client/execute";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { StateStorage, createJSONStorage, persist } from "zustand/middleware";
import { usePlayer } from "./player";

const AUTH_STORAGE_KEY = "Ambry_userSessionV2";

export interface Session {
  token: string;
  email: string;
  url: string;
}

interface SessionState {
  isLoading: boolean;
  error: string | null;
  session: Session | null;
  signIn: (url: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
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
      signIn: async (url: string, email: string, password: string) => {
        set({ isLoading: true, error: null });
        const result = await signInAsync(url, email, password);
        if (result.success) {
          set({
            isLoading: false,
            session: { token: result.token, email, url },
          });
        } else {
          set({ isLoading: false, error: result.error });
        }
      },
      signOut: async () => {
        set({ isLoading: true, error: null });
        await usePlayer.getState().unloadPlayer();
        const session = get().session;
        if (session) {
          await signOutAsync(session.url, session.token);
          set({ isLoading: false, session: null });
        } else {
          set({ isLoading: false });
        }
      },
      clearError: () => {
        set({ error: null });
      },
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

interface SignInSuccess {
  success: true;
  token: string;
}

interface SignInFailure {
  success: false;
  error: string;
}

type SignInResult = SignInSuccess | SignInFailure;

const signInMutation = graphql(`
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) {
      token
    }
  }
`);

const signInAsync = async (
  url: string,
  email: string,
  password: string,
): Promise<SignInResult> => {
  try {
    const response = await execute(url, signInMutation, {
      input: {
        email: email,
        password: password,
      },
    });

    if (!response.createSession) {
      return { success: false, error: "Invalid email address or password" };
    }
    return { success: true, token: response.createSession.token };
  } catch (error) {
    console.error("Sign in network request failed:", error);
    return { success: false, error: "Failed to connect to server" };
  }
};

const signOutMutation = graphql(`
  mutation DeleteSession {
    deleteSession {
      deleted
    }
  }
`);

const signOutAsync = async (url: string, token: string): Promise<boolean> => {
  try {
    const response = await executeAuthenticated(url, token, signOutMutation);

    if (!response.deleteSession) {
      return false;
    }
    return response.deleteSession.deleted;
  } catch (error) {
    console.error("Sign out network request failed:", error);
    return false;
  }
};
