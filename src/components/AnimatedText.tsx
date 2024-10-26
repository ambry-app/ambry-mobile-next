// yanked from react-native-redash:
// https://github.com/wcandillon/react-native-redash/blob/fd0b0ddb3b4c10ae88cf1f8a95890c7c5eb3c475/src/ReText.tsx

import React from "react";
import type { TextProps as RNTextProps, TextInputProps } from "react-native";
import { StyleSheet, TextInput } from "react-native";
import Animated, {
  AnimatedProps,
  SharedValue,
  useAnimatedProps,
} from "react-native-reanimated";

const styles = StyleSheet.create({
  baseStyle: {
    color: "black",
  },
});
Animated.addWhitelistedNativeProps({ text: true });

interface TextProps extends Omit<TextInputProps, "value" | "style"> {
  text: SharedValue<string>;
  style?: AnimatedProps<RNTextProps>["style"];
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const AnimatedText = (props: TextProps) => {
  const { style, text, ...rest } = props;
  const animatedProps = useAnimatedProps(() => {
    return {
      text: text.value,
      // Here we use any because the text prop is not available in the type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });
  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      value={text.value}
      style={[styles.baseStyle, style || undefined]}
      {...rest}
      {...{ animatedProps }}
    />
  );
};

export default AnimatedText;
