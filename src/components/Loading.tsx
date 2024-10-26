import { ActivityIndicator, StyleProp, ViewStyle } from "react-native";
import colors from "tailwindcss/colors";

type LoadingProps = {
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: number | "small" | "large";
};

export default function Loading(props: LoadingProps) {
  const { style, color = colors.zinc[100], size = "large" } = props;

  return (
    <ActivityIndicator
      style={style}
      animating={true}
      size={size}
      color={color}
    />
  );
}