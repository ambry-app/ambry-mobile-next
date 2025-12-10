import { act, renderHook } from "@testing-library/react-hooks";

import { useDebounce } from "@/hooks/use-debounce";

jest.useFakeTimers({ legacyFakeTimers: true });

describe("useDebounce", () => {
  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("foo", 500));
    expect(result.current).toBe("foo");
  });

  it("updates value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
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

  it("updates debounce timing when delay changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "foo", delay: 500 },
      },
    );
    rerender({ value: "bar", delay: 1000 });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe("foo");
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe("bar");
  });

  it("cleans up timers on unmount", () => {
    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "foo", delay: 500 },
      },
    );
    rerender({ value: "bar", delay: 500 });
    unmount();
    // No error should be thrown, timer should be cleared
  });

  it("handles rapid value changes (debounces to last value)", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
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
    expect(result.current).toBe("a"); // still initial value
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("c"); // debounced to last value
  });
});
