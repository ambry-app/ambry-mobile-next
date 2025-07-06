import { ReactNode } from "react";
import { StyleProp, ViewProps } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

type Props = ViewProps & {
  style?: StyleProp<ViewProps>;
  children?: ReactNode;
  duration?: number;
};

export function FadeInOnMount(props: Props) {
  const { children, style, duration = 250, ...rest } = props;

  return (
    <Animated.View style={style} entering={FadeIn.duration(duration)} {...rest}>
      {children}
    </Animated.View>
  );
}
