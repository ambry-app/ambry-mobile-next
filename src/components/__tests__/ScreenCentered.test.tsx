import { Text } from "react-native";
import { render } from "@testing-library/react-native";

import { ScreenCentered } from "@/components/ScreenCentered";

describe("ScreenCentered", () => {
  it("renders children inside a centered View", () => {
    const { getByText } = render(
      <ScreenCentered>
        <Text>Centered content</Text>
      </ScreenCentered>,
    );
    expect(getByText("Centered content")).toBeTruthy();
  });
});
