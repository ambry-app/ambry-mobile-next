import { ReactNode, useEffect } from "react";
import Animated, { useSharedValue, withTiming } from "react-native-reanimated";
import { StyleProp, ViewProps } from "react-native";

type Props = ViewProps & {
  style?: StyleProp<ViewProps>;
  children?: ReactNode;
};

export default function FadeInOnMount({ children, style, ...props }: Props) {
  const opacity = useSharedValue(0.0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
  }, [opacity]);

  return (
    <Animated.View style={[style, { opacity }]} {...props}>
      {children}
    </Animated.View>
  );
}
