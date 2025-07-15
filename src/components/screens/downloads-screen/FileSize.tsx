import { Colors } from "@/src/styles";
import { documentDirectoryFilePath } from "@/src/utils";
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { FadeInOnMount } from "../../FadeInOnMount";

type FileSizeProps = {
  filePath: string;
};

export function FileSize({ filePath }: FileSizeProps) {
  const [size, setSize] = useState<string | null>(null);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    (async function () {
      const info = await FileSystem.getInfoAsync(
        documentDirectoryFilePath(filePath),
      );
      if (!info.exists) {
        setIsMissing(true);
      }
      if (info.exists && !info.isDirectory) {
        setSize(formatBytes(info.size));
      }
    })();
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
