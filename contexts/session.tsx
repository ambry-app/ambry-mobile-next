import { createContext, useContext, type PropsWithChildren } from "react";
import { useStorageState } from "../hooks/useStorageState";

type Session = {
  token: string;
  email: string;
  url: string;
};

const AuthContext = createContext<{
  signIn: (url: string, email: string, password: string) => Promise<boolean>;
  signOut: (url: string, token: string) => Promise<boolean>;
  session?: Session | null;
  isLoading: boolean;
}>({
  signIn: async (_url, _email, _password) => {
    return false;
  },
  signOut: async (_url, _token) => {
    return false;
  },
  session: null,
  isLoading: false,
});

const signInAsync = async (url: string, email: string, password: string) => {
  console.log("Signing in...", url, email, password);
  try {
    console.log("Trying...");
    const response = await fetch(url, {
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
    console.log("Response:", response);
    const json = await response.json();
    console.log(json.data.createSession.token);
    return json.data.createSession.token;
  } catch (error) {
    console.error("Error signing in:", error);
    return false;
  }
};

const signOutAsync = async (url: string, token: string) => {
  console.log("Signing out...", url);
  try {
    console.log("Trying...");
    const response = await fetch(url, {
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
    console.log("Response:", response);
    const json = await response.json();
    console.log(json.data.deleteSession.deleted);
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
  const [[isLoading, session], setSession] = useStorageState("session");
  console.log(session);

  const sessionObject = session ? JSON.parse(session) : null;
  console.log(sessionObject);

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
        signOut: async (url, token) => {
          const response = await signOutAsync(url, token);
          setSession(null);
          return response;
        },
        session: sessionObject,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
