const IS_DEV = process.env.APP_VARIANT === "dev";

export default {
  expo: {
    name: IS_DEV ? "Ambry (Dev)" : "Ambry",
    slug: "ambry",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "ambry",
    userInterfaceStyle: "dark",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#27272A",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? "com.ambry.dev" : "com.ambry",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: IS_DEV ? "#f59e0b" : "#84cc16",
      },
      package: IS_DEV ? "com.ambry.dev" : "com.ambry",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: ["expo-router", "expo-secure-store"],
    experiments: {
      typedRoutes: true,
    },
  },
};
