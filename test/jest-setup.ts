/**
 * Jest setup file - runs before each test file.
 * Suppress console output to keep test runs clean.
 */

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  // Keep console.error visible - we usually want to see actual errors
});

afterAll(() => {
  jest.restoreAllMocks();
});
