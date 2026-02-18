import { useState } from "react";
import { WorktreeList } from "./components/WorktreeList.js";
import { Cleanup } from "./components/Cleanup.js";
import { useWorktrees } from "./hooks/useWorktrees.js";

interface Props {
  command?: string;
}

type View = "list" | "cleanup";

export default function App({ command }: Props) {
  const { worktrees, loading, error, refresh } = useWorktrees();
  const [view, setView] = useState<View>(
    command === "cleanup" ? "cleanup" : "list"
  );

  if (view === "cleanup") {
    return (
      <Cleanup
        worktrees={worktrees}
        onDone={() => {
          refresh();
          setView("list");
        }}
      />
    );
  }

  return (
    <WorktreeList
      worktrees={worktrees}
      loading={loading}
      error={error}
      onRefresh={refresh}
      onCleanup={() => setView("cleanup")}
    />
  );
}
