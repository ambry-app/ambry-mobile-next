import { act, render } from "@testing-library/react-native";

import { SyncProgress } from "@/components/SyncProgress";
import {
  beginSyncProgress,
  resetForTesting,
  setSyncSaveProgress,
  setSyncStage,
  SyncStage,
  SyncTask,
} from "@/stores/sync-progress";

describe("SyncProgress", () => {
  beforeEach(async () => {
    resetForTesting();
  });

  it("names both halves of the sync", async () => {
    const { getByText } = await render(<SyncProgress />);

    expect(getByText("Library")).toBeTruthy();
    expect(getByText("Listening progress")).toBeTruthy();
  });

  it("reports the current step and counts while saving", async () => {
    const { getByText } = await render(<SyncProgress />);

    await act(() => {
      beginSyncProgress();
      setSyncSaveProgress(SyncTask.LIBRARY, "books", 1200, 5000);
    });

    expect(getByText("Saving books…")).toBeTruthy();
    expect(getByText("1,200 of 5,000")).toBeTruthy();
  });

  it("shows each task's stage independently", async () => {
    await act(() => {
      beginSyncProgress();
      setSyncStage(SyncTask.LIBRARY, SyncStage.DOWNLOADING);
      setSyncStage(SyncTask.EVENTS, SyncStage.DONE);
    });

    const { getByText } = await render(<SyncProgress />);
    expect(getByText("Downloading…")).toBeTruthy();
    expect(getByText("Done")).toBeTruthy();
  });

  it("surfaces a failed task", async () => {
    await act(() => {
      beginSyncProgress();
      setSyncStage(SyncTask.LIBRARY, SyncStage.FAILED);
    });

    const { getByText } = await render(<SyncProgress />);
    expect(getByText("Failed")).toBeTruthy();
  });

  it("fills the bar for a finished task", async () => {
    await act(() => {
      beginSyncProgress();
      setSyncSaveProgress(SyncTask.LIBRARY, "books", 10, 100);
      setSyncStage(SyncTask.LIBRARY, SyncStage.DONE);
    });

    const { getAllByTestId } = await render(<SyncProgress />);
    const libraryFill = getAllByTestId("progress-bar-fill")[0]!;

    expect(libraryFill.props.style).toEqual(
      expect.arrayContaining([{ width: "100%" }]),
    );
  });
});
