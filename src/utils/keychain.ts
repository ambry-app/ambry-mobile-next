/**
 * iOS refuses keychain reads while the device is locked, which a background
 * launch can hit. expo-secure-store reports it only as message text.
 */
export function isKeychainLocked(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("User interaction is not allowed")
  );
}
