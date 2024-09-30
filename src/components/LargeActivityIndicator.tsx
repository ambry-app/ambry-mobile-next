import { ActivityIndicator } from "react-native";
// import tw from '../lib/tailwind'

import colors from "tailwindcss/colors";

export default function LargeActivityIndicator({
  className,
}: {
  className?: string;
}) {
  return (
    <ActivityIndicator
      className={className}
      animating={true}
      size="large"
      color={colors.zinc[200]}
    />
  );
}
