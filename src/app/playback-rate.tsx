import { Button, IconButton } from "@/src/components";
import { setPlaybackRate, usePlayer } from "@/src/stores/player";
import { useSession } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { formatPlaybackRate, secondsDisplay } from "@/src/utils";
import Slider from "@react-native-community/slider";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";

export default function PlaybackRateModal() {
  const { bottom } = useSafeAreaInsets();

  const session = useSession((state) => state.session);

  const { position, duration, playbackRate } = usePlayer(
    useShallow(({ position, duration, playbackRate }) => ({
      position,
      duration,
      playbackRate,
    })),
  );
  const [displayPlaybackRate, setDisplayPlaybackRate] = useState(1.0);

  useEffect(() => {
    setDisplayPlaybackRate(playbackRate);
  }, [playbackRate]);

  const setPlaybackRateAndDisplay = useCallback(
    (value: number) => {
      if (!session) return;
      setDisplayPlaybackRate(value);
      setPlaybackRate(session, value);
    },
    [session],
  );

  if (!session) return null;

  return (
    <View style={{ paddingBottom: Platform.OS === "android" ? bottom : 0 }}>
      {Platform.OS === "android" && <View style={styles.handle} />}
      <View style={styles.container}>
        <Text style={styles.title}>
          Playback Speed: {formatPlaybackRate(displayPlaybackRate)}×
        </Text>

        <View style={styles.sliderRowContainer}>
          <IconButton
            icon="minus"
            color={Colors.zinc[100]}
            size={16}
            onPress={() => {
              const newPlaybackRate = Math.max(0.5, playbackRate - 0.05);
              setPlaybackRateAndDisplay(parseFloat(newPlaybackRate.toFixed(2)));
            }}
            style={styles.plusMinusButton}
          />
          <View style={styles.sliderContainer}>
            <Slider
              value={playbackRate}
              minimumValue={0.5}
              maximumValue={3.0}
              step={0.05}
              thumbTintColor={Colors.lime[400]}
              minimumTrackTintColor={Colors.zinc[400]}
              maximumTrackTintColor={Colors.zinc[400]}
              onValueChange={(value) => {
                setDisplayPlaybackRate(parseFloat(value.toFixed(2)));
              }}
              onSlidingComplete={(value) => {
                setPlaybackRateAndDisplay(parseFloat(value.toFixed(2)));
              }}
            />
          </View>
          <IconButton
            icon="plus"
            color={Colors.zinc[100]}
            size={16}
            onPress={() => {
              const newPlaybackRate = Math.min(3.0, playbackRate + 0.05);
              setPlaybackRateAndDisplay(parseFloat(newPlaybackRate.toFixed(2)));
            }}
            style={styles.plusMinusButton}
          />
        </View>

        <View style={styles.rateButtonRow}>
          <PlaybackRateButton
            rate={1.0}
            active={displayPlaybackRate === 1.0}
            setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
          />
          <PlaybackRateButton
            rate={1.25}
            active={displayPlaybackRate === 1.25}
            setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
          />
          <PlaybackRateButton
            rate={1.5}
            active={displayPlaybackRate === 1.5}
            setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
          />
          <PlaybackRateButton
            rate={1.75}
            active={displayPlaybackRate === 1.75}
            setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
          />
          <PlaybackRateButton
            rate={2.0}
            active={displayPlaybackRate === 2.0}
            setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
          />
        </View>

        <Text style={styles.timeLeftText}>
          Finish in{" "}
          {secondsDisplay(
            Math.max(duration - position, 0) / displayPlaybackRate,
          )}
        </Text>
      </View>
    </View>
  );
}

type PlaybackRateButtonProps = {
  rate: number;
  active: boolean;
  setPlaybackRateAndDisplay: (value: number) => void;
};

function PlaybackRateButton(props: PlaybackRateButtonProps) {
  const { rate, active, setPlaybackRateAndDisplay } = props;

  return (
    <Button
      size={16}
      style={[styles.rateButton, active && styles.rateButtonActive]}
      onPress={() => setPlaybackRateAndDisplay(rate)}
    >
      <Text style={[styles.text, active && styles.rateButtonTextActive]}>
        {formatPlaybackRate(rate)}×
      </Text>
    </Button>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.zinc[500],
    borderRadius: 999,
    marginHorizontal: "auto",
    marginTop: 8,
  },
  container: {
    padding: 32,
    display: "flex",
    justifyContent: "center",
    gap: 24,
  },
  title: {
    color: Colors.zinc[100],
    fontSize: 18,
    textAlign: "center",
  },
  rateButtonRow: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
  },
  rateButton: {
    backgroundColor: Colors.zinc[800],
    borderRadius: 999,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  rateButtonActive: {
    backgroundColor: Colors.zinc[100],
  },
  rateButtonTextActive: {
    color: Colors.black,
  },
  text: {
    color: Colors.zinc[100],
    fontSize: 12,
  },
  timeLeftText: {
    color: Colors.zinc[400],
    textAlign: "center",
  },
  sliderRowContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  sliderContainer: {
    flexGrow: 1,
  },
  plusMinusButton: {
    backgroundColor: Colors.zinc[800],
    borderRadius: 999,
  },
});
