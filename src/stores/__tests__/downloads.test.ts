import {
  addOrUpdateDownload,
  Download,
  initialDownloadsState,
  removeDownloadFromStore,
  resetForTesting,
  setDownloadProgress,
  setDownloadResumable,
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
        progress: 1,
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

  describe("setDownloadProgress", () => {
    it("sets the progress for a download", () => {
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

      setDownloadProgress("media1", 0.5);
      const state = useDownloads.getState();
      expect(state.downloads["media1"]?.progress).toBe(0.5);
    });

    it("sets progress to undefined if progress is 1", () => {
      useDownloads.setState({
        ...initialDownloadsState,
        downloads: {
          media1: {
            mediaId: "media1",
            filePath: "/path/to/file1",
            status: "pending",
            progress: 0.99,
          },
        },
      });
      setDownloadProgress("media1", 1);
      const state = useDownloads.getState();
      expect(state.downloads["media1"]?.progress).toBeUndefined();
    });
  });

  describe("setDownloadResumable", () => {
    it("sets the resumable for a download", () => {
      const resumable = {} as any; // Mock resumable object
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

      setDownloadResumable("media1", resumable);
      const state = useDownloads.getState();
      expect(state.downloads["media1"]?.resumable).toBe(resumable);
    });
  });
});
