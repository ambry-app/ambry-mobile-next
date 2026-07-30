import type { ComponentProps } from "react";
import type { Stack } from "expo-router";

export type RouterParams = {
  id: string;
  title: string;
};

/**
 * Options accepted by expo-router's `<Stack>` and `<Stack.Screen>`.
 *
 * expo-router vendors its own fork of native-stack, so these are NOT the same
 * types exported by `@react-navigation/native-stack` — deriving them from the
 * components keeps them correct across SDK upgrades.
 */
export type StackScreenOptions = NonNullable<
  ComponentProps<typeof Stack>["screenOptions"]
>;

export type StackScreenOptionsProp = NonNullable<
  ComponentProps<typeof Stack.Screen>["options"]
>;
