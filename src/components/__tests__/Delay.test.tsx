import React from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

import { Delay } from "@/components/Delay";

describe("Delay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not render children immediately", () => {
    const { queryByText } = render(
      <Delay delay={1000}>
        <Text>Delayed content</Text>
      </Delay>,
    );
    expect(queryByText("Delayed content")).toBeNull();
  });

  it("renders children after delay", async () => {
    const { queryByText } = render(
      <Delay delay={1000}>
        <Text>Delayed content</Text>
      </Delay>,
    );
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(queryByText("Delayed content")).toBeTruthy();
    });
  });
});
