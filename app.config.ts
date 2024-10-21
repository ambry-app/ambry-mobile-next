const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return "app.ambry.mobile.dev";
  }

  if (IS_PREVIEW) {
    return "app.ambry.mobile.preview";
  }

  return "app.ambry.mobile";
};

const getAppName = () => {
  if (IS_DEV) {
    return "Ambry (Dev)";
  }

  if (IS_PREVIEW) {
    return "Ambry (Preview)";
  }

  return "Ambry";
};

export default {
  expo: {
    name: getAppName(),
    slug: "ambry-mobile",
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
      bundleIdentifier: getUniqueIdentifier(),
      infoPlist: {
        UIBackgroundModes: ["audio"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: IS_DEV ? "#f59e0b" : "#84cc16",
      },
      package: getUniqueIdentifier(),
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 24,
            usesCleartextTraffic: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    owner: "ambry-app",
    extra: {
      eas: {
        projectId: "47185dc5-b1cf-48be-8e0d-9bec4dfac948",
      },
    },
  },
};
