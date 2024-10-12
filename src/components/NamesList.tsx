import { Text } from "react-native";

export default function NamesList({
  names,
  className,
  numberOfLines,
  prefix,
}: {
  names: string[];
  className?: string;
  numberOfLines?: number;
  prefix?: string;
}) {
  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {prefix && prefix + " "}
      {names.map((name, i) => [i > 0 && ", ", <Text key={i}>{name}</Text>])}
    </Text>
  );
}
