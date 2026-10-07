import { fireEvent, render } from "@testing-library/react-native";

import { ErrorScreen } from "@/components/ErrorScreen";

describe("ErrorScreen", () => {
  it("shows the title and message", async () => {
    const { getByText } = await render(
      <ErrorScreen title="Nope" message="Could not reach your server." />,
    );

    expect(getByText("Nope")).toBeTruthy();
    expect(getByText("Could not reach your server.")).toBeTruthy();
  });

  it("omits the actions when no handlers are given", async () => {
    const { queryByText } = await render(
      <ErrorScreen title="Nope" message="Irrecoverable." />,
    );

    expect(queryByText("Try again")).toBeNull();
    expect(queryByText("Sign out")).toBeNull();
  });

  it("retries when the retry button is pressed", async () => {
    const onRetry = jest.fn();
    const { getByText } = await render(
      <ErrorScreen title="Nope" message="Try later." onRetry={onRetry} />,
    );

    await fireEvent.press(getByText("Try again"));

    expect(onRetry).toHaveBeenCalled();
  });

  it("signs out when the sign out button is pressed", async () => {
    const onSignOut = jest.fn();
    const { getByText } = await render(
      <ErrorScreen title="Nope" message="Try later." onSignOut={onSignOut} />,
    );

    await fireEvent.press(getByText("Sign out"));

    expect(onSignOut).toHaveBeenCalled();
  });
});
