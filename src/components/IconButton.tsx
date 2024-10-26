import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Pressable, StyleSheet, View } from "react-native";

type IconButtonProps = {
  size: number;
  icon: string;
  color: string;
  onPress: () => void;
  padding?: number;
  children?: React.ReactNode;
};

export default function IconButton(props: IconButtonProps) {
  const { size, icon, color, onPress, padding = size / 2, children } = props;

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.container,
          { height: size + padding * 2, width: size + padding * 2 },
        ]}
      >
        <FontAwesome6 size={size} name={icon} color={color} />
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});
