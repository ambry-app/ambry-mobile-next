/**
 * Assert that a value is not undefined, throwing an error if it is.
 * Useful for extracting required values from optional contexts.
 *
 * @throws Error with the provided message if value is undefined
 *
 * @example
 * const user = requireValue(maybeUser, "User is required");
 * // user is now guaranteed to be defined
 */
export function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}
