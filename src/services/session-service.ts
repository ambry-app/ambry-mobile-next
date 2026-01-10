import { useSession } from "@/stores/session";

export function getSession() {
  const session = useSession.getState().session;

  if (!session) {
    throw new Error("No active session found");
  }

  return session;
}
