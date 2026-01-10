import { fireEvent, render } from "@testing-library/react-native";

import { MeasureScreenHeight } from "@/components/MeasureScreenHeight";
import { resetForTesting, useScreen } from "@/stores/screen";

describe("MeasureScreenHeight", () => {
  beforeEach(() => {
    resetForTesting();
  });
  it("updates store dimensions on layout", () => {
    const { getByTestId } = render(<MeasureScreenHeight testID="measure" />);

    fireEvent(getByTestId("measure"), "layout", {
      nativeEvent: { layout: { height: 800, width: 400 } },
    });

    const state = useScreen.getState();
    expect(state.screenHeight).toBe(800);
    expect(state.screenWidth).toBe(400);
  });

  it("calculates shortScreen correctly for tall screens", () => {
    const { getByTestId } = render(<MeasureScreenHeight testID="measure" />);

    // Aspect ratio 2.0 (800/400) > 1.8, so not a short screen
    fireEvent(getByTestId("measure"), "layout", {
      nativeEvent: { layout: { height: 800, width: 400 } },
    });

    expect(useScreen.getState().shortScreen).toBe(false);
  });

  it("calculates shortScreen correctly for wide screens", () => {
    const { getByTestId } = render(<MeasureScreenHeight testID="measure" />);

    // Aspect ratio 1.5 (600/400) < 1.8, so it's a short screen
    fireEvent(getByTestId("measure"), "layout", {
      nativeEvent: { layout: { height: 600, width: 400 } },
    });

    expect(useScreen.getState().shortScreen).toBe(true);
  });
});
