import { StyleSheet, Text } from "react-native";
import { File } from "expo-file-system";

import { FadeInOnMount } from "@/components/FadeInOnMount";
import { Colors } from "@/styles/colors";
import { formatBytes } from "@/utils/format";
import { documentDirectoryFilePath } from "@/utils/paths";

type FileSizeProps = {
  /**
   * Every file the recording was downloaded as. A direct-play recording can be
   * several; their sizes are summed, because what the reader wants to know is
   * how much space the book takes.
   */
  filePaths: string[];
};

export function FileSize({ filePaths }: FileSizeProps) {
  // Not memoized by hand: the React Compiler does it, and keying off an array
  // prop is exactly the case it cannot preserve.
  const { size, isMissing } = totalSize(filePaths);

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

function totalSize(filePaths: string[]) {
  if (filePaths.length === 0) return { size: null, isMissing: true };

  let total = 0;
  for (const filePath of filePaths) {
    const file = new File(documentDirectoryFilePath(filePath));
    // One missing file means the download cannot be played through, so it is
    // reported as missing rather than quietly undercounting.
    if (!file.exists) return { size: null, isMissing: true };
    total += file.size;
  }

  return { size: formatBytes(total), isMissing: false };
}
