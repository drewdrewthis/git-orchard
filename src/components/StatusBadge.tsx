import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { PrInfo } from "../lib/types.js";

interface Props {
  pr: PrInfo | null;
  loading: boolean;
}

export function StatusBadge({ pr, loading }: Props) {
  if (loading) {
    return (
      <Text dimColor>
        <Spinner type="dots" />
      </Text>
    );
  }

  if (!pr) {
    return <Text dimColor>no PR</Text>;
  }

  switch (pr.state) {
    case "merged":
      return <Text color="magenta">✓ merged</Text>;
    case "closed":
      return <Text color="red">✕ closed</Text>;
    case "open":
      return (
        <Box gap={1}>
          <Text color="green">● open</Text>
          <ReviewStatus decision={pr.reviewDecision} />
          {pr.unresolvedThreads > 0 && (
            <Text color="yellow">💬 {pr.unresolvedThreads} unresolved</Text>
          )}
        </Box>
      );
  }
}

function ReviewStatus({ decision }: { decision: string }) {
  switch (decision) {
    case "APPROVED":
      return <Text color="green">✓ approved</Text>;
    case "CHANGES_REQUESTED":
      return <Text color="red">✎ changes requested</Text>;
    case "REVIEW_REQUIRED":
      return <Text color="yellow">◌ review needed</Text>;
    default:
      return null;
  }
}
