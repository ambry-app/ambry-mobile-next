import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_BASE_HEIGHT } from "@/constants";
import { Colors } from "@/styles";

import { TabBarTabs } from "./tab-bar";

export function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;

  return (
    <TabBarTabs
      height={tabBarHeight}
      paddingBottom={insets.bottom}
      borderTopColor={Colors.zinc[600]}
    />
  );
}
