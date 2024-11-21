import { RefObject, useState } from "react";
import { StyleProp, TextInput, TextInputProps, TextStyle } from "react-native";

type FocusableTextInputProps = TextInputProps & {
  inputRef?: RefObject<TextInput>;
  focusedStyle?: StyleProp<TextStyle>;
};

export default function FocusableTextInput(props: FocusableTextInputProps) {
  const { focusedStyle, style, inputRef, ...rest } = props;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      ref={inputRef}
      style={[style, isFocused && focusedStyle]}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      {...rest}
    />
  );
}
