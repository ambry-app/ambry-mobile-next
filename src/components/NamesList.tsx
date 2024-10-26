import { StyleProp, Text, TextStyle } from "react-native";

type NamesListProps = {
  names: string[];
  /** @deprecated */
  className?: string;
  numberOfLines?: number;
  prefix?: string;
  style?: StyleProp<TextStyle>;
};

export default function NamesList(props: NamesListProps) {
  const { names, className, numberOfLines, prefix, style } = props;

  return (
    <Text className={className} style={style} numberOfLines={numberOfLines}>
      {prefix && prefix + " "}
      {names.map((name, i) => [i > 0 && ", ", <Text key={i}>{name}</Text>])}
    </Text>
  );
}
