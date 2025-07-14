import { ReactNode, useEffect } from "react";
import { StyleProp, ViewProps } from "react-native";
import Animated, { useSharedValue, withTiming } from "react-native-reanimated";

type Props = ViewProps & {
  style?: StyleProp<ViewProps>;
  children?: ReactNode;
  duration?: number;
};

export function FadeInOnMount(props: Props) {
  const { children, style, duration = 250, ...rest } = props;
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration });
  }, [opacity, duration]);

  return (
    <Animated.View style={[style, { opacity }]} {...rest}>
      {children}
    </Animated.View>
  );
}
