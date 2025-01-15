export type Result<T, E> =
  | { success: true; result: T }
  | { success: false; error: E };
