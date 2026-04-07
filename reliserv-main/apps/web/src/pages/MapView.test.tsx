import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMapWorkers } from "../api/map";
import MapView from "./MapView";

vi.mock("../api/map", () => ({
  getMapWorkers: vi.fn(),
}));

const mockedGetMapWorkers = vi.mocked(getMapWorkers);

function mockGeolocation(
  implementation: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
  ) => void,
) {
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: implementation,
    },
  });
}

describe("MapView", () => {
  beforeEach(() => {
    mockedGetMapWorkers.mockReset();
  });

  it("shows a loading state while waiting for browser location", async () => {
    mockGeolocation(() => undefined);

    render(<MapView />);

    await waitFor(() => {
      expect(screen.getByText("Loading visible workers...")).toBeInTheDocument();
    });
    expect(mockedGetMapWorkers).not.toHaveBeenCalled();
  });

  it("shows the empty state when no eligible workers are returned", async () => {
    mockGeolocation((success) => {
      success({
        coords: {
          latitude: 27.8006,
          longitude: -97.3964,
          accuracy: 1,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    });

    mockedGetMapWorkers.mockResolvedValue({
      center: {
        lat: 27.8006,
        lng: -97.3964,
        mode: "normal",
      },
      workers: [],
    });

    render(<MapView />);

    expect(
      await screen.findByText("No eligible workers visible right now."),
    ).toBeInTheDocument();
    expect(mockedGetMapWorkers).toHaveBeenCalledWith(27.8006, -97.3964, "normal");
  });

  it("shows the error state when loading workers fails", async () => {
    mockGeolocation((success) => {
      success({
        coords: {
          latitude: 27.8006,
          longitude: -97.3964,
          accuracy: 1,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    });

    mockedGetMapWorkers.mockRejectedValue(new Error("Map API unavailable"));

    render(<MapView />);

    expect(await screen.findByText("Map API unavailable")).toBeInTheDocument();
  });
});
