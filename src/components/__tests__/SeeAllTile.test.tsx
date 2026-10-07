import { fireEvent, render } from "@testing-library/react-native";

import { SeeAllTile } from "@/components/SeeAllTile";

describe("SeeAllTile", () => {
  it("renders 'See all' text", async () => {
    const { getByText } = await render(<SeeAllTile onPress={() => {}} />);
    expect(getByText("See all")).toBeTruthy();
  });

  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<SeeAllTile onPress={onPress} />);
    await fireEvent.press(getByText("See all"));
    expect(onPress).toHaveBeenCalled();
  });
});
