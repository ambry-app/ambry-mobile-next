import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { File } from "expo-file-system";

import { FadeInOnMount } from "@/components";
import { Colors } from "@/styles";
import { documentDirectoryFilePath } from "@/utils";

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

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [
    "Bytes",
    "KiB",
    "MiB",
    "GiB",
    "TiB",
    "PiB",
    "EiB",
    "ZiB",
    "YiB",
  ];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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
