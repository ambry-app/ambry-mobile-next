import { render } from "@testing-library/react-native";

import { ProgressBar } from "@/components/ProgressBar";

describe("ProgressBar", () => {
  it("renders fill with correct width", () => {
    const { getByTestId } = render(
      <ProgressBar position={25} duration={100} />,
    );
    const fill = getByTestId("progress-bar-fill");
    expect(fill.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: "25%" })]),
    );
  });

  it("renders 0% width if duration is 0", () => {
    const { getByTestId } = render(<ProgressBar position={10} duration={0} />);
    const fill = getByTestId("progress-bar-fill");
    expect(fill.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: "0%" })]),
    );
  });
});
