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

export interface PrInfo {
  number: number;
  state: "open" | "merged" | "closed";
  title: string;
  url: string;
}
