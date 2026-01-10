import {
  resetForTesting,
  setTriggerTime,
  useSleepTimer,
} from "@/stores/sleep-timer";

describe("sleep-timer store", () => {
  beforeEach(() => {
    resetForTesting();
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
