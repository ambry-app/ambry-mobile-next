import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

type ButtonProps = {
  size: number;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  children?: React.ReactNode;
};

export default function Button(props: ButtonProps) {
  const { size, style, onPress, children } = props;

  return (
    <TouchableOpacity onPress={onPress}>
      <View style={[styles.container, { padding: size / 2 }, style]}>
        <View style={[styles.container]}>{children}</View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor: "orange",
  },
});
