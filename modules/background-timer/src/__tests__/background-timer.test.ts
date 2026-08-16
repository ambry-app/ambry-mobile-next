/**
 * Tests for the background timer's shared dispatch.
 *
 * Under jest the platform is iOS, so these run against the JS backend - which
 * is the point: the callback table, the handles and the cancel semantics are
 * shared with the native backend, and this is where they can be exercised.
 * What Android substitutes is only where the tick comes from.
 */

import { cancel, delay, schedule, scheduleInterval } from "background-timer";

describe("background-timer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("schedule", () => {
    it("runs the callback once, after the delay", () => {
      const callback = jest.fn();

      schedule(callback, 1000);

      jest.advanceTimersByTime(999);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(10_000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not run a cancelled callback", () => {
      const callback = jest.fn();

      const handle = schedule(callback, 1000);
      cancel(handle);

      jest.advanceTimersByTime(10_000);
      expect(callback).not.toHaveBeenCalled();
    });

    it("cancels only the timer it is given", () => {
      const cancelled = jest.fn();
      const kept = jest.fn();

      const handle = schedule(cancelled, 1000);
      schedule(kept, 1000);
      cancel(handle);

      jest.advanceTimersByTime(1000);
      expect(cancelled).not.toHaveBeenCalled();
      expect(kept).toHaveBeenCalledTimes(1);
    });
  });

  describe("scheduleInterval", () => {
    it("runs the callback every interval until cancelled", () => {
      const callback = jest.fn();

      const handle = scheduleInterval(callback, 1000);

      jest.advanceTimersByTime(3000);
      expect(callback).toHaveBeenCalledTimes(3);

      cancel(handle);

      jest.advanceTimersByTime(3000);
      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe("cancel", () => {
    it("is a no-op for a timer that already fired", () => {
      const callback = jest.fn();

      const handle = schedule(callback, 1000);
      jest.advanceTimersByTime(1000);

      expect(() => cancel(handle)).not.toThrow();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("is a no-op for a handle that was never scheduled", () => {
      expect(() => cancel(null)).not.toThrow();
      expect(() => cancel(undefined)).not.toThrow();
    });
  });

  describe("delay", () => {
    it("resolves after the given time", async () => {
      const settled = jest.fn();

      const promise = delay(1000).then(settled);

      await jest.advanceTimersByTimeAsync(999);
      expect(settled).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      await promise;
      expect(settled).toHaveBeenCalled();
    });
  });
});
