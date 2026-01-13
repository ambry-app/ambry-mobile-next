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
    backgroundColor: "#000000",
    primaryColor: "#84cc16",
    ios: {
      supportsTablet: false,
      bundleIdentifier: getUniqueIdentifier(),
      infoPlist: {
        UIBackgroundModes: ["audio"],
        ITSAppUsesNonExemptEncryption: false,
        NSMotionUsageDescription:
          "Ambry uses motion data to detect when you're stationary so the sleep timer only counts down when you've stopped moving.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: IS_DEV ? "#f59e0b" : "#84cc16",
      },
      package: getUniqueIdentifier(),
    },
    plugins: [
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          project: "ambry-mobile",
          organization: "ambry-app",
        },
      ],
      "expo-router",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#18181b",
        },
      ],
      "react-native-edge-to-edge",
      "expo-build-properties",
      "expo-sqlite",
      "expo-background-task",
      "expo-font",
    ],
    experiments: {
      typedRoutes: true,
      turboModules: true,
    },
    owner: "ambry-app",
    extra: {
      eas: {
        projectId: "47185dc5-b1cf-48be-8e0d-9bec4dfac948",
      },
    },
  },
};
