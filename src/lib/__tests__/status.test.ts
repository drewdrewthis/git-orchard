import { describe, it, expect } from "vitest";
import { resolvePrStatus } from "../types.js";
import type { PrInfo } from "../types.js";

const basePr: PrInfo = {
  number: 1,
  state: "open",
  title: "test",
  url: "https://example.com/pr/1",
  reviewDecision: "APPROVED",
  unresolvedThreads: 0,
  checksStatus: "pass",
};

describe("resolvePrStatus", () => {
  it("returns merged for merged PR", () => {
    expect(resolvePrStatus({ ...basePr, state: "merged" })).toBe("merged");
  });

  it("returns closed for closed PR", () => {
    expect(resolvePrStatus({ ...basePr, state: "closed" })).toBe("closed");
  });

  it("returns failing when checks fail", () => {
    expect(resolvePrStatus({ ...basePr, checksStatus: "fail" })).toBe("failing");
  });

  it("returns failing over unresolved threads", () => {
    expect(
      resolvePrStatus({ ...basePr, checksStatus: "fail", unresolvedThreads: 3 })
    ).toBe("failing");
  });

  it("returns unresolved when threads exist", () => {
    expect(
      resolvePrStatus({ ...basePr, unresolvedThreads: 2 })
    ).toBe("unresolved");
  });

  it("returns changes_requested over review_needed", () => {
    expect(
      resolvePrStatus({ ...basePr, reviewDecision: "CHANGES_REQUESTED" })
    ).toBe("changes_requested");
  });

  it("returns review_needed for empty review decision", () => {
    expect(
      resolvePrStatus({ ...basePr, reviewDecision: "" })
    ).toBe("review_needed");
  });

  it("returns review_needed for REVIEW_REQUIRED", () => {
    expect(
      resolvePrStatus({ ...basePr, reviewDecision: "REVIEW_REQUIRED" })
    ).toBe("review_needed");
  });

  it("returns pending_ci when approved but checks pending", () => {
    expect(
      resolvePrStatus({ ...basePr, checksStatus: "pending" })
    ).toBe("pending_ci");
  });

  it("returns approved when all green", () => {
    expect(resolvePrStatus(basePr)).toBe("approved");
  });

  it("returns approved when checks have no CI configured", () => {
    expect(
      resolvePrStatus({ ...basePr, checksStatus: "none" })
    ).toBe("approved");
  });
});
