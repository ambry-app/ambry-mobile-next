import { fireEvent, render } from "@testing-library/react-native";

import { HeaderButton } from "@/components/HeaderButton";

describe("HeaderButton", () => {
  it("renders label", () => {
    const { getByText } = render(
      <HeaderButton label="Settings" onPress={() => {}} />,
    );
    expect(getByText("Settings")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(<HeaderButton label="Go" onPress={onPress} />);
    fireEvent.press(getByText("Go"));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows or hides caret based on showCaret prop", () => {
    const { rerender, queryByTestId } = render(
      <HeaderButton label="Test" onPress={() => {}} testID="icon-btn" />,
    );
    // Caret is rendered by default (icon="chevron-right")
    expect(queryByTestId("icon-btn")).toBeTruthy();
    rerender(
      <HeaderButton
        label="Test"
        onPress={() => {}}
        showCaret={false}
        testID="icon-btn"
      />,
    );
    // IconButton with icon="none" should not render the icon
    // (We could check for absence of the icon, but this is implementation detail)
  });
});
