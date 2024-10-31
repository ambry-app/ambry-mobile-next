import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

type IconButtonProps = {
  size: number;
  icon: string;
  color: string;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  children?: React.ReactNode;
};

export default function IconButton(props: IconButtonProps) {
  const { size, icon, color, style, onPress, children } = props;

  return (
    <TouchableOpacity onPress={onPress}>
      <View style={[styles.container, { padding: size / 2 }, style]}>
        {/* NOTE: for some reason the some icons get cut off when height and
        width is exactly equal to the icon size */}
        <View style={[styles.container, { width: size + 1, height: size + 1 }]}>
          <FontAwesome6 size={size} name={icon} color={color} />
        </View>
        {children}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor: "purple",
  },
});
