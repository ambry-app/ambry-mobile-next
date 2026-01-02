import { defaultSleepTimer, defaultSleepTimerEnabled } from "@/db/schema";
import { setTriggerTime, useSleepTimer } from "@/stores/sleep-timer";
import { resetStoreBeforeEach } from "@test/store-test-utils";

describe("sleep-timer store", () => {
  resetStoreBeforeEach(useSleepTimer, {
    initialized: false,
    sleepTimer: defaultSleepTimer,
    sleepTimerEnabled: defaultSleepTimerEnabled,
    sleepTimerTriggerTime: null,
  });

  describe("setTriggerTime", () => {
    it("sets trigger time in store", () => {
      const triggerTime = Date.now() + 60000;

      setTriggerTime(triggerTime);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBe(triggerTime);
    });

    it("clears trigger time when set to null", () => {
      // Set a trigger time first
      useSleepTimer.setState({ sleepTimerTriggerTime: Date.now() + 60000 });

      setTriggerTime(null);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });
  });
});
