import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";

import { Colors, surface } from "@/styles/colors";

import { TabConfig, TABS, useActiveTab } from "./useActiveTab";

type TabBarTabsProps = {
  height: number;
  paddingBottom: number;
  borderTopColor?: string;
};

export function TabBarTabs({
  height,
  paddingBottom,
  borderTopColor = Colors.zinc[600],
}: TabBarTabsProps) {
  const activeTab = useActiveTab();

  const handleTabPress = (tab: TabConfig) => {
    router.navigate(tab.href);
  };

  return (
    <View style={[styles.container, { height, paddingBottom, borderTopColor }]}>
      {TABS.map((tab) => {
        const isActive = activeTab?.name === tab.name;
        const color = isActive ? Colors.lime[400] : Colors.zinc[400];

        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => handleTabPress(tab)}
          >
            <FontAwesome6 size={24} name={tab.icon} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: surface.elevated,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    paddingBottom: 4,
  },
});
