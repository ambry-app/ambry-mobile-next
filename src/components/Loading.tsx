import { ActivityIndicator, ActivityIndicatorProps } from "react-native";

import { Colors } from "@/styles/colors";

type LoadingProps = ActivityIndicatorProps & {
  color?: string;
  size?: number | "small" | "large";
};

export function Loading(props: LoadingProps) {
  const { color = Colors.zinc[100], size = "large" } = props;

  return (
    <ActivityIndicator animating={true} size={size} color={color} {...props} />
  );
}
