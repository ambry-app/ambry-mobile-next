import React from "react";
import { render } from "@testing-library/react-native";

import { Loading } from "@/components/Loading";

describe("Loading", () => {
  it("renders ActivityIndicator with default props", () => {
    const { getByTestId } = render(<Loading testID="activity-indicator" />);
    const indicator = getByTestId("activity-indicator");
    expect(indicator).toBeTruthy();
    expect(indicator.props.animating).toBe(true);
    expect(indicator.props.size).toBe("large");
  });

  it("applies custom color and size", () => {
    const { getByTestId } = render(
      <Loading testID="activity-indicator" color="#123456" size={42} />,
    );
    const indicator = getByTestId("activity-indicator");
    expect(indicator.props.color).toBe("#123456");
    expect(indicator.props.size).toBe(42);
  });

  it("applies custom style", () => {
    const style = { marginTop: 10 };
    const { getByTestId } = render(
      <Loading testID="activity-indicator" style={style} />,
    );
    const indicator = getByTestId("activity-indicator");
    expect(indicator.props.style).toMatchObject(style);
  });
});
