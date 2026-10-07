import { describe, expect, test } from "vitest";
import { markerLanes } from "./marker-lanes";

describe("DC-FR-24 marker lanes", () => {
  test("markers far enough apart all sit on the timeline", () => {
    expect(markerLanes([0, 60, 200], 44)).toEqual([0, 0, 0]);
  });

  test("a marker that would overlap the one before moves up to the second row", () => {
    expect(markerLanes([57, 95, 170], 44)).toEqual([0, 1, 0]);
  });

  test("three close markers alternate, so no two in a row overlap", () => {
    expect(markerLanes([50, 70, 90], 44)).toEqual([0, 1, 0]);
  });

  test("the second row also keeps its markers apart, falling back to the timeline when both rows are taken", () => {
    expect(markerLanes([0, 20, 30], 44)).toEqual([0, 1, 0]);
  });
});
