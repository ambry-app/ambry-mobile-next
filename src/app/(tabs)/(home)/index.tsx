import { useLayoutEffect } from "react";
import { router } from "expo-router";

/**
 * Index route for (home) tabs group.
 *
 * Redirects to the shelf tab on app launch. Using router.replace() instead of
 * <Redirect> ensures proper navigation history so back button works correctly.
 */
export default function HomeIndex() {
  useLayoutEffect(() => {
    router.replace("/(tabs)/(home)/(shelf)");
  }, []);

  return null;
}
