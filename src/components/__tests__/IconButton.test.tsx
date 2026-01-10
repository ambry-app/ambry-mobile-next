import { ActivityIndicator, Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import { IconButton } from "@/components/IconButton";

describe("IconButton", () => {
  it("renders icon and children", () => {
    const { getByTestId, getByText } = render(
      <IconButton size={24} icon="star" color="#000" testID="icon-btn">
        <Text>Child</Text>
      </IconButton>,
    );
    expect(getByTestId("icon-btn")).toBeTruthy();
    expect(getByText("Child")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <IconButton
        size={24}
        icon="star"
        color="#000"
        onPress={onPress}
        testID="icon-btn"
      />,
    );
    fireEvent.press(getByTestId("icon-btn"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders the loading indicator when icon is 'loading'", () => {
    const { getByTestId } = render(
      <IconButton size={20} icon="loading" color="#123" testID="icon-btn" />,
    );
    // The Loading component renders an ActivityIndicator with the given size and color
    // We'll check for ActivityIndicator by type
    const activityIndicators =
      getByTestId("icon-btn").findAllByType(ActivityIndicator);
    expect(activityIndicators.length).toBeGreaterThan(0);
    expect(activityIndicators[0]!.props.size).toBe(20);
    expect(activityIndicators[0]!.props.color).toBe("#123");
  });
});
