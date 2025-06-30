import { tabBarBaseHeight } from "@/src/constants";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";

export function TabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation, insets } = props;
  const tabBarHeight = tabBarBaseHeight + insets.bottom;

  return (
    <BottomTabBar
      style={{ height: tabBarHeight }}
      {...{ state, descriptors, navigation, insets }}
    />
  );
}
