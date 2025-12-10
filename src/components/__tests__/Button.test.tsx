import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import { Button } from "@/components/Button";

describe("Button", () => {
  it("renders children", () => {
    const { getByText } = render(
      <Button size={24} onPress={() => {}}>
        <Text>Click me</Text>
      </Button>,
    );
    expect(getByText("Click me")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(
      <Button size={24} onPress={onPressMock}>
        <Text>Press</Text>
      </Button>,
    );
    fireEvent.press(getByRole("button"));
    expect(onPressMock).toHaveBeenCalled();
  });

  it("applies custom style", () => {
    const customStyle = { backgroundColor: "red" };
    const { getByRole } = render(
      <Button size={24} onPress={() => {}} style={customStyle}>
        <Text>Styled</Text>
      </Button>,
    );
    const button = getByRole("button");
    // TouchableOpacity merges styles, so check merged style object
    expect(button.props.style).toMatchObject({
      backgroundColor: "red",
      padding: 12,
      alignItems: "center",
      justifyContent: "center",
      display: "flex",
    });
  });
});
