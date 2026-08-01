/**
 * Tests for the library service hooks.
 *
 * usePaginatedLibraryData is exercised with a caller-supplied getPage function
 * (its normal usage) backed by a plain in-memory array standing in for the
 * database queries.
 */

import { act, renderHook, waitFor } from "@testing-library/react-native";

import { usePaginatedLibraryData } from "@/services/library-service";
import {
  resetForTesting as resetDataVersionStore,
  setLibraryDataVersion,
} from "@/stores/data-version";
import { setupTestDatabase } from "@test/db-test-utils";

setupTestDatabase();

type Row = { id: string; insertedAt: Date };

describe("usePaginatedLibraryData", () => {
  beforeEach(() => {
    resetDataVersionStore();
  });

  it("reloads at least one page after a sync when the list was empty", async () => {
    let rows: Row[] = [];
    const getPage = async (pageSize: number, _cursor?: Date) =>
      rows.slice(0, pageSize);
    const getCursor = (item: Row) => item.insertedAt;

    const { result } = renderHook(() =>
      usePaginatedLibraryData(25, getPage, getCursor),
    );

    // Initial load against an empty database
    await waitFor(() => {
      expect(result.current.items).toEqual([]);
    });

    // A sync inserts rows and bumps the library data version
    rows = [
      { id: "media-1", insertedAt: new Date("2024-01-15T10:00:00.000Z") },
      { id: "media-2", insertedAt: new Date("2024-01-15T11:00:00.000Z") },
    ];
    act(() => {
      setLibraryDataVersion(new Date("2024-01-15T12:00:00.000Z"));
    });

    // The screen must pick up the new rows even though it had zero items
    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });
  });

  it("reloads all currently loaded items when the data version changes", async () => {
    let rows: Row[] = [
      { id: "media-1", insertedAt: new Date("2024-01-15T10:00:00.000Z") },
    ];
    const getPage = async (pageSize: number, _cursor?: Date) =>
      rows.slice(0, pageSize);
    const getCursor = (item: Row) => item.insertedAt;

    const { result } = renderHook(() =>
      usePaginatedLibraryData(25, getPage, getCursor),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    rows = [
      { id: "media-1", insertedAt: new Date("2024-01-15T10:00:00.000Z") },
      { id: "media-2", insertedAt: new Date("2024-01-15T11:00:00.000Z") },
    ];
    act(() => {
      setLibraryDataVersion(new Date("2024-01-15T12:00:00.000Z"));
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });
  });
});
