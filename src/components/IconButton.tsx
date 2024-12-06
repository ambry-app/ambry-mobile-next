import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import Loading from "./Loading";

type IconButtonProps = {
  size: number;
  icon: string;
  color: string;
  style?: StyleProp<ViewStyle>;
  iconStyle?: StyleProp<ViewStyle>;
  onPress: () => void;
  onLongPress?: () => void;
  children?: React.ReactNode;
  solid?: boolean;
};

export default function IconButton(props: IconButtonProps) {
  const {
    size,
    icon,
    color,
    style,
    onPress,
    onLongPress,
    children,
    iconStyle,
    solid = false,
  } = props;

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress}>
      <View style={[styles.container, { padding: size / 2 }, style]}>
        {/* NOTE: for some reason the some icons get cut off when height and
        width is exactly equal to the icon size */}
        <View
          style={[
            styles.container,
            { width: size + 1, height: size + 1 },
            iconStyle,
          ]}
        >
          <Icon size={size} name={icon} color={color} solid={solid} />
        </View>
        {children}
      </View>
    </TouchableOpacity>
  );
}

type IconProps = {
  size: number;
  name: string;
  color: string;
  solid: boolean;
};

function Icon({ size, name, color, solid }: IconProps) {
  if (name === "loading") {
    return <Loading size={size} color={color} />;
  }

  return <FontAwesome6 size={size} name={name} color={color} solid={solid} />;
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});
