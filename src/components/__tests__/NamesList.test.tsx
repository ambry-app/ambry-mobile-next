import { render } from "@testing-library/react-native";

import { NamesList } from "@/components/NamesList";

describe("NamesList", () => {
  it("renders names as comma-separated list", () => {
    const { getByText } = render(
      <NamesList names={["Alice", "Bob", "Carol"]} />,
    );
    expect(getByText("Alice")).toBeTruthy();
    expect(getByText("Bob")).toBeTruthy();
    expect(getByText("Carol")).toBeTruthy();
  });

  it("renders prefix if provided", () => {
    const { getByText } = render(<NamesList names={["Alice"]} prefix="By" />);
    expect(getByText("By Alice")).toBeTruthy();
  });

  it("applies numberOfLines and testID", () => {
    const { getByTestId } = render(
      <NamesList names={["A"]} numberOfLines={2} testID="names-list" />,
    );
    const text = getByTestId("names-list");
    expect(text.props.numberOfLines).toBe(2);
  });
});
