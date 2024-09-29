import { ReactNode } from "react";
import { View } from "react-native";

export default function ScreenCentered({ children }: { children: ReactNode }) {
  return (
    <View className="flex h-full items-center justify-center">{children}</View>
  );
}
