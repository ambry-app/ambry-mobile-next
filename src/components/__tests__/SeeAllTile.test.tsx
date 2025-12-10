import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { SeeAllTile } from "@/components/SeeAllTile";

describe("SeeAllTile", () => {
  it("renders 'See all' text", () => {
    const { getByText } = render(<SeeAllTile onPress={() => {}} />);
    expect(getByText("See all")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(<SeeAllTile onPress={onPress} />);
    fireEvent.press(getByText("See all"));
    expect(onPress).toHaveBeenCalled();
  });
});
