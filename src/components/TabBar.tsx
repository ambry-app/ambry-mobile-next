import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";

export default function TabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation, insets } = props;
  const tabBarHeight = 50 + insets.bottom;

  return (
    <BottomTabBar
      style={{ height: tabBarHeight }}
      {...{ state, descriptors, navigation, insets }}
    />
  );
}
