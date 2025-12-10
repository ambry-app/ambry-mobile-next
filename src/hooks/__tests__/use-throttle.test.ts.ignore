import { act, renderHook } from "@testing-library/react-hooks";

import { useThrottle } from "@/hooks/use-throttle";

jest.useFakeTimers({ legacyFakeTimers: true });

describe("useThrottle", () => {
  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useThrottle("foo", 500));
    expect(result.current).toBe("foo");
  });

  it("updates value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      {
        initialProps: { value: "foo", delay: 500 },
      },
    );
    rerender({ value: "bar", delay: 500 });
    expect(result.current).toBe("foo");
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe("bar");
  });

  it("does not update value if called again within delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      {
        initialProps: { value: "foo", delay: 500 },
      },
    );
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
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      {
        initialProps: { value: "a", delay: 300 },
      },
    );
    rerender({ value: "b", delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender({ value: "c", delay: 300 });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    // Should still be "a" (throttle window not finished)
    expect(result.current).toBe("a");
    act(() => {
      jest.advanceTimersByTime(100);
    });
    // Now should be "c" (latest value after throttle window)
    expect(result.current).toBe("c");
  });

  it("cleans up timers on unmount", () => {
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      {
        initialProps: { value: "foo", delay: 500 },
      },
    );
    rerender({ value: "bar", delay: 500 });
    unmount();
    // No error should be thrown, timer should be cleared
  });
});
