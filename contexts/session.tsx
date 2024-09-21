import { createContext, useContext, type PropsWithChildren } from "react";
import { useStorageState } from "../hooks/useStorageState";

type Session = {
  token: string | null;
  email: string;
  url: string;
};

const AuthContext = createContext<{
  signIn: (url: string, email: string, password: string) => Promise<boolean>;
  signOut: (session: Session) => Promise<boolean>;
  session?: Session | null;
  isLoading: boolean;
}>({
  signIn: async (_url, _email, _password) => {
    return false;
  },
  signOut: async (_session) => {
    return false;
  },
  session: null,
  isLoading: false,
});

const signInAsync = async (url: string, email: string, password: string) => {
  try {
    const response = await fetch(`${url}/gql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
            mutation CreateSession($input: CreateSessionInput!) {
              createSession(input: $input) {
                token
              }
            }
          `,
        variables: {
          input: {
            email: email,
            password: password,
          },
        },
      }),
    });
    const json = await response.json();
    if (json.errors) {
      console.error("Error signing in:", json.errors);
      return false;
    }
    return json.data.createSession.token;
  } catch (error) {
    console.error("Error signing in:", error);
    return false;
  }
};

const signOutAsync = async (url: string, token: string) => {
  try {
    const response = await fetch(`${url}/gql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `
            mutation DeleteSession {
              deleteSession {
                deleted
              }
            }
          `,
      }),
    });
    const json = await response.json();
    return json.data.deleteSession.deleted;
  } catch (error) {
    console.error("Error signing in:", error);
    return false;
  }
};

// This hook can be used to access the user info.
export function useSession() {
  const value = useContext(AuthContext);
  if (process.env.NODE_ENV !== "production") {
    if (!value) {
      throw new Error("useSession must be wrapped in a <SessionProvider />");
    }
  }

  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, sessionJSON], setSession] = useStorageState("session");
  const session = sessionJSON ? JSON.parse(sessionJSON) : null;

  return (
    <AuthContext.Provider
      value={{
        signIn: async (url: string, email: string, password: string) => {
          const token = await signInAsync(url, email, password);
          if (token) {
            setSession(JSON.stringify({ token, email, url }));
            return true;
          } else {
            return false;
          }
        },
        signOut: async (session) => {
          const response = await signOutAsync(session.url, session.token!);
          session.token = null;
          setSession(JSON.stringify(session));
          return response;
        },
        session,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
