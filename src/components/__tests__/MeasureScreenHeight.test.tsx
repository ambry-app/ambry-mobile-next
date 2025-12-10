import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { MeasureScreenHeight } from "@/components/MeasureScreenHeight";
import * as screenStore from "@/stores/screen";

describe("MeasureScreenHeight", () => {
  it("calls setDimensions on layout", () => {
    const setDimensionsSpy = jest.spyOn(screenStore, "setDimensions");
    const { getByTestId } = render(<MeasureScreenHeight testID="measure" />);
    fireEvent(getByTestId("measure"), "layout", {
      nativeEvent: { layout: { height: 123, width: 456 } },
    });
    expect(setDimensionsSpy).toHaveBeenCalledWith(123, 456);
    setDimensionsSpy.mockRestore();
  });
});
