import { resetForTesting, setDimensions, useScreen } from "@/stores/screen";

describe("screen store", () => {
  beforeEach(() => {
    resetForTesting();
  });

  describe("setDimensions", () => {
    it("sets screen dimensions", () => {
      setDimensions(800, 400);

      const state = useScreen.getState();
      expect(state.screenHeight).toBe(800);
      expect(state.screenWidth).toBe(400);
    });

    it("sets shortScreen to true when aspect ratio is less than 1.8", () => {
      // 700/400 = 1.75, which is < 1.8
      setDimensions(700, 400);

      expect(useScreen.getState().shortScreen).toBe(true);
    });

    it("sets shortScreen to false when aspect ratio is 1.8 or greater", () => {
      // 720/400 = 1.8, which is >= 1.8
      setDimensions(720, 400);

      expect(useScreen.getState().shortScreen).toBe(false);
    });

    it("sets shortScreen to false for typical phone aspect ratio", () => {
      // 844/390 ≈ 2.16, which is > 1.8 (iPhone 12/13 dimensions)
      setDimensions(844, 390);

      expect(useScreen.getState().shortScreen).toBe(false);
    });

    it("sets shortScreen to true for tablet-like aspect ratio", () => {
      // 1024/768 ≈ 1.33, which is < 1.8 (iPad-like)
      setDimensions(1024, 768);

      expect(useScreen.getState().shortScreen).toBe(true);
    });
  });
});
