import { act, renderHook } from "@testing-library/react-native";

import { useThrottle } from "@/hooks/use-throttle";

describe("useThrottle", () => {
  beforeEach(() => {
    // NOTE: We use legacy fake timers here because the useThrottle hook relies on Date.now() to determine elapsed time.
    // Modern Jest fake timers (the default) do NOT mock Date.now()—they only mock timer functions like setTimeout/setInterval.
    // As a result, advancing timers with modern fake timers does NOT advance the value returned by Date.now(),
    // causing throttle logic to break in tests. Legacy fake timers DO mock Date.now() and keep it in sync with timer advances.
    // See: https://jestjs.io/docs/timer-mocks#date-now and https://github.com/jestjs/jest/issues/10221
    jest.useFakeTimers({ legacyFakeTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useThrottle("foo", 500));
    expect(result.current).toBe("foo");
  });

  it("updates value after delay", () => {
    const { result, rerender } = renderHook<
      string,
      { value: string; delay: number }
    >(({ value, delay }) => useThrottle(value, delay), {
      initialProps: { value: "foo", delay: 500 },
    });
    rerender({ value: "bar", delay: 500 });
    expect(result.current).toBe("foo");
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe("bar");
  });

  it("does not update value if called again within delay", () => {
    const { result, rerender } = renderHook<
      string,
      { value: string; delay: number }
    >(({ value, delay }) => useThrottle(value, delay), {
      initialProps: { value: "foo", delay: 500 },
    });
    rerender({ value: "bar", delay: 500 });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    rerender({ value: "baz", delay: 500 });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    // Still should be "foo" (not enough time elapsed)
    expect(result.current).toBe("foo");
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    // Now enough time has passed for the first update
    expect(result.current).toBe("baz");
  });

  it("updates to the latest value after delay if value changes rapidly", () => {
    const { result, rerender } = renderHook<
      string,
      { value: string; delay: number }
    >(({ value, delay }) => useThrottle(value, delay), {
      initialProps: { value: "foo", delay: 500 },
    });
    rerender({ value: "b", delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender({ value: "c", delay: 300 });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    // Should still be "a" (throttle window not finished)
    expect(result.current).toBe("foo");
    act(() => {
      jest.advanceTimersByTime(100);
    });
    // Now should be "c" (latest value after throttle window)
    expect(result.current).toBe("c");
  });

  it("cleans up timers on unmount", () => {
    const { unmount, rerender } = renderHook<
      string,
      { value: string; delay: number }
    >(({ value, delay }) => useThrottle(value, delay), {
      initialProps: { value: "foo", delay: 500 },
    });
    rerender({ value: "bar", delay: 500 });
    unmount();
    // No error should be thrown, timer should be cleared
  });
});
