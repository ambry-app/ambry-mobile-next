import { render } from "@testing-library/react-native";

import { ProgressBar } from "@/components/ProgressBar";

describe("ProgressBar", () => {
  it("renders fill with correct width", async () => {
    const { getByTestId } = await render(<ProgressBar percent={25} />);
    const fill = getByTestId("progress-bar-fill");
    expect(fill.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: "25%" })]),
    );
  });

  it("renders 0% width if percent is 0", async () => {
    const { getByTestId } = await render(<ProgressBar percent={0} />);
    const fill = getByTestId("progress-bar-fill");
    expect(fill.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: "0%" })]),
    );
  });
});
