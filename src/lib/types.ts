export interface Worktree {
  path: string;
  branch: string | null;
  head: string;
  isBare: boolean;
  pr: PrInfo | null;
  prLoading: boolean;
  tmuxSession: string | null;
  tmuxAttached: boolean;
}

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "";

export type ChecksStatus = "pass" | "fail" | "pending" | "none";

export interface PrInfo {
  number: number;
  state: "open" | "merged" | "closed";
  title: string;
  url: string;
  reviewDecision: ReviewDecision;
  unresolvedThreads: number;
  checksStatus: ChecksStatus;
}

/**
 * Single unified status for display, ordered by priority (highest first).
 */
export type PrStatus =
  | "failing"
  | "unresolved"
  | "changes_requested"
  | "review_needed"
  | "pending_ci"
  | "approved"
  | "merged"
  | "closed";

export function resolvePrStatus(pr: PrInfo): PrStatus {
  if (pr.state === "merged") return "merged";
  if (pr.state === "closed") return "closed";

  // Open PR — priority ordering
  if (pr.checksStatus === "fail") return "failing";
  if (pr.unresolvedThreads > 0) return "unresolved";
  if (pr.reviewDecision === "CHANGES_REQUESTED") return "changes_requested";
  if (pr.reviewDecision === "REVIEW_REQUIRED" || pr.reviewDecision === "") return "review_needed";
  if (pr.checksStatus === "pending") return "pending_ci";
  return "approved";
}
