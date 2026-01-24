import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { File } from "expo-file-system";

import { FadeInOnMount } from "@/components/FadeInOnMount";
import { Colors } from "@/styles/colors";
import { formatBytes } from "@/utils/format";
import { documentDirectoryFilePath } from "@/utils/paths";

type FileSizeProps = {
  filePath: string;
};

export function FileSize({ filePath }: FileSizeProps) {
  const { size, isMissing } = useMemo(() => {
    const file = new File(documentDirectoryFilePath(filePath));
    if (!file.exists) {
      return { size: null, isMissing: true };
    }
    return { size: formatBytes(file.size), isMissing: false };
  }, [filePath]);

  if (isMissing) return <Text style={styles.errorText}>file is missing!</Text>;

  if (!size) return <Text style={styles.text}></Text>;

  return (
    <FadeInOnMount>
      <Text style={styles.text} numberOfLines={1}>
        {size}
      </Text>
    </FadeInOnMount>
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[400],
    fontSize: 10,
  },
  errorText: {
    color: Colors.red[500],
    fontSize: 10,
  },
});
