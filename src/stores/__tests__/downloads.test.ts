import {
  addOrUpdateDownload,
  Download,
  initialDownloadsState,
  removeDownloadFromStore,
  resetForTesting,
  useDownloads,
} from "@/stores/downloads";

describe("downloads store", () => {
  beforeEach(() => {
    resetForTesting();
  });

  describe("addOrUpdateDownload", () => {
    it("adds a new download to the store", () => {
      const newDownload: Download = {
        mediaId: "media1",
        filePath: "/path/to/file1",
        status: "pending",
      };
      addOrUpdateDownload(newDownload);

      const state = useDownloads.getState();
      expect(state.downloads["media1"]).toEqual(newDownload);
    });

    it("updates an existing download", () => {
      useDownloads.setState({
        ...initialDownloadsState,
        downloads: {
          media1: {
            mediaId: "media1",
            filePath: "/path/to/file1",
            status: "pending",
          },
        },
      });

      const updatedDownload: Download = {
        mediaId: "media1",
        filePath: "/path/to/file1",
        status: "ready",
      };
      addOrUpdateDownload(updatedDownload);

      const state = useDownloads.getState();
      expect(state.downloads["media1"]).toEqual(updatedDownload);
    });
  });

  describe("removeDownloadFromStore", () => {
    it("removes a download from the store", () => {
      useDownloads.setState({
        ...initialDownloadsState,
        downloads: {
          media1: {
            mediaId: "media1",
            filePath: "/path/to/file1",
            status: "pending",
          },
        },
      });

      removeDownloadFromStore("media1");
      const state = useDownloads.getState();
      expect(state.downloads["media1"]).toBeUndefined();
    });

    it("does nothing if mediaId does not exist", () => {
      const initialDownloads = {
        media1: {
          mediaId: "media1",
          filePath: "/path/to/file1",
          status: "pending" as const,
        },
      };
      useDownloads.setState({
        ...initialDownloadsState,
        downloads: initialDownloads,
      });

      removeDownloadFromStore("media2");
      const state = useDownloads.getState();
      expect(state.downloads).toEqual(initialDownloads);
    });
  });
});
