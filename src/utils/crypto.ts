/**
 * Crypto utilities - wrapper around expo-crypto for UUID generation.
 * In tests, this module is mocked to use Node's crypto.randomUUID().
 */
import * as Crypto from "expo-crypto";

export function randomUUID(): string {
  return Crypto.randomUUID();
}
