import { Colors } from "@/src/styles";
import { ActivityIndicator, StyleProp, ViewStyle } from "react-native";

type LoadingProps = {
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: number | "small" | "large";
};

export function Loading(props: LoadingProps) {
  const { style, color = Colors.zinc[100], size = "large" } = props;

  return (
    <ActivityIndicator
      style={style}
      animating={true}
      size={size}
      color={color}
    />
  );
}
